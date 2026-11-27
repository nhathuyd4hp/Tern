import { findCollectionByUid, flattenItems } from 'utils/collections/index';
import isEqual from 'lodash/isEqual';
import { sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import { runtimeVariablesUpdateEvent } from 'providers/ReduxStore/slices/collections';
import { findRequestByPath, OTHER_STATUS, WHERE_OPERATORS } from './index';

const RESULT_LISTS = ['assertionResults', 'testResults', 'preRequestTestResults', 'postResponseTestResults'];
const MAX_NODE_RUNS = 50;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const body = inputs.body === null ? original.body : { ...original.body, mode: 'json', json: inputs.body };
  return { ...original, url, params, headers, body };
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

const fillVariables = (text, variables) => text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (token, name) => (name in variables ? String(variables[name]) : token));

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

const runNode = async (node, collectionUid, dispatch, getState, flowVariables) => {
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
    statusText: after?.response?.statusText,
    duration: after?.response?.duration ?? Date.now() - startedAt,
    extracted,
    response: responseOf(after?.response)
  };
};

// The edge of the status that came back, else the one of 'other'.
const nextEdge = (flow, node, httpStatus) => {
  const leaving = flow.edges.filter((edge) => edge.source === node.id);
  return leaving.find((edge) => edge.sourceHandle === String(httpStatus)) || leaving.find((edge) => edge.sourceHandle === OTHER_STATUS) || null;
};

// The request nothing leads to, the leftmost first.
const startNodeOf = (flow) => flow.nodes
  .filter((node) => !flow.edges.some((edge) => edge.target === node.id))
  .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0] || null;

/**
 * Runs a flow from its first request, following the edge of the status each response comes back with.
 * `onNode(nodeId, result)` reports progress; `shouldStop()` is checked between requests.
 * Resolves with { status: 'passed' | 'failed' | 'stopped', message, results } where results maps a node id to its last result.
 */
export const runFlow = (flow, collectionUid, { onNode = () => {}, shouldStop = () => false } = {}) => async (dispatch, getState) => {
  const results = {};
  const report = (node, result) => {
    results[node.id] = result;
    onNode(node.id, result);
  };

  let node = startNodeOf(flow);
  if (!node) return { status: 'failed', message: flow.nodes.length ? 'Every request has a connection leading to it, so there is no first one' : 'Add a request to the flow', results };

  const flowVariables = {};
  let via = null;
  let failure = null;
  for (let runs = 0; node; runs++) {
    if (shouldStop()) return { status: 'stopped', message: 'Stopped', results };
    if (runs >= MAX_NODE_RUNS) return { status: 'failed', message: `Stopped after ${MAX_NODE_RUNS} requests: the flow goes round in a loop`, results };

    report(node, { status: 'running', via });
    const result = { ...(await runNode(node, collectionUid, dispatch, getState, flowVariables)), via };
    Object.assign(flowVariables, result.extracted);
    const edge = result.fatal ? null : nextEdge(flow, node, result.httpStatus);
    const endedOnError = !edge && typeof result.httpStatus === 'number' && result.httpStatus >= 400;
    report(node, endedOnError ? { ...result, status: 'failed', error: result.error || `Ended with status ${result.httpStatus}` } : result);

    if (result.status === 'failed' && !failure) failure = { node, error: result.error };
    if (endedOnError && !failure) failure = { node, error: `Ended with status ${result.httpStatus}` };
    if (result.fatal) return { status: 'failed', message: result.error, results };

    via = edge ? edge.sourceHandle : null;
    node = edge ? flow.nodes.find((candidate) => candidate.id === edge.target) || null : null;
  }

  return failure
    ? { status: 'failed', message: failure.error, results }
    : { status: 'passed', message: 'All requests passed', results };
};
