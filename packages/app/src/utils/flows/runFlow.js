import { findCollectionByUid, flattenItems } from 'utils/collections/index';
import { sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import { findRequestByPath } from './index';

const RESULT_LISTS = ['assertionResults', 'testResults', 'preRequestTestResults', 'postResponseTestResults'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const applicationOf = (getState, collectionUid) => findCollectionByUid(getState().collections.collections, collectionUid);

const failureOf = (item) => {
  const response = item?.response;
  if (!response) return 'No response';
  if (response.isError || response.status === 'Error') return response.error || 'The request failed';
  if (typeof response.status === 'number' && response.status >= 400) return `${response.status} ${response.statusText || ''}`.trim();
  const failed = RESULT_LISTS.flatMap((list) => item[list] || []).find((result) => result.status === 'fail');
  if (failed) return failed.error || failed.description || 'A test or assertion failed';
  return null;
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

const runStep = async (step, collectionUid, dispatch, getState) => {
  const item = findRequestByPath(applicationOf(getState, collectionUid), step.requestPath);
  if (!item) return { status: 'failed', error: `Request not found: ${step.requestPath}` };

  const extractions = step.extractions.filter((extraction) => extraction.name && extraction.expression);
  // The saved request, not an unsaved draft, so a run can be repeated; the extractions ride along as
  // post-response variables, which the request pipeline already evaluates.
  const { draft, ...saved } = item;
  const request = {
    ...saved,
    request: {
      ...saved.request,
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
    return { status: 'failed', error: error?.message || 'The request failed' };
  }
  await wait(30);

  const after = flattenItems(applicationOf(getState, collectionUid)?.items || []).find((candidate) => candidate.uid === item.uid);
  const variables = await waitForVariables(getState, collectionUid, extractions.map((extraction) => extraction.name));
  const extracted = Object.fromEntries(extractions.filter((extraction) => extraction.name in variables).map((extraction) => [extraction.name, variables[extraction.name]]));
  const missing = extractions.filter((extraction) => !(extraction.name in extracted)).map((extraction) => extraction.name);

  const error = failureOf(after) || (missing.length ? `Could not take ${missing.join(', ')} from the response` : null);
  return {
    status: error ? 'failed' : 'passed',
    error,
    httpStatus: after?.response?.status,
    duration: after?.response?.duration ?? Date.now() - startedAt,
    extracted
  };
};

/**
 * Runs the steps of a flow one after another and stops at the first one that fails.
 * `onStep(index, result)` reports progress; `shouldStop()` is checked between steps.
 */
export const runFlow = (flow, collectionUid, { onStep = () => {}, shouldStop = () => false } = {}) => async (dispatch, getState) => {
  let stopped = false;
  const results = [];
  for (let index = 0; index < flow.steps.length; index++) {
    if (stopped || shouldStop()) {
      stopped = true;
      results.push({ status: 'skipped' });
      onStep(index, results[index]);
      continue;
    }
    onStep(index, { status: 'running' });
    results.push(await runStep(flow.steps[index], collectionUid, dispatch, getState));
    onStep(index, results[index]);
    if (results[index].status === 'failed') stopped = true;
  }
  return results;
};
