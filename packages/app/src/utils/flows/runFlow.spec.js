import { runFlow } from './runFlow';

const mockSendRequest = jest.fn();
jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  sendRequest: (...args) => mockSendRequest(...args)
}));

const request = (name, extra = {}) => ({
  uid: `uid-${name}`,
  type: 'http-request',
  name,
  pathname: `/apps/Shop/${name}.yml`,
  request: { method: 'GET', url: `{{baseUrl}}/${name}`, vars: { res: [] } },
  ...extra
});

const makeStore = (items) => {
  const state = { collections: { collections: [{ uid: 'app-1', pathname: '/apps/Shop', items, runtimeVariables: {} }] } };
  const dispatch = (action) => (typeof action === 'function' ? action(dispatch, () => state) : action);
  return { state, dispatch, application: state.collections.collections[0] };
};

// The pipeline answers with a response and sets the variables the step asked for.
const respondWith = (store, { status = 200, variables = {} } = {}) => {
  mockSendRequest.mockImplementation((sent) => async () => {
    const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
    item.response = { status, statusText: 'x', duration: 12 };
    Object.assign(store.application.runtimeVariables, variables);
  });
};

const flowOf = (...steps) => ({ id: 'f1', name: 'Flow', steps: steps.map((step, index) => ({ id: `s${index}`, extractions: [], ...step })) });

describe('runFlow', () => {
  beforeEach(() => mockSendRequest.mockReset());

  it('sends the extractions as post-response variables and reports the values it got', async () => {
    const store = makeStore([request('login')]);
    respondWith(store, { variables: { token: 'abc' } });

    const results = await store.dispatch(runFlow(flowOf({ requestPath: 'login.yml', extractions: [{ name: 'token', expression: 'res.body.token' }] }), 'app-1'));

    const sent = mockSendRequest.mock.calls[0][0];
    expect(sent.request.vars.res).toEqual([expect.objectContaining({ name: 'token', value: 'res.body.token', enabled: true })]);
    expect(results[0]).toMatchObject({ status: 'passed', httpStatus: 200, extracted: { token: 'abc' } });
  });

  it('runs the steps in order, the later ones seeing the variables of the earlier', async () => {
    const store = makeStore([request('login'), request('info')]);
    const seen = [];
    mockSendRequest.mockImplementation((sent) => async () => {
      seen.push({ uid: sent.uid, token: store.application.runtimeVariables.token });
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { status: 200 };
      if (sent.uid === 'uid-login') store.application.runtimeVariables.token = 'abc';
    });

    const results = await store.dispatch(runFlow(flowOf(
      { requestPath: 'login.yml', extractions: [{ name: 'token', expression: 'res.body.token' }] },
      { requestPath: 'info.yml' }
    ), 'app-1'));

    expect(seen).toEqual([{ uid: 'uid-login', token: undefined }, { uid: 'uid-info', token: 'abc' }]);
    expect(results.map((result) => result.status)).toEqual(['passed', 'passed']);
  });

  it('stops at the first failing step and skips the rest', async () => {
    const store = makeStore([request('login'), request('info')]);
    respondWith(store, { status: 401 });

    const progress = [];
    const results = await store.dispatch(runFlow(flowOf({ requestPath: 'login.yml' }, { requestPath: 'info.yml' }), 'app-1', { onStep: (index, result) => progress.push([index, result.status]) }));

    expect(results.map((result) => result.status)).toEqual(['failed', 'skipped']);
    expect(results[0].error).toBe('401 x');
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([[0, 'running'], [0, 'failed'], [1, 'skipped']]);
  });

  it('fails a step whose test failed even though the response was fine', async () => {
    const store = makeStore([request('login', { testResults: [{ status: 'fail', description: 'has a token' }] })]);
    respondWith(store);

    const [result] = await store.dispatch(runFlow(flowOf({ requestPath: 'login.yml' }), 'app-1'));

    expect(result).toMatchObject({ status: 'failed', error: 'has a token' });
  });

  it('fails when a request of the flow no longer exists, or is not an http request', async () => {
    const store = makeStore([request('stream', { type: 'grpc-request' })]);
    respondWith(store);

    const results = await store.dispatch(runFlow(flowOf({ requestPath: 'gone.yml' }, { requestPath: 'stream.yml' }), 'app-1'));

    expect(results[0]).toMatchObject({ status: 'failed', error: 'Request not found: gone.yml' });
    expect(results[1].status).toBe('skipped');
    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('uses the saved request rather than an unsaved draft', async () => {
    const store = makeStore([request('login', { draft: { request: { url: 'changed' } } })]);
    respondWith(store);

    await store.dispatch(runFlow(flowOf({ requestPath: 'login.yml' }), 'app-1'));

    expect(mockSendRequest.mock.calls[0][0].draft).toBeUndefined();
  });

  it('skips the remaining steps once asked to stop', async () => {
    const store = makeStore([request('login'), request('info')]);
    respondWith(store);
    let stop = false;

    const results = await store.dispatch(runFlow(flowOf({ requestPath: 'login.yml' }, { requestPath: 'info.yml' }), 'app-1', {
      onStep: (index, result) => { if (result.status === 'passed') stop = true; },
      shouldStop: () => stop
    }));

    expect(results.map((result) => result.status)).toEqual(['passed', 'skipped']);
  });

  it('fails a step that could not take a value it was asked for', async () => {
    const store = makeStore([request('login')]);
    respondWith(store);

    const [result] = await store.dispatch(runFlow(flowOf({ requestPath: 'login.yml', extractions: [{ name: 'token', expression: 'res.body.nope' }] }), 'app-1'));

    expect(result).toMatchObject({ status: 'failed', error: 'Could not take token from the response' });
  }, 10000);
});
