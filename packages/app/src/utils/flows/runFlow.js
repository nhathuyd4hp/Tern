import { findCollectionByUid, flattenItems } from 'utils/collections/index';
import isEqual from 'lodash/isEqual';
import { cancelRequest, sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import { runtimeVariablesUpdateEvent } from 'providers/ReduxStore/slices/collections';
import { closeWsConnection } from 'utils/network';
import { fillVariables, findRequestByPath, GRPC_STATUSES, OTHER_STATUS, WHERE_OPERATORS } from './index';

const RESULT_LISTS = ['assertionResults', 'testResults', 'preRequestTestResults', 'postResponseTestResults'];
const MAX_NODE_RUNS = 50;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TIMED_OUT = Symbol('timed out');

// The outcome of the promise, or TIMED_OUT once `ms` have passed first (Infinity waits for as long as it takes).
const withDeadline = async (promise, ms) => {
  if (ms === Infinity) return promise;
  let timer;
  try {
    return await Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), Math.max(0, ms)); })]);
  } finally {
    clearTimeout(timer);
  }
};

const applicationOf = (getState, collectionUid) => findCollectionByUid(getState().collections.collections, collectionUid);

// A response that never came (or a request that errored) ends the flow; a failed test is reported but the status still picks the way on.
const fatalErrorOf = (item) => {
  const response = item?.response;
  if (!response) return 'No response';
  if (response.isError || response.status === 'Error' || response.error) {
    return String(response.error?.message || response.error || 'The request failed');
  }
  if (typeof response.status !== 'number') return 'The request got no status back';
  return null;
};

const testFailureOf = (item) => {
  const failed = RESULT_LISTS.flatMap((list) => item[list] || []).find((result) => result.status === 'fail');
  return failed ? failed.error || failed.description || 'A test or assertion failed' : null;
};

// Variables travel through the store; give the update pushed by the main process a moment to land.
const waitForVariables = async (getState, collectionUid, names) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const variables = applicationOf(getState, collectionUid)?.runtimeVariables || {};
    if (names.every((name) => name in variables)) return variables;
    await wait(50);
  }
  return applicationOf(getState, collectionUid)?.runtimeVariables || {};
};

// A query parameter lives in the url, so the url is rewritten too; the value is kept as typed so {{variables}} still resolve.
const withQueryValue = (url, name, value) => {
  const [base, query = ''] = url.split('?');
  if (!query) return url;
  const pairs = query.split('&').map((pair) => (pair.split('=')[0] === name ? `${name}=${value}` : pair));
  return `${base}?${pairs.join('&')}`;
};

// A gRPC or WebSocket request sends messages: the text of the node replaces the content of the first (gRPC) or the selected (WebSocket) one.
const applyBodyInput = (body, text) => {
  if (text === null) return body;
  const replaceAt = (messages, position) => messages.map((message, index) => (index === position ? { ...message, content: text } : message));
  if (body?.mode === 'grpc') return { ...body, grpc: replaceAt(body.grpc || [], 0) };
  if (body?.mode === 'ws') return { ...body, ws: replaceAt(body.ws || [], Math.max(0, (body.ws || []).findIndex((message) => message.selected))) };
  return { ...body, mode: 'json', json: text };
};

const applyInputs = (saved, inputs) => {
  const original = saved.request || {};
  let url = original.url || '';
  const params = (original.params || []).map((param) => {
    if (!(param.name in inputs.params)) return param;
    if (param.type === 'query') url = withQueryValue(url, param.name, inputs.params[param.name]);
    return { ...param, value: inputs.params[param.name] };
  });

  const headers = [...(original.headers || [])];
  Object.entries(inputs.headers).forEach(([name, value]) => {
    const position = headers.findIndex((header) => header.name.toLowerCase() === name.toLowerCase());
    if (position >= 0) headers[position] = { ...headers[position], value, enabled: true };
    else headers.push({ uid: `flow-header-${name}`, name, value, enabled: true });
  });

  return { ...original, url, params, headers, body: applyBodyInput(original.body, inputs.body) };
};

// What the panel of a request shows after a run.
const responseOf = (response) => (response
  ? { status: response.status, statusText: response.statusText, headers: response.headers, data: response.data, size: response.size, duration: response.duration }
  : null);

// 'res.body.data.user["id"][0]' -> ['data', 'user', 'id', 0]; null when the expression is not a plain path in the body.
const bodyPathOf = (expression) => {
  const match = /^res\.body((?:\.[A-Za-z_$][\w$]*|\["[^"]*"\]|\['[^']*'\]|\[\d+\])*)$/.exec(expression.trim());
  if (!match) return null;
  return [...match[1].matchAll(/\.([A-Za-z_$][\w$]*)|\["([^"]*)"\]|\['([^']*)'\]|\[(\d+)\]/g)].map((part) => (part[4] !== undefined ? Number(part[4]) : part[1] ?? part[2] ?? part[3]));
};

// Says why a value could not be taken, as far as the response shows: where the path stops being there.
const explainMissing = ({ name, expression, where }, response, variables) => {
  const base = `Could not take ${name} (${expression})`;
  const path = bodyPathOf(expression);
  if (!path || !response) return `${base} from the response`;
  if (where) {
    const wanted = where.map(({ field, op, value }) => `${field} ${WHERE_OPERATORS[op || 'equals']} ${fillVariables(value, variables)}`).join(' and ');
    return `${base}: no item of the list has ${wanted}`;
  }
  let value = response.data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return `${base}: the response body is not JSON`;
    }
  }
  let walked = 'res.body';
  for (const key of path) {
    if (value === null || value === undefined) return `${base}: ${walked} is ${value === null ? 'null' : 'missing'}`;
    if (typeof value !== 'object') return `${base}: ${walked} is not an object`;
    if (!(key in value)) return `${base}: ${walked} has no ${typeof key === 'number' ? `item ${key}` : `"${key}"`}`;
    value = value[key];
    walked += typeof key === 'number' ? `[${key}]` : `.${key}`;
  }
  return `${base}: ${walked} is ${value === null ? 'null' : 'missing'}`;
};

// The value a plain 'res.body...' path points to in the response; undefined when the path is not there.
const readBodyPath = (response, path) => {
  let value = response?.data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !(key in value)) return undefined;
    value = value[key];
  }
  return value;
};

// The path with its first list index replaced by the position of the item whose field equals the wanted value
// ({{variables}} in the value are filled in); null when the path has no list or no item matches.
const pathToItem = (response, path, where, variables) => {
  const listEnd = path.findIndex((key) => typeof key === 'number');
  if (listEnd < 0) return null;
  const list = readBodyPath(response, path.slice(0, listEnd));
  if (!Array.isArray(list)) return null;
  const meets = (item, { field, op, value }) => {
    const found = String(item[field]);
    const wanted = fillVariables(value, variables);
    if (op === 'differs') return found !== wanted;
    if (op === 'contains') return found.includes(wanted);
    return found === wanted;
  };
  const position = list.findIndex((item) => item !== null && typeof item === 'object' && where.every((condition) => meets(item, condition)));
  return position < 0 ? null : path.map((key, index) => (index === listEnd ? position : key));
};

// Puts the values taken so far in the variables of the application, for the requests that follow. The pipeline
// replaces them wholesale when a request ends, so they are put back before each request.
const publishVariables = (dispatch, getState, collectionUid, variables) => {
  const current = applicationOf(getState, collectionUid)?.runtimeVariables || {};
  if (Object.entries(variables).every(([name, value]) => isEqual(current[name], value))) return;
  dispatch(runtimeVariablesUpdateEvent({ collectionUid, runtimeVariables: { ...current, ...variables } }));
};

const SOCKET_TYPES = ['grpc-request', 'ws-request'];
const WS_DEFAULT_WAIT = 10000;

// Polls until check() gives something, the limit passes (null), or the flow gave this node up.
const until = async (check, limitMs, control) => {
  const end = Date.now() + limitMs;
  while (!control.cancelled) {
    const found = check();
    if (found) return found;
    if (Date.now() >= end) return null;
    await wait(50);
  }
  return null;
};

const parseMessage = (message) => {
  if (typeof message !== 'string') return message;
  try {
    return JSON.parse(message);
  } catch {
    return message;
  }
};

const currentItem = (getState, collectionUid, uid) => flattenItems(applicationOf(getState, collectionUid)?.items || []).find((candidate) => candidate.uid === uid);

// A WebSocket message the node sends: JSON when it is, else plain text.
const wsMessage = (text, position) => {
  let type = 'text';
  try {
    JSON.parse(text);
    type = 'json';
  } catch {
    // not JSON: sent as text
  }
  return { name: `flow message ${position + 1}`, type, content: text, selected: true };
};

// What a gRPC or WebSocket request answered, in the shape of a response of the flow: an exit instead of a status code, the message as body.
// `received` collects the messages that came in, as they may leave the item when the next message is sent.
const socketOutcome = async (item, node, collectionUid, getState, startedAt, control, received, flowVariables) => {
  const current = () => currentItem(getState, collectionUid, item.uid);
  const fresh = () => (current()?.requestSent?.timestamp ?? 0) >= startedAt;

  if (item.type === 'grpc-request') {
    const done = await until(() => (fresh() && typeof current()?.response?.statusCode === 'number' ? current().response : null), Infinity, control);
    if (!done) return null;
    const messages = (done.responses || []).map(parseMessage);
    const exit = GRPC_STATUSES.includes(done.statusText) ? done.statusText : 'UNKNOWN';
    return { exit, response: { status: exit, statusText: done.statusDescription || '', headers: done.headers, data: messages.length > 1 ? messages : messages[0], duration: done.duration } };
  }

  // WebSocket: wait for a message that holds the text the node expects (any message when it expects none); the connection is closed after
  const expected = fillVariables(node.expect || '', flowVariables);
  const collect = () => collectIncoming(current()?.response, startedAt, received);
  const match = () => (collect(), received.find((entry) => String(entry.message).includes(expected)));
  const limit = node.timeout ? node.timeout * 1000 : WS_DEFAULT_WAIT;

  // Keep open: leave as soon as the socket is open and let it listen while the flow goes on; a later node on the same request waits for the message
  if (node.keepOpen) {
    await until(() => ['CONNECTED', 'CLOSED'].includes(current()?.response?.status) || current()?.response?.isError, limit, control);
    const response = current()?.response || {};
    const exit = response.isError ? 'ERROR' : response.status === 'CLOSED' ? 'CLOSED' : response.status === 'CONNECTED' ? 'CONNECTED' : 'TIMEOUT';
    if (exit === 'CONNECTED') control.sockets[item.uid] = { startedAt, received };
    else await closeWsConnection(item.uid).catch(() => {});
    return { exit, response: { status: exit, statusText: response.error || '', headers: response.headers, duration: Date.now() - startedAt } };
  }

  const found = await until(() => match() || (current()?.response?.status === 'CLOSED' || current()?.response?.isError ? { ended: true } : null), limit, control);
  const response = current()?.response || {};
  const matched = found && !found.ended ? found : null;
  // CONNECTED: the socket opened but nothing the node waits for came; TIMEOUT: it did not even open in time
  const exit = matched ? 'RECEIVED' : response.isError ? 'ERROR' : response.status === 'CLOSED' ? 'CLOSED' : response.status === 'CONNECTED' ? 'CONNECTED' : 'TIMEOUT';
  await closeWsConnection(item.uid).catch(() => {});
  return { exit, response: { status: exit, statusText: response.error || '', headers: response.headers, data: matched ? parseMessage(matched.message) : undefined, duration: Date.now() - startedAt } };
};

// Adds the messages received since `startedAt` that are not in `received` yet.
const collectIncoming = (response, startedAt, received) => {
  (response?.responses || [])
    .filter((entry) => entry.type === 'incoming' && new Date(entry.timestamp).getTime() >= startedAt)
    .forEach((entry) => {
      if (!received.some((known) => known.seq === entry.seq && known.timestamp === entry.timestamp && known.message === entry.message)) received.push(entry);
    });
};

const runSocketNode = async (item, request, node, extractions, collectionUid, dispatch, getState, flowVariables, control) => {
  const startedAt = Date.now();
  const received = [];
  // a WebSocket node sends the messages written in it, one after the other, else the message of the request
  const sends = item.type === 'ws-request' && node.send?.length
    ? node.send.map((text, position) => ({ ...request, request: { ...request.request, body: { mode: 'ws', ws: [wsMessage(text, position)] } } }))
    : [request];
  try {
    for (const toSend of sends) {
      await dispatch(sendRequest(toSend, collectionUid));
      collectIncoming(currentItem(getState, collectionUid, item.uid)?.response, startedAt, received);
    }
  } catch (error) {
    return { status: 'failed', fatal: true, error: error?.message || 'The request failed' };
  }
  const outcome = await socketOutcome(item, node, collectionUid, getState, startedAt, control, received, flowVariables);
  if (!outcome) return { status: 'failed', fatal: true, error: 'No answer' };

  // the messages that come after the node left are read by the branch of RECEIVED, so a node that keeps its socket open takes nothing now
  return socketResult(outcome.exit, outcome.response, node.keepOpen ? [] : extractions, collectionUid, dispatch, getState, flowVariables);
};

// What a node reports once its socket answered: the values taken from the answer and the exit to leave through.
const socketResult = (exit, response, extractions, collectionUid, dispatch, getState, flowVariables) => {
  const extracted = {};
  extractions.forEach((extraction) => {
    const plain = bodyPathOf(extraction.expression);
    const path = plain && extraction.where ? pathToItem(response, plain, extraction.where, flowVariables) : plain;
    const value = path ? readBodyPath(response, path) : undefined;
    if (value !== undefined && value !== null) extracted[extraction.name] = value;
  });
  publishVariables(dispatch, getState, collectionUid, { ...flowVariables, ...extracted });
  const missing = extractions.filter((extraction) => !(extraction.name in extracted));
  const fatal = missing.length ? missing.map((extraction) => explainMissing(extraction, response, flowVariables)).join('\n') : null;
  return {
    status: fatal ? 'failed' : 'passed',
    fatal: Boolean(fatal),
    error: fatal,
    exit,
    failedExit: !['OK', 'RECEIVED', 'CONNECTED'].includes(exit),
    statusText: response.statusText,
    duration: response.duration,
    extracted,
    response
  };
};

const runNode = async (node, collectionUid, dispatch, getState, flowVariables, control) => {
  const item = findRequestByPath(applicationOf(getState, collectionUid), node.requestPath);
  if (!item) return { status: 'failed', fatal: true, error: `Request not found: ${node.requestPath}` };

  const extractions = node.extractions.filter((extraction) => extraction.name && extraction.expression);
  // The saved request, not an unsaved draft, so a run can be repeated; the extractions ride along as
  // post-response variables, which the request pipeline already evaluates.
  const { draft, ...saved } = item;
  const shaped = applyInputs(saved, node.inputs);
  const request = {
    ...saved,
    request: {
      ...shaped,
      vars: {
        ...saved.request?.vars,
        res: [
          ...(saved.request?.vars?.res || []),
          ...extractions.filter((extraction) => !extraction.where).map((extraction) => ({ uid: `flow-${extraction.name}`, name: extraction.name, value: extraction.expression, enabled: true }))
        ]
      }
    }
  };

  publishVariables(dispatch, getState, collectionUid, flowVariables);
  if (SOCKET_TYPES.includes(item.type)) return runSocketNode(item, request, node, extractions, collectionUid, dispatch, getState, flowVariables, control);
  const startedAt = Date.now();
  try {
    await dispatch(sendRequest(request, collectionUid));
  } catch (error) {
    return { status: 'failed', fatal: true, error: error?.message || 'The request failed' };
  }
  await wait(30);

  const after = flattenItems(applicationOf(getState, collectionUid)?.items || []).find((candidate) => candidate.uid === item.uid);
  // A plain path in the body is read from the response itself; anything else is what the pipeline evaluated.
  const fromBody = {};
  extractions.forEach((extraction) => {
    const plain = bodyPathOf(extraction.expression);
    const path = plain && extraction.where ? pathToItem(after?.response, plain, extraction.where, flowVariables) : plain;
    const value = path ? readBodyPath(after?.response, path) : undefined;
    if (value !== undefined && value !== null) fromBody[extraction.name] = value;
  });
  const rest = extractions.filter((extraction) => !extraction.where && !(extraction.name in fromBody));
  const variables = rest.length ? await waitForVariables(getState, collectionUid, rest.map((extraction) => extraction.name)) : {};
  const extracted = { ...fromBody, ...Object.fromEntries(rest.filter((extraction) => extraction.name in variables).map((extraction) => [extraction.name, variables[extraction.name]])) };
  publishVariables(dispatch, getState, collectionUid, { ...flowVariables, ...extracted });
  const missing = extractions.filter((extraction) => !(extraction.name in extracted));

  const fatal = fatalErrorOf(after) || (missing.length ? missing.map((extraction) => explainMissing(extraction, after?.response, flowVariables)).join('\n') : null);
  const error = fatal || testFailureOf(after);
  return {
    status: error ? 'failed' : 'passed',
    fatal: Boolean(fatal),
    error,
    httpStatus: after?.response?.status,
    exit: String(after?.response?.status),
    failedExit: after?.response?.status >= 400,
    statusText: after?.response?.statusText,
    duration: after?.response?.duration ?? Date.now() - startedAt,
    extracted,
    response: responseOf(after?.response)
  };
};

// The edge of the status that came back, else the one of 'other'.
const nextEdge = (flow, node, exit) => {
  const leaving = flow.edges.filter((edge) => edge.source === node.id);
  return leaving.find((edge) => edge.sourceHandle === exit) || leaving.find((edge) => edge.sourceHandle === OTHER_STATUS) || null;
};

// The request nothing leads to, the leftmost first.
const startNodeOf = (flow) => flow.nodes
  .filter((node) => !flow.edges.some((edge) => edge.target === node.id))
  .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0] || null;

/**
 * Runs a flow from its first request, following the edge of the status each response comes back with.
 * `onNode(nodeId, result)` reports progress; `shouldStop()` is checked between requests. A flow with a `timeout` (seconds)
 * is a session of that length: when it is over the request in flight is cancelled and the flow is shut down.
 * Resolves with { status: 'passed' | 'failed' | 'stopped', message, results } where results maps a node id to its last result.
 */
export const runFlow = (flow, collectionUid, options) => async (dispatch, getState) => {
  const control = { cancelled: false, sockets: {} };
  try {
    return await runFlowSteps(flow, collectionUid, options, control, dispatch, getState);
  } finally {
    // sockets a node kept open do not outlive the flow
    await Promise.all(Object.keys(control.sockets).map((uid) => closeWsConnection(uid).catch(() => {})));
  }
};

const runFlowSteps = async (flow, collectionUid, { onNode = () => {}, shouldStop = () => false } = {}, control, dispatch, getState) => {
  const results = {};
  const report = (node, result) => {
    results[node.id] = result;
    onNode(node.id, result);
  };

  const first = startNodeOf(flow);
  if (!first) return { status: 'failed', message: flow.nodes.length ? 'Every request has a connection leading to it, so there is no first one' : 'Add a request to the flow', results };

  const flowVariables = {};
  const startedAt = Date.now();
  const timeLeft = () => (flow.timeout ? flow.timeout * 1000 - (Date.now() - startedAt) : Infinity);
  const isWsNode = (candidate) => findRequestByPath(applicationOf(getState, collectionUid), candidate.requestPath)?.type === 'ws-request';
  const timedOut = (message) => ({ status: 'failed', message, results });
  const flowTimedOut = () => timedOut(`Timed out after ${flow.timeout} s: the flow was shut down`);
  let failure = null;
  // branches that run beside the main one: a socket kept open listens for a message and goes on from its RECEIVED when one comes
  const branches = [];

  // The node that keeps its socket open, with a RECEIVED connection: it listens in the background until the main branch is over
  // (and then as long as the node waits), and when a message holds what the node expects, the flow goes on from RECEIVED beside the main branch.
  const listen = async (node) => {
    const item = findRequestByPath(applicationOf(getState, collectionUid), node.requestPath);
    const kept = control.sockets[item.uid];
    delete control.sockets[item.uid];
    const expected = fillVariables(node.expect || '', flowVariables);
    const waitMs = node.timeout ? node.timeout * 1000 : WS_DEFAULT_WAIT;
    const current = () => currentItem(getState, collectionUid, item.uid)?.response;
    let found = null;
    while (!control.cancelled && !found && timeLeft() > 0) {
      collectIncoming(current(), kept.startedAt, kept.received);
      found = kept.received.find((entry) => String(entry.message).includes(expected)) || null;
      if (found || current()?.status === 'CLOSED' || current()?.isError || (control.mainDoneAt && Date.now() >= control.mainDoneAt + waitMs)) break;
      await wait(50);
    }
    try {
      if (!found) return null;
      const response = { status: 'RECEIVED', statusText: '', headers: current()?.headers, data: parseMessage(found.message), duration: Date.now() - kept.startedAt };
      const extractions = node.extractions.filter((extraction) => extraction.name && extraction.expression);
      const result = { ...socketResult('RECEIVED', response, extractions, collectionUid, dispatch, getState, flowVariables), via: 'CONNECTED' };
      Object.assign(flowVariables, result.extracted);
      report(node, result);
      if (result.fatal) {
        failure = failure || { node, error: result.error };
        return { status: 'failed', message: result.error, results };
      }
      const edge = nextEdge(flow, node, 'RECEIVED');
      return edge ? await walk(flow.nodes.find((candidate) => candidate.id === edge.target), 'RECEIVED') : null;
    } finally {
      await closeWsConnection(item.uid).catch(() => {});
    }
  };

  // Follows the edges from `node`; resolves with the result of the flow when something ends it (a stop, a timeout, a fatal error), else null.
  const walk = async (first, firstVia) => {
    let node = first;
    let via = firstVia;
    for (let runs = 0; node; runs++) {
      if (shouldStop()) return { status: 'stopped', message: 'Stopped', results };
      if (timeLeft() <= 0) return flowTimedOut();
      if (runs >= MAX_NODE_RUNS) return { status: 'failed', message: `Stopped after ${MAX_NODE_RUNS} requests: the flow goes round in a loop`, results };

      report(node, { status: 'running', via });
      // a WebSocket node with a RECEIVED connection keeps its socket open and listens, while the flow goes on
      const keepOpen = isWsNode(node) && flow.edges.some((candidate) => candidate.source === node.id && candidate.sourceHandle === 'RECEIVED');
      const outcome = await withDeadline(runNode({ ...node, keepOpen }, collectionUid, dispatch, getState, flowVariables, control), Math.min(timeLeft(), node.timeout && !isWsNode(node) ? node.timeout * 1000 : Infinity));
      if (outcome === TIMED_OUT) {
        control.cancelled = true;
        const application = applicationOf(getState, collectionUid);
        const item = findRequestByPath(application, node.requestPath);
        if (item?.cancelTokenUid) await dispatch(cancelRequest(item.cancelTokenUid, item, application));
        // the session over, or the request took longer than the timeout of its own
        const ownLimit = timeLeft() > 0;
        report(node, { status: 'failed', fatal: true, error: ownLimit ? `Timed out after ${node.timeout} s` : 'Timed out', via });
        return ownLimit ? timedOut(`A request took more than ${node.timeout} s: the flow was shut down`) : flowTimedOut();
      }
      const result = { ...outcome, via };
      Object.assign(flowVariables, result.extracted);
      const edge = result.fatal ? null : nextEdge(flow, node, result.exit);
      const endedOnError = !edge && result.failedExit === true;
      report(node, endedOnError ? { ...result, status: 'failed', error: result.error || `Ended with status ${result.exit}` } : result);

      if (result.status === 'failed' && !failure) failure = { node, error: result.error };
      if (endedOnError && !failure) failure = { node, error: `Ended with status ${result.exit}` };
      if (result.fatal) return { status: 'failed', message: result.error, results };

      if (keepOpen && result.exit === 'CONNECTED') {
        branches.push(listen(node));
      }
      via = edge ? edge.sourceHandle : null;
      node = edge ? flow.nodes.find((candidate) => candidate.id === edge.target) || null : null;
    }
    return null;
  };

  let ended = await walk(first, null);
  control.mainDoneAt = Date.now();
  if (ended) control.cancelled = true;
  // the listeners may start more of them, so the list is taken again until none is left
  while (branches.length) {
    const outcomes = await Promise.all(branches.splice(0));
    ended = ended || outcomes.find(Boolean) || null;
    if (ended) control.cancelled = true;
  }
  if (ended) return ended;

  return failure
    ? { status: 'failed', message: failure.error, results }
    : { status: 'passed', message: 'All requests passed', results };
};
