import { useSyncExternalStore } from 'react';
import { v4 as uuid } from 'uuid';
import { flattenItems, isItemARequest } from 'utils/collections/index';

// A flow is an ordered list of requests of one application. After a step runs, values taken from its
// response become variables ({{name}}) for the steps after it.
//   Flow = { id, name, steps: [{ id, requestPath, extractions: [{ name, expression }] }] }
// Flows belong to this machine: they live in browser storage, keyed by the application path.

export const FLOW_REQUEST_TYPES = ['http-request', 'graphql-request'];

// Drag and drop: a request of the palette is dropped into a flow, a step is dropped to move it.
export const FLOW_DRAG = { request: 'flow-request', step: 'flow-step' };

const STORAGE_KEY = 'tern.flows';
const NO_FLOWS = [];

const normalizePath = (value) => String(value || '').replaceAll('\\', '/').replace(/\/+$/, '');
const applicationKey = (application) => normalizePath(application?.pathname).toLowerCase();

const text = (value) => (typeof value === 'string' ? value : '');

const sanitizeFlow = (flow) => ({
  id: text(flow?.id) || uuid(),
  name: text(flow?.name) || 'Untitled flow',
  steps: (Array.isArray(flow?.steps) ? flow.steps : []).map((step) => ({
    id: text(step?.id) || uuid(),
    requestPath: text(step?.requestPath),
    extractions: (Array.isArray(step?.extractions) ? step.extractions : []).map((extraction) => ({
      name: text(extraction?.name),
      expression: text(extraction?.expression)
    }))
  }))
});

const readStoredFlows = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return Object.fromEntries(Object.entries(stored).map(([key, flows]) => [key, Array.isArray(flows) ? flows.map(sanitizeFlow) : []]));
  } catch {
    return {};
  }
};

let flowsByApplication = readStoredFlows();
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const update = (application, change) => {
  const key = applicationKey(application);
  flowsByApplication = { ...flowsByApplication, [key]: change(flowsByApplication[key] || NO_FLOWS) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flowsByApplication));
  } catch {
    // storage can be blocked; flows then only last until the app closes
  }
  listeners.forEach((listener) => listener());
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
