import { useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';
import { v4 as uuid } from 'uuid';
import { flattenItems, isItemARequest } from 'utils/collections/index';

// A flow is a graph of requests of one application. A node sends a request; the status of its response picks
// the edge to follow (an edge leaves a node from the handle of a status, or from 'other'). Values taken from a
// response become variables ({{name}}) for the nodes after it.
//   Flow = { id, name, nodes: [{ id, requestPath, position: { x, y }, inputs: { params, headers, body }, extractions: [{ name, expression }] }],
//            edges: [{ id, source, sourceHandle, target }] }
//   inputs.params / inputs.headers map a name to the value to send instead of the saved one; inputs.body is a JSON text or null.
// Flows are saved with their application, in its flows.json.

export const FLOW_REQUEST_TYPES = ['http-request', 'graphql-request'];

// Drag and drop: a request of the palette is dropped on the canvas.
export const FLOW_DRAG = { request: 'flow-request' };

export const OTHER_STATUS = 'other';

const STORAGE_KEY = 'tern.flows';
const NO_FLOWS = [];
const NODE_SPACING = 300;

const normalizePath = (value) => String(value || '').replaceAll('\\', '/').replace(/\/+$/, '');
const applicationKey = (application) => normalizePath(application?.pathname).toLowerCase();

const text = (value) => (typeof value === 'string' ? value : '');
const coordinate = (value) => (Number.isFinite(value) ? value : 0);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const textMap = (value) => Object.fromEntries(Object.entries(isRecord(value) ? value : {}).filter(([, entry]) => typeof entry === 'string'));

const sanitizeNode = (node) => ({
  id: text(node?.id) || uuid(),
  requestPath: text(node?.requestPath),
  position: { x: coordinate(node?.position?.x), y: coordinate(node?.position?.y) },
  inputs: {
    params: textMap(node?.inputs?.params),
    headers: textMap(node?.inputs?.headers),
    body: typeof node?.inputs?.body === 'string' ? node.inputs.body : null
  },
  extractions: (Array.isArray(node?.extractions) ? node.extractions : []).map((extraction) => ({
    name: text(extraction?.name),
    expression: text(extraction?.expression)
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

/** The statuses a request documents (from its examples, which come with the OpenAPI spec), plus 'other' for the rest. */
export const getRequestStatuses = (item) => {
  const documented = [...new Set((item?.examples || []).map((example) => Number(example?.response?.status)).filter((status) => Number.isInteger(status) && status > 0))]
    .sort((a, b) => a - b)
    .map(String);
  return [...(documented.length ? documented : ['200']), OTHER_STATUS];
};
