import { useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';
import { v4 as uuid } from 'uuid';
import { flattenItems, isItemARequest } from 'utils/collections/index';

// A flow is a graph of requests of one application. A node sends a request; the status of its response picks
// the edge to follow (an edge leaves a node from the handle of a status, or from 'other'). Values taken from a
// response become variables ({{name}}) for the nodes after it.
//   Flow = { id, name, timeout, nodes: [{ id, requestPath, timeout?, position: { x, y }, inputs: { params, headers, body }, statuses: ['404', ...], extractions: [{ name, expression, where?: [{ field, op?, value }] }] }],
//            edges: [{ id, source, sourceHandle, target }] }
//   timeout is the length in seconds of the session the flow runs in: after it the flow is shut down. A flow saved without one gets the default.
//   A WebSocket node may have send (the messages to send in order, instead of the one of the request) and expect (the text a message
//   received must hold before the node leaves through RECEIVED); its timeout is how long it waits for it.
//   A node may have a timeout of its own (seconds): its request is cancelled and the flow shut down if it takes longer.
//   statuses are the ones the user added to a node, besides those its request documents; hidden are the documented ones
//   (or 'other') the user took away because nothing is connected to them.
//   where picks the item of a list: the expression holds [0] for the list, and the first item that meets every condition (its field is, differs from or contains value, by op) is used instead.
//   inputs.params / inputs.headers map a name to the value to send instead of the saved one; inputs.body is a JSON text or null.
// Flows are saved with their application, in its flows.json.

export const FLOW_REQUEST_TYPES = ['http-request', 'graphql-request', 'grpc-request', 'ws-request'];

export const FLOW_REQUEST_TYPE_LABELS = { 'http-request': 'HTTP', 'graphql-request': 'GraphQL', 'grpc-request': 'gRPC', 'ws-request': 'WebSocket' };

// A gRPC call ends with one of these, a WebSocket request with one of the others: they are the exits of such a node,
// as the status code is for an HTTP one.
export const GRPC_STATUSES = ['OK', 'CANCELLED', 'UNKNOWN', 'INVALID_ARGUMENT', 'DEADLINE_EXCEEDED', 'NOT_FOUND', 'ALREADY_EXISTS', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'ABORTED', 'OUT_OF_RANGE', 'UNIMPLEMENTED', 'INTERNAL', 'UNAVAILABLE', 'DATA_LOSS', 'UNAUTHENTICATED'];
export const WS_STATUSES = ['RECEIVED', 'CONNECTED', 'TIMEOUT', 'CLOSED', 'ERROR'];

/** Whether a text is an exit a node can have: an HTTP status code, a gRPC status or a WebSocket outcome. */
export const isStatusKey = (status) => /^[1-5]\d\d$/.test(status) || GRPC_STATUSES.includes(status) || WS_STATUSES.includes(status);

// Drag and drop: a request of the palette is dropped on the canvas.
export const FLOW_DRAG = { request: 'flow-request' };

export const OTHER_STATUS = 'other';

// Seconds a flow may run before it is shut down.
export const DEFAULT_FLOW_TIMEOUT = 60;

// How the field of an item of a list is compared with the value; a condition without op is 'equals'.
export const WHERE_OPERATORS = { equals: 'equals', differs: 'differs from', contains: 'contains' };

const STORAGE_KEY = 'tern.flows';
const NO_FLOWS = [];
const NODE_SPACING = 300;

const normalizePath = (value) => String(value || '').replaceAll('\\', '/').replace(/\/+$/, '');
const applicationKey = (application) => normalizePath(application?.pathname).toLowerCase();

const text = (value) => (typeof value === 'string' ? value : '');
const coordinate = (value) => (Number.isFinite(value) ? value : 0);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const textMap = (value) => Object.fromEntries(Object.entries(isRecord(value) ? value : {}).filter(([, entry]) => typeof entry === 'string'));

// The conditions that tell an item of a list; a flow saved with a single condition (an object) reads as a list of one.
const sanitizeConditions = (where) => (Array.isArray(where) ? where : [where])
  .filter((condition) => text(condition?.field))
  .map((condition) => ({
    field: condition.field,
    ...(condition.op in WHERE_OPERATORS && condition.op !== 'equals' ? { op: condition.op } : {}),
    value: text(condition.value)
  }));

// The messages a WebSocket node sends, in order; an empty one is not worth sending.
const sanitizeMessages = (messages) => (Array.isArray(messages) ? messages.filter((message) => typeof message === 'string') : []);

const sanitizeNode = (node) => ({
  id: text(node?.id) || uuid(),
  requestPath: text(node?.requestPath),
  position: { x: coordinate(node?.position?.x), y: coordinate(node?.position?.y) },
  inputs: {
    params: textMap(node?.inputs?.params),
    headers: textMap(node?.inputs?.headers),
    body: typeof node?.inputs?.body === 'string' ? node.inputs.body : null
  },
  ...(Number.isInteger(node?.timeout) && node.timeout > 0 ? { timeout: node.timeout } : {}),
  ...(sanitizeMessages(node?.send).length ? { send: sanitizeMessages(node.send) } : {}),
  ...(text(node?.expect) ? { expect: node.expect } : {}),
  statuses: [...new Set((Array.isArray(node?.statuses) ? node.statuses : []).map(String).filter(isStatusKey))].sort(),
  hidden: [...new Set((Array.isArray(node?.hidden) ? node.hidden : []).map(String).filter((status) => isStatusKey(status) || status === OTHER_STATUS))].sort(),
  extractions: (Array.isArray(node?.extractions) ? node.extractions : []).map((extraction) => ({
    name: text(extraction?.name),
    expression: text(extraction?.expression),
    ...(sanitizeConditions(extraction?.where).length ? { where: sanitizeConditions(extraction.where) } : {})
  }))
});

// A status leaves a node through one edge only: the last one stored for it wins.
const sanitizeEdges = (edges, nodes) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const bySource = new Map();
  (Array.isArray(edges) ? edges : []).forEach((edge) => {
    const source = text(edge?.source);
    const target = text(edge?.target);
    const sourceHandle = text(edge?.sourceHandle);
    if (!nodeIds.has(source) || !nodeIds.has(target) || !sourceHandle) return;
    bySource.set(`${source}/${sourceHandle}`, { id: text(edge?.id) || uuid(), source, sourceHandle, target });
  });
  return [...bySource.values()];
};

// Flows made of ordered steps become a row of nodes, each leading to the next one on a 200.
// shortcut: a step whose request answers with another 2xx (201, ...) leaves from a handle nothing is connected to, so the
// flow ends there; reconnect it by hand.
const nodesFromSteps = (steps) => {
  const nodes = steps.map((step, index) => ({ ...sanitizeNode(step), position: { x: index * NODE_SPACING, y: 0 } }));
  const edges = nodes.slice(1).map((node, index) => ({ id: uuid(), source: nodes[index].id, sourceHandle: '200', target: node.id }));
  return { nodes, edges };
};

const sanitizeFlow = (flow) => {
  const { nodes, edges } = Array.isArray(flow?.nodes) || !Array.isArray(flow?.steps)
    ? { nodes: (Array.isArray(flow?.nodes) ? flow.nodes : []).map(sanitizeNode), edges: flow?.edges }
    : nodesFromSteps(flow.steps);
  return {
    id: text(flow?.id) || uuid(),
    name: text(flow?.name) || 'Untitled flow',
    timeout: Number.isInteger(flow?.timeout) && flow.timeout > 0 ? flow.timeout : DEFAULT_FLOW_TIMEOUT,
    nodes,
    edges: sanitizeEdges(edges, nodes)
  };
};

// Flows kept in browser storage by older versions, per application key.
const readLegacyFlows = (key) => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return Array.isArray(stored[key]) ? stored[key].map(sanitizeFlow) : [];
  } catch {
    return [];
  }
};

const removeLegacyFlows = (key) => {
  try {
    const rest = Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}).filter(([entryKey]) => entryKey !== key));
    if (Object.keys(rest).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean when storage is blocked
  }
};

let flowsByApplication = {};
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Flows live in <application folder>/flows.json. An application is loaded once; until then, and when its file cannot
// be read, it has no flows and nothing is written, so a file that is there is never overwritten by an empty list.
const SAVE_DELAY_MS = 300;
const loaded = new Map(); // key -> 'loading' | 'ready' | 'failed'
const pathOf = new Map(); // key -> the application folder, as the main process wants it
const saveTimers = new Map();

const reportFailure = (action, error) => {
  console.error(`Flows: could not ${action}`, error);
  toast.error(`Could not ${action} the flows of this application`);
};

const writeNow = (key) => {
  clearTimeout(saveTimers.get(key));
  saveTimers.delete(key);
  return window.ipcRenderer.invoke('renderer:write-flows', pathOf.get(key), flowsByApplication[key] || NO_FLOWS)
    .catch((error) => reportFailure('save', error));
};

const scheduleWrite = (key) => {
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(() => writeNow(key), SAVE_DELAY_MS));
};

window.addEventListener('beforeunload', () => [...saveTimers.keys()].forEach(writeNow));

const load = (application) => {
  const key = applicationKey(application);
  if (!key || loaded.has(key)) return;
  loaded.set(key, 'loading');
  pathOf.set(key, application.pathname);

  window.ipcRenderer.invoke('renderer:read-flows', application.pathname).then((stored) => {
    if (stored) {
      flowsByApplication = { ...flowsByApplication, [key]: stored.map(sanitizeFlow) };
    } else {
      // No file yet: flows kept in browser storage by older versions move into one.
      const legacy = readLegacyFlows(key);
      if (legacy.length) {
        flowsByApplication = { ...flowsByApplication, [key]: legacy };
        writeNow(key).then(() => removeLegacyFlows(key));
      }
    }
    loaded.set(key, 'ready');
    notify();
  }).catch((error) => {
    loaded.set(key, 'failed');
    reportFailure('read', error);
  });
};

const update = (application, change) => {
  const key = applicationKey(application);
  if (loaded.get(key) !== 'ready') return;
  flowsByApplication = { ...flowsByApplication, [key]: change(flowsByApplication[key] || NO_FLOWS) };
  scheduleWrite(key);
  notify();
};

export const createFlow = (name) => sanitizeFlow({ name });

export const saveFlow = (application, flow) => update(application, (flows) => {
  const saved = sanitizeFlow(flow);
  return flows.some((existing) => existing.id === saved.id)
    ? flows.map((existing) => (existing.id === saved.id ? saved : existing))
    : [...flows, saved];
});

export const deleteFlow = (application, flowId) => update(application, (flows) => flows.filter((flow) => flow.id !== flowId));

export const useFlows = (application) => {
  load(application);
  const all = useSyncExternalStore(subscribe, () => flowsByApplication);
  return all[applicationKey(application)] || NO_FLOWS;
};

/** Path of a request inside its application ('/' separated), which keeps working after a restart or a move. */
export const getRequestPath = (application, item) => {
  const base = normalizePath(application?.pathname);
  const target = normalizePath(item?.pathname);
  return target.toLowerCase().startsWith(`${base.toLowerCase()}/`) ? target.slice(base.length + 1) : '';
};

export const getFlowRequests = (application) => flattenItems(application?.items || [])
  .filter((item) => isItemARequest(item) && FLOW_REQUEST_TYPES.includes(item.type))
  .map((item) => ({ item, requestPath: getRequestPath(application, item) }))
  .filter(({ requestPath }) => requestPath);

export const findRequestByPath = (application, requestPath) => {
  const wanted = normalizePath(requestPath).toLowerCase();
  return getFlowRequests(application).find((entry) => entry.requestPath.toLowerCase() === wanted)?.item || null;
};

/** The nodes whose responses can reach this one: every node with a path of connections leading to it. */
export const getUpstreamNodes = (flow, nodeId) => {
  const seen = new Set();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift();
    flow.edges
      .filter((edge) => edge.target === current && edge.source !== nodeId && !seen.has(edge.source))
      .forEach((edge) => {
        seen.add(edge.source);
        queue.push(edge.source);
      });
  }
  return flow.nodes.filter((node) => seen.has(node.id));
};

const VARIABLE_NAME = /^[A-Za-z0-9_.-]+$/;

/**
 * Why a value shared under this name is not allowed, or null: letters, digits, _ - and . only, and no two shared values
 * with one name, nor one named like a variable of the environment (`reserved` lists those names).
 */
export const getVariableNameProblem = (flow, nodeId, position, name, reserved = []) => {
  if (!name) return null;
  if (!VARIABLE_NAME.test(name)) return 'Use only letters, digits, _ - and . (no spaces or accents)';
  if (reserved.includes(name)) return `"${name}" is already a variable of the environment`;
  const clash = flow.nodes
    .flatMap((node) => node.extractions.map((extraction, index) => ({ node, index, name: extraction.name })))
    .find((entry) => entry.name === name && !(entry.node.id === nodeId && entry.index === position));
  if (!clash) return null;
  return `A value named "${name}" is already shared ${clash.node.id === nodeId ? 'by this request' : 'by another request'}`;
};

/** The first problem with the names of the shared values of a flow, or null. */
export const getFlowNameProblem = (flow, reserved = []) => {
  for (const node of flow.nodes) {
    for (let index = 0; index < node.extractions.length; index++) {
      const problem = getVariableNameProblem(flow, node.id, index, node.extractions[index].name, reserved);
      if (problem) return problem;
    }
  }
  return null;
};

/** A variable name not used yet in the flow: 'token', then 'token_2', 'token_3'... */
export const freeVariableName = (flow, base, reserved = []) => {
  const taken = new Set([...reserved, ...flow.nodes.flatMap((node) => node.extractions.map((extraction) => extraction.name))]);
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}_${counter}`)) counter += 1;
  return `${base}_${counter}`;
};

/** How a status is coloured: 2xx 'ok' (green), 3xx 'redirect' (yellow), 4xx and 5xx 'error' (red), the rest 'other' (grey). */
export const getStatusKind = (status) => {
  if (status === 'OK' || status === 'RECEIVED' || status === 'CONNECTED') return 'ok';
  if (GRPC_STATUSES.includes(status) || WS_STATUSES.includes(status)) return 'error';
  const code = Number(status);
  if (status === OTHER_STATUS || !Number.isFinite(code)) return 'other';
  if (code >= 200 && code < 300) return 'ok';
  if (code >= 300 && code < 400) return 'redirect';
  if (code >= 400 && code < 600) return 'error';
  return 'other';
};

/** The path of the URL a request calls, without host or query: '{{baseUrl}}/users/{{id}}?x=1' gives '/users/{{id}}'. */
export const getRequestUrlPath = (item) => {
  const path = String(item?.request?.url || '')
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '')
    .replace(/^\{\{[^}]*\}\}/, '')
    .split(/[?#]/)[0];
  return path || '/';
};

/** The statuses a request documents (from its examples, which come with the OpenAPI spec), plus 'other' for the rest; a gRPC or WebSocket request has its own. */
export const getRequestStatuses = (item) => {
  if (item?.type === 'grpc-request') return ['OK', OTHER_STATUS];
  if (item?.type === 'ws-request') return ['RECEIVED', 'CONNECTED', OTHER_STATUS];
  const documented = [...new Set((item?.examples || []).map((example) => Number(example?.response?.status)).filter((status) => Number.isInteger(status) && status > 0))]
    .sort((a, b) => a - b)
    .map(String);
  return [...(documented.length ? documented : ['200']), OTHER_STATUS];
};

/** The text a node can replace in a request: its JSON body, the first message of a gRPC call, the selected message of a WebSocket one; null when there is none to replace. */
export const getBodyText = (item) => {
  const body = item?.request?.body;
  if (body?.mode === 'json') return body.json || '';
  if (body?.mode === 'grpc') return body.grpc?.[0]?.content ?? '';
  if (body?.mode === 'ws') return (body.ws?.find((message) => message.selected) || body.ws?.[0])?.content ?? '';
  return null;
};

/** The text with each {{name}} that has a value in `variables` replaced by it; a name without one stays as written. */
export const fillVariables = (text, variables) => String(text).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (token, name) => (name in variables ? String(variables[name]) : token));

/** The url of a request with the variables that have a value filled in: those of the request first, then the environments'. */
export const getResolvedUrl = (item, environmentValues = []) => {
  const known = Object.fromEntries(environmentValues.filter((entry) => entry.value !== undefined).map((entry) => [entry.name, entry.value]));
  (item?.request?.vars?.req || []).filter((variable) => variable.enabled !== false && variable.name).forEach((variable) => {
    known[variable.name] = variable.value;
  });
  return fillVariables(item?.request?.url || '', known);
};

/** What a request shows as its method and its path: 'GET /users', and 'GRPC /pkg.Service/Method' or 'WS /socket' for the other kinds. */
export const getRequestLabel = (item) => {
  if (item?.type === 'grpc-request') return { method: 'GRPC', path: item.request?.method || getRequestUrlPath(item) };
  if (item?.type === 'ws-request') return { method: 'WS', path: getRequestUrlPath(item) };
  return { method: item?.request?.method || '', path: getRequestUrlPath(item) };
};
