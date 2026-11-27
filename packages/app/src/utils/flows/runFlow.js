import { findCollectionByUid, flattenItems } from 'utils/collections/index';
import { sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import { findRequestByPath, OTHER_STATUS } from './index';

const RESULT_LISTS = ['assertionResults', 'testResults', 'preRequestTestResults', 'postResponseTestResults'];
const MAX_NODE_RUNS = 50;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const applicationOf = (getState, collectionUid) => findCollectionByUid(getState().collections.collections, collectionUid);

// A response that never came (or a request that errored) ends the flow; a failed test is reported but the status still picks the way on.
const fatalErrorOf = (item) => {
  const response = item?.response;
  if (!response) return 'No response';
  if (response.isError || response.status === 'Error') return response.error || 'The request failed';
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

const runNode = async (node, collectionUid, dispatch, getState) => {
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
          ...extractions.map((extraction) => ({ uid: `flow-${extraction.name}`, name: extraction.name, value: extraction.expression, enabled: true }))
        ]
      }
    }
  };

  const startedAt = Date.now();
  try {
    await dispatch(sendRequest(request, collectionUid));
  } catch (error) {
    return { status: 'failed', fatal: true, error: error?.message || 'The request failed' };
  }
  await wait(30);

  const after = flattenItems(applicationOf(getState, collectionUid)?.items || []).find((candidate) => candidate.uid === item.uid);
  const variables = await waitForVariables(getState, collectionUid, extractions.map((extraction) => extraction.name));
  const extracted = Object.fromEntries(extractions.filter((extraction) => extraction.name in variables).map((extraction) => [extraction.name, variables[extraction.name]]));
  const missing = extractions.filter((extraction) => !(extraction.name in extracted)).map((extraction) => extraction.name);

  const fatal = fatalErrorOf(after) || (missing.length ? `Could not take ${missing.join(', ')} from the response` : null);
  const error = fatal || testFailureOf(after);
  return {
    status: error ? 'failed' : 'passed',
    fatal: Boolean(fatal),
    error,
    httpStatus: after?.response?.status,
    statusText: after?.response?.statusText,
    duration: after?.response?.duration ?? Date.now() - startedAt,
    extracted
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

  let via = null;
  let failure = null;
  for (let runs = 0; node; runs++) {
    if (shouldStop()) return { status: 'stopped', message: 'Stopped', results };
    if (runs >= MAX_NODE_RUNS) return { status: 'failed', message: `Stopped after ${MAX_NODE_RUNS} requests: the flow goes round in a loop`, results };

    report(node, { status: 'running', via });
    const result = { ...(await runNode(node, collectionUid, dispatch, getState)), via };
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
