import { runFlow } from './runFlow';

const mockSendRequest = jest.fn();
const mockCancelRequest = jest.fn(() => () => Promise.resolve());
const mockCloseWs = jest.fn(() => Promise.resolve());
jest.mock('utils/network', () => ({ closeWsConnection: (...args) => mockCloseWs(...args) }));
jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  sendRequest: (...args) => mockSendRequest(...args),
  cancelRequest: (...args) => mockCancelRequest(...args)
}));

const request = (name, extra = {}) => ({
  uid: `uid-${name}`,
  type: 'http-request',
  name,
  pathname: `/apps/Shop/${name}.yml`,
  request: { method: 'GET', url: `{{baseUrl}}/${name}`, params: [], headers: [], body: { mode: 'none' }, vars: { res: [] } },
  ...extra
});

const makeStore = (items) => {
  const state = { collections: { collections: [{ uid: 'app-1', pathname: '/apps/Shop', items, runtimeVariables: {} }] } };
  const dispatch = (action) => {
    if (typeof action === 'function') return action(dispatch, () => state);
    if (action?.type === 'collections/runtimeVariablesUpdateEvent') {
      state.collections.collections.find((app) => app.uid === action.payload.collectionUid).runtimeVariables = action.payload.runtimeVariables;
    }
    return action;
  };
  return { state, dispatch, application: state.collections.collections[0] };
};

// The pipeline answers each request with its status (200 unless told otherwise) and sets the variables it was asked for.
const respondWith = (store, { statuses = {}, variables = {} } = {}) => {
  mockSendRequest.mockImplementation((sent) => async () => {
    const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
    item.response = { status: statuses[sent.name] ?? 200, statusText: 'x', duration: 12, size: 7, headers: { 'content-type': 'application/json' }, data: { token: 'abc' } };
    Object.assign(store.application.runtimeVariables, variables);
  });
};

const node = (name, extra = {}) => ({
  id: name,
  requestPath: `${name}.yml`,
  position: { x: 0, y: 0 },
  inputs: { params: {}, headers: {}, body: null },
  extractions: [],
  ...extra
});
const edge = (source, sourceHandle, target) => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });
const flowOf = (nodes, edges = []) => ({ id: 'f1', name: 'Flow', nodes: nodes.map((entry, index) => ({ ...entry, position: { x: index * 300, y: 0 } })), edges });

const ranOrder = () => mockSendRequest.mock.calls.map(([sent]) => sent.name);

describe('runFlow', () => {
  beforeEach(() => mockSendRequest.mockReset());

  it('sends the extractions as post-response variables and reports the values it got', async () => {
    const store = makeStore([request('login')]);
    respondWith(store, { variables: { token: 'abc' } });
    const progress = [];

    const outcome = await store.dispatch(runFlow(flowOf([node('login', { extractions: [{ name: 'token', expression: 'res.body.token' }] })]), 'app-1', {
      onNode: (id, result) => progress.push([id, result.status])
    }));

    const sent = mockSendRequest.mock.calls[0][0];
    expect(sent.request.vars.res).toEqual([expect.objectContaining({ name: 'token', value: 'res.body.token', enabled: true })]);
    expect(outcome).toMatchObject({ status: 'passed', results: { login: { status: 'passed', httpStatus: 200, extracted: { token: 'abc' } } } });
    // the whole response of each request is kept to be looked at
    expect(outcome.results.login.response).toEqual({ status: 200, statusText: 'x', duration: 12, size: 7, headers: { 'content-type': 'application/json' }, data: { token: 'abc' } });
    expect(progress).toEqual([['login', 'running'], ['login', 'passed']]);
  });

  it('takes a plain path of the body from the response itself, whatever the pipeline did with the variables', async () => {
    const store = makeStore([request('login'), request('info')]);
    const seen = [];
    mockSendRequest.mockImplementation((sent) => async () => {
      seen.push({ name: sent.name, token: store.application.runtimeVariables.token });
      // the pipeline answers but sets no variable at all
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { status: 200, data: { data: { token: 'abc' } } };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('login', { extractions: [{ name: 'token', expression: 'res.body.data.token' }] }), node('info')], [edge('login', '200', 'info')]), 'app-1'));

    expect(outcome).toMatchObject({ status: 'passed', results: { login: { extracted: { token: 'abc' } } } });
    expect(seen).toEqual([{ name: 'login', token: undefined }, { name: 'info', token: 'abc' }]);
  });

  it('takes the item of a list that has the wanted field, the value being able to name an earlier variable', async () => {
    const store = makeStore([request('login'), request('robots')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
      item.response = sent.name === 'login'
        ? { status: 200, data: { robot: 'Beta' } }
        : { status: 200, data: { data: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }] } };
    });
    const pick = { name: 'robot_id', expression: 'res.body.data[0].id', where: [{ field: 'name', value: '{{robot}}' }] };

    const outcome = await store.dispatch(runFlow(flowOf(
      [node('login', { extractions: [{ name: 'robot', expression: 'res.body.robot' }] }), node('robots', { extractions: [pick] })],
      [edge('login', '200', 'robots')]
    ), 'app-1'));

    expect(outcome.results.robots.extracted).toEqual({ robot_id: 2 });
  });

  it('takes the first item whose field contains the value, or differs from it', async () => {
    const store = makeStore([request('robots')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { status: 200, data: { data: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Zumen Status Update' }] } };
    });
    const take = (...where) => store.dispatch(runFlow(flowOf([node('robots', { extractions: [{ name: 'robot_id', expression: 'res.body.data[0].id', where }] })]), 'app-1'));

    expect((await take({ field: 'name', op: 'contains', value: 'Status' })).results.robots.extracted).toEqual({ robot_id: 2 });
    expect((await take({ field: 'name', op: 'differs', value: 'Alpha' })).results.robots.extracted).toEqual({ robot_id: 2 });
    expect((await take({ field: 'name', op: 'contains', value: 'Status' }, { field: 'id', value: '2' })).results.robots.extracted).toEqual({ robot_id: 2 });
    expect((await take({ field: 'name', op: 'contains', value: 'Status' }, { field: 'id', value: '1' })).results.robots.error).toContain('name contains Status and id equals 1');
  });

  it('shuts the flow down when its timeout is over, cancelling the request in flight', async () => {
    const store = makeStore([request('slow'), request('next')]);
    store.application.items.find((candidate) => candidate.uid === 'uid-slow').cancelTokenUid = 'token-1';
    mockSendRequest.mockImplementation(() => () => new Promise(() => {}));

    const outcome = await store.dispatch(runFlow({ ...flowOf([node('slow'), node('next')], [edge('slow', '200', 'next')]), timeout: 0.05 }, 'app-1'));

    expect(outcome).toMatchObject({ status: 'failed', message: expect.stringContaining('Timed out after 0.05 s') });
    expect(outcome.results.slow).toMatchObject({ status: 'failed', error: 'Timed out' });
    expect(mockCancelRequest).toHaveBeenCalledWith('token-1', expect.objectContaining({ uid: 'uid-slow' }), expect.anything());
    expect(ranOrder()).toEqual(['slow']);
  });

  it('shuts the flow down when a request takes longer than the timeout of its own, the flow still having time', async () => {
    const store = makeStore([request('slow')]);
    mockSendRequest.mockImplementation(() => () => new Promise(() => {}));

    const outcome = await store.dispatch(runFlow({ ...flowOf([node('slow', { timeout: 0.05 })]), timeout: 60 }, 'app-1'));

    expect(outcome).toMatchObject({ status: 'failed', message: expect.stringContaining('A request took more than 0.05 s') });
    expect(outcome.results.slow.error).toBe('Timed out after 0.05 s');
  });

  it('follows the gRPC status a call ends with, and takes its message as the body', async () => {
    const store = makeStore([request('call', { type: 'grpc-request' }), request('after'), request('refused')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
      item.requestSent = { timestamp: Date.now() };
      item.response = sent.name === 'call'
        ? { statusCode: 5, statusText: 'NOT_FOUND', statusDescription: 'no such user', responses: [], duration: 4 }
        : { status: 200, data: {} };
    });

    const outcome = await store.dispatch(runFlow(flowOf(
      [node('call'), node('after'), node('refused')],
      [edge('call', 'OK', 'after'), edge('call', 'NOT_FOUND', 'refused')]
    ), 'app-1'));

    expect(ranOrder()).toEqual(['call', 'refused']);
    expect(outcome.results.call).toMatchObject({ exit: 'NOT_FOUND', failedExit: true, response: { status: 'NOT_FOUND', statusText: 'no such user' } });

    mockSendRequest.mockReset();
    mockSendRequest.mockImplementation((sent) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
      item.requestSent = { timestamp: Date.now() };
      item.response = { statusCode: 0, statusText: 'OK', responses: ['{"token":"abc"}'], duration: 3 };
    });
    const ok = await store.dispatch(runFlow(flowOf([node('call', { extractions: [{ name: 'token', expression: 'res.body.token' }] })]), 'app-1'));
    expect(ok.results.call.extracted).toEqual({ token: 'abc' });
    expect(ok.status).toBe('passed');
  });

  it('takes the first message a WebSocket request receives, then closes the connection', async () => {
    const store = makeStore([request('socket', { type: 'ws-request' })]);
    mockCloseWs.mockClear();
    mockSendRequest.mockImplementation((sent) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
      item.requestSent = { timestamp: Date.now() };
      item.response = { status: 'CONNECTED', responses: [{ type: 'outgoing', message: 'hi', timestamp: Date.now() }, { type: 'incoming', message: '{"id":7}', timestamp: Date.now() }] };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('socket', { extractions: [{ name: 'id', expression: 'res.body.id' }] })]), 'app-1'));

    expect(outcome.results.socket).toMatchObject({ exit: 'RECEIVED', extracted: { id: 7 } });
    expect(mockCloseWs).toHaveBeenCalledWith('uid-socket');
  });

  it('sends the messages of a WebSocket node in order and goes on when a message holds the expected text', async () => {
    const store = makeStore([request('socket', { type: 'ws-request' })]);
    const replies = [{ type: 'incoming', message: 'hello', seq: 1, timestamp: 0 }, { type: 'incoming', message: '{"type":"ready","id":9}', seq: 2, timestamp: 0 }];
    let sent = 0;
    mockSendRequest.mockImplementation((request) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === request.uid);
      item.requestSent = { timestamp: Date.now() };
      item.response = { status: 'CONNECTED', responses: replies.slice(0, ++sent).map((reply) => ({ ...reply, timestamp: Date.now() })) };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('socket', { send: ['{"a":1}', 'plain text'], expect: 'ready', extractions: [{ name: 'id', expression: 'res.body.id' }] })]), 'app-1'));

    expect(mockSendRequest.mock.calls.map(([request]) => request.request.body.ws[0])).toEqual([
      expect.objectContaining({ content: '{"a":1}', type: 'json', selected: true }),
      expect.objectContaining({ content: 'plain text', type: 'text', selected: true })
    ]);
    expect(outcome.results.socket).toMatchObject({ exit: 'RECEIVED', extracted: { id: 9 } });
  });

  it('leaves through CONNECTED when the socket is open but no message holds the expected text', async () => {
    const store = makeStore([request('socket', { type: 'ws-request' })]);
    mockSendRequest.mockImplementation((request) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === request.uid);
      item.requestSent = { timestamp: Date.now() };
      item.response = { status: 'CONNECTED', responses: [{ type: 'incoming', message: 'hello', seq: 1, timestamp: Date.now() }] };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('socket', { expect: 'ready', timeout: 0.1 })]), 'app-1'));

    expect(outcome.results.socket).toMatchObject({ exit: 'CONNECTED', failedExit: false });
  });

  it('goes on from RECEIVED beside the main branch when a message comes to a socket kept open, then closes the socket', async () => {
    const store = makeStore([request('socket', { type: 'ws-request' }), request('trigger'), request('after')]);
    mockCloseWs.mockClear();
    const socket = () => store.application.items.find((candidate) => candidate.uid === 'uid-socket');
    mockSendRequest.mockImplementation((sent) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
      item.requestSent = { timestamp: Date.now() };
      if (sent.uid === 'uid-socket') item.response = { status: 'CONNECTED', responses: [] };
      else {
        item.response = { status: 200, data: {}, headers: {} };
        if (sent.uid === 'uid-trigger') socket().response = { status: 'CONNECTED', responses: [{ type: 'incoming', message: '{"id":5}', seq: 1, timestamp: Date.now() }] };
      }
    });

    const flow = flowOf(
      [node('socket', { extractions: [{ name: 'id', expression: 'res.body.id' }] }), node('trigger'), node('after')],
      [edge('socket', 'CONNECTED', 'trigger'), edge('socket', 'RECEIVED', 'after')]
    );
    const outcome = await store.dispatch(runFlow(flow, 'app-1'));

    expect(outcome.status).toBe('passed');
    expect(outcome.results.trigger.status).toBe('passed');
    expect(outcome.results.after.status).toBe('passed');
    expect(outcome.results.socket).toMatchObject({ exit: 'RECEIVED', extracted: { id: 5 } });
    expect(mockCloseWs).toHaveBeenCalledWith('uid-socket');
  });

  it('leaves a WebSocket node through TIMEOUT when the socket does not open within its timeout', async () => {
    const store = makeStore([request('socket', { type: 'ws-request' }), request('retry')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      const item = store.application.items.find((candidate) => candidate.uid === sent.uid);
      item.requestSent = { timestamp: Date.now() };
      item.response = { status: 'CONNECTING', responses: [] };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('socket', { timeout: 0.1 }), node('retry')], [edge('socket', 'TIMEOUT', 'retry')]), 'app-1'));

    expect(outcome.results.socket).toMatchObject({ exit: 'TIMEOUT', failedExit: true });
    expect(ranOrder()).toEqual(['socket', 'retry']);
  });

  it('fails a request when no item of the list has the wanted field', async () => {
    const store = makeStore([request('robots')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { status: 200, data: { data: [{ id: 1, name: 'Alpha' }] } };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('robots', { extractions: [{ name: 'robot_id', expression: 'res.body.data[0].id', where: [{ field: 'name', value: 'Zeta' }] }] })]), 'app-1'));

    expect(outcome.results.robots.error).toContain('no item of the list has name equals Zeta');
  });

  it('follows the connection of the status that came back, the later request seeing earlier variables', async () => {
    const store = makeStore([request('login'), request('info'), request('retry')]);
    const seen = [];
    mockSendRequest.mockImplementation((sent) => async () => {
      seen.push({ name: sent.name, token: store.application.runtimeVariables.token });
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { status: 200 };
      if (sent.name === 'login') store.application.runtimeVariables.token = 'abc';
    });

    const outcome = await store.dispatch(runFlow(flowOf(
      [node('login', { extractions: [{ name: 'token', expression: 'res.body.token' }] }), node('info'), node('retry')],
      [edge('login', '200', 'info'), edge('login', 'other', 'retry')]
    ), 'app-1'));

    expect(seen).toEqual([{ name: 'login', token: undefined }, { name: 'info', token: 'abc' }]);
    expect(outcome.status).toBe('passed');
    expect(outcome.results.info.via).toBe('200');
  });

  it('takes the other connection when the status has none of its own', async () => {
    const store = makeStore([request('login'), request('info'), request('recover')]);
    respondWith(store, { statuses: { login: 401 } });

    const outcome = await store.dispatch(runFlow(flowOf(
      [node('login'), node('info'), node('recover')],
      [edge('login', '200', 'info'), edge('login', 'other', 'recover')]
    ), 'app-1'));

    expect(ranOrder()).toEqual(['login', 'recover']);
    expect(outcome.status).toBe('passed');
    expect(outcome.results.login.status).toBe('passed');
  });

  it('prefers the connection of the exact status over other', async () => {
    const store = makeStore([request('login'), request('created'), request('recover')]);
    respondWith(store, { statuses: { login: 201 } });

    await store.dispatch(runFlow(flowOf(
      [node('login'), node('created'), node('recover')],
      [edge('login', 'other', 'recover'), edge('login', '201', 'created')]
    ), 'app-1'));

    expect(ranOrder()).toEqual(['login', 'created']);
  });

  it('ends when nothing is connected, failed if the last status is an error', async () => {
    const store = makeStore([request('login'), request('info')]);
    respondWith(store, { statuses: { login: 404 } });

    const outcome = await store.dispatch(runFlow(flowOf([node('login'), node('info')], [edge('login', '200', 'info')]), 'app-1'));

    expect(ranOrder()).toEqual(['login']);
    expect(outcome).toMatchObject({ status: 'failed', message: 'Ended with status 404', results: { login: { status: 'failed', httpStatus: 404 } } });
  });

  it('starts at the leftmost request nothing leads to', async () => {
    const store = makeStore([request('login'), request('info')]);
    respondWith(store);

    // 'info' is listed first but 'login' is the one nothing leads to
    await store.dispatch(runFlow(flowOf([node('info'), node('login')], [edge('login', '200', 'info')]), 'app-1'));
    expect(ranOrder()).toEqual(['login', 'info']);

    // two requests nothing leads to: the leftmost runs
    mockSendRequest.mockClear();
    await store.dispatch(runFlow(flowOf([node('login'), node('info')]), 'app-1'));
    expect(ranOrder()).toEqual(['login']);
  });

  it('stops after too many requests when the flow goes round', async () => {
    const store = makeStore([request('start'), request('a'), request('b')]);
    respondWith(store);

    const outcome = await store.dispatch(runFlow(flowOf(
      [node('start'), node('a'), node('b')],
      [edge('start', '200', 'a'), edge('a', '200', 'b'), edge('b', '200', 'a')]
    ), 'app-1'));

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toMatch(/loop/);
    expect(mockSendRequest).toHaveBeenCalledTimes(50);
  });

  it('keeps going on a failed test but reports the flow as failed', async () => {
    const store = makeStore([request('login', { testResults: [{ status: 'fail', description: 'has a token' }] }), request('info')]);
    respondWith(store);

    const outcome = await store.dispatch(runFlow(flowOf([node('login'), node('info')], [edge('login', '200', 'info')]), 'app-1'));

    expect(ranOrder()).toEqual(['login', 'info']);
    expect(outcome).toMatchObject({ status: 'failed', message: 'has a token', results: { login: { status: 'failed' }, info: { status: 'passed' } } });
  });

  it('stops at a request that gets no response', async () => {
    const store = makeStore([request('login'), request('info')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { isError: true, error: 'connect ECONNREFUSED' };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('login'), node('info')], [edge('login', 'other', 'info')]), 'app-1'));

    expect(ranOrder()).toEqual(['login']);
    expect(outcome).toMatchObject({ status: 'failed', message: 'connect ECONNREFUSED' });
  });

  it('stops at a failed request whose error carries no flag, such as an unresolved {{baseUrl}}', async () => {
    const store = makeStore([request('login'), request('info')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { error: 'Invalid URL', duration: 3 };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('login'), node('info')], [edge('login', 'other', 'info')]), 'app-1'));

    expect(ranOrder()).toEqual(['login']);
    expect(outcome).toMatchObject({ status: 'failed', message: 'Invalid URL', results: { login: { status: 'failed' } } });
  });

  it('fails when a request of the flow no longer exists', async () => {
    const store = makeStore([]);
    respondWith(store);

    const outcome = await store.dispatch(runFlow(flowOf([node('gone')]), 'app-1'));

    expect(outcome).toMatchObject({ status: 'failed', message: 'Request not found: gone.yml' });
    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('fails an empty flow and one without a first request', async () => {
    const store = makeStore([request('a'), request('b')]);
    respondWith(store);

    expect((await store.dispatch(runFlow(flowOf([]), 'app-1'))).message).toBe('Add a request to the flow');
    expect((await store.dispatch(runFlow(flowOf([node('a'), node('b')], [edge('a', '200', 'b'), edge('b', '200', 'a')]), 'app-1'))).status).toBe('failed');
    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('uses the saved request rather than an unsaved draft', async () => {
    const store = makeStore([request('login', { draft: { request: { url: 'changed' } } })]);
    respondWith(store);

    await store.dispatch(runFlow(flowOf([node('login')]), 'app-1'));

    expect(mockSendRequest.mock.calls[0][0].draft).toBeUndefined();
  });

  it('stops before the next request once asked to', async () => {
    const store = makeStore([request('login'), request('info')]);
    respondWith(store);
    let stop = false;

    const outcome = await store.dispatch(runFlow(flowOf([node('login'), node('info')], [edge('login', '200', 'info')]), 'app-1', {
      onNode: (id, result) => { if (result.status === 'passed') stop = true; },
      shouldStop: () => stop
    }));

    expect(ranOrder()).toEqual(['login']);
    expect(outcome.status).toBe('stopped');
  });

  it('fails a request that could not take a value it was asked for', async () => {
    const store = makeStore([request('login')]);
    respondWith(store);

    const outcome = await store.dispatch(runFlow(flowOf([node('login', { extractions: [{ name: 'token', expression: 'res.body.nope' }] })]), 'app-1'));

    expect(outcome).toMatchObject({ status: 'failed', message: 'Could not take token (res.body.nope): res.body has no "nope"' });
  }, 10000);

  it('says where the path to a value stops being in the response', async () => {
    const store = makeStore([request('login')]);
    mockSendRequest.mockImplementation((sent) => async () => {
      store.application.items.find((candidate) => candidate.uid === sent.uid).response = { status: 200, data: { success: false, data: null } };
    });

    const outcome = await store.dispatch(runFlow(flowOf([node('login', { extractions: [{ name: 'username', expression: 'res.body.data.user.username' }] })]), 'app-1'));

    expect(outcome.message).toBe('Could not take username (res.body.data.user.username): res.body.data is null');
  }, 10000);

  it('sends the inputs of the node instead of the saved params, headers and body', async () => {
    const store = makeStore([request('login', {
      request: {
        method: 'POST',
        url: '{{baseUrl}}/login/:id?page=1&sort=asc',
        params: [
          { uid: 'p1', name: 'page', value: '1', type: 'query', enabled: true },
          { uid: 'p2', name: 'id', value: '7', type: 'path', enabled: true }
        ],
        headers: [{ uid: 'h1', name: 'Accept', value: 'text/plain', enabled: true }],
        body: { mode: 'none' },
        vars: { res: [] }
      }
    })]);
    respondWith(store);

    await store.dispatch(runFlow(flowOf([node('login', {
      inputs: { params: { page: '{{page}}', id: '9' }, headers: { 'accept': 'application/json', 'X-Trace': '1' }, body: '{"user":"a"}' }
    })]), 'app-1'));

    const { request: sent } = mockSendRequest.mock.calls[0][0];
    expect(sent.url).toBe('{{baseUrl}}/login/:id?page={{page}}&sort=asc');
    expect(sent.params.map((param) => [param.name, param.value])).toEqual([['page', '{{page}}'], ['id', '9']]);
    expect(sent.headers).toEqual([
      expect.objectContaining({ name: 'Accept', value: 'application/json' }),
      expect.objectContaining({ name: 'X-Trace', value: '1', enabled: true })
    ]);
    expect(sent.body).toMatchObject({ mode: 'json', json: '{"user":"a"}' });
  });
});
