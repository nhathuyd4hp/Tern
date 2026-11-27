import { renderHook, act } from '@testing-library/react';
import { createFlow, saveFlow, deleteFlow, useFlows, getRequestPath, getFlowRequests, findRequestByPath, getRequestStatuses, getRequestUrlPath, getStatusKind, getUpstreamNodes, freeVariableName, getVariableNameProblem, getFlowNameProblem } from './index';
import { flushFlowWrites, mockFlowFiles } from './testUtils';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));

const application = { pathname: 'C:\\Apps\\Shop' };

const node = (id, extra = {}) => ({ id, requestPath: `${id}.yml`, position: { x: 0, y: 0 }, inputs: { params: {}, headers: {}, body: null }, statuses: [], extractions: [], ...extra });

// the flows of an application, once the file has been read
const loadFlows = async (target) => {
  const hook = renderHook(() => useFlows(target));
  await act(async () => {});
  return hook;
};

describe('flows store', () => {
  let ipc;

  beforeEach(() => {
    ipc = mockFlowFiles();
  });

  it('keeps the flows of an application, shared by every user of the hook, and writes them to its file', async () => {
    const { result } = await loadFlows(application);
    const flow = {
      ...createFlow('Login'),
      nodes: [node('n1', { requestPath: 'Auth/login.yml', extractions: [{ name: 'token', expression: 'res.body.token' }] }), node('n2')],
      edges: [{ id: 'e1', source: 'n1', sourceHandle: '200', target: 'n2' }]
    };

    act(() => saveFlow(application, flow));
    expect(result.current).toHaveLength(1);
    expect((await loadFlows({ pathname: 'c:/apps/shop/' })).result.current[0].name).toBe('Login');
    expect(result.current[0].edges).toEqual([{ id: 'e1', source: 'n1', sourceHandle: '200', target: 'n2' }]);

    act(() => saveFlow(application, { ...flow, name: 'Renamed' }));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('Renamed');

    await act(async () => flushFlowWrites());
    expect(ipc.files['C:\\Apps\\Shop'][0].nodes[0].extractions[0].name).toBe('token');
    expect(ipc.files['C:\\Apps\\Shop'][0].name).toBe('Renamed');

    act(() => deleteFlow(application, flow.id));
    expect(result.current).toHaveLength(0);
    await act(async () => flushFlowWrites());
    expect(ipc.files['C:\\Apps\\Shop']).toEqual([]);
  });

  it('keeps flows of different applications apart', async () => {
    const other = { pathname: '/apps/Other' };
    await loadFlows(other);
    act(() => saveFlow(other, createFlow('Only here')));
    expect((await loadFlows(application)).result.current.some((flow) => flow.name === 'Only here')).toBe(false);
  });

  it('repairs stored data it cannot trust', async () => {
    await loadFlows(application);
    act(() => saveFlow(application, {
      id: 5,
      name: null,
      nodes: [{ requestPath: 7, position: { x: 'far' }, inputs: { params: { a: 1, b: 'two' }, body: 3 }, extractions: [{ name: {}, expression: 1 }] }, 'nope', node('ok')],
      edges: [{ source: 'ok', sourceHandle: '200', target: 'missing' }, { source: 'ok', sourceHandle: '', target: 'ok' }, 'nope']
    }));
    const flow = renderHook(() => useFlows(application)).result.current.at(-1);
    expect(flow.name).toBe('Untitled flow');
    expect(flow.nodes[0]).toMatchObject({
      requestPath: '',
      position: { x: 0, y: 0 },
      inputs: { params: { b: 'two' }, headers: {}, body: null },
      extractions: [{ name: '', expression: '' }]
    });
    expect(flow.edges).toEqual([]);
  });

  it('keeps the statuses added to a node, once each and only real codes', async () => {
    await loadFlows(application);
    act(() => saveFlow(application, { id: 6, name: 'Statuses', nodes: [node('a', { statuses: ['500', '404', '404', 'abc', '99', 700, 418] })], edges: [] }));
    const flow = renderHook(() => useFlows(application)).result.current.at(-1);

    expect(flow.nodes[0].statuses).toEqual(['404', '418', '500']);
  });

  it('lets a status leave a node through one connection only', async () => {
    await loadFlows(application);
    act(() => saveFlow(application, {
      ...createFlow('One way'),
      nodes: [node('a'), node('b'), node('c')],
      edges: [
        { id: 'first', source: 'a', sourceHandle: '200', target: 'b' },
        { id: 'second', source: 'a', sourceHandle: '200', target: 'c' },
        { id: 'third', source: 'a', sourceHandle: 'other', target: 'b' }
      ]
    }));
    const flow = renderHook(() => useFlows(application)).result.current.find((candidate) => candidate.name === 'One way');
    expect(flow.edges.map((edge) => edge.id)).toEqual(['second', 'third']);
  });

  it('turns a flow of ordered steps into a row of connected nodes', async () => {
    await loadFlows(application);
    act(() => saveFlow(application, {
      id: 'old',
      name: 'Old flow',
      steps: [
        { id: 's1', requestPath: 'login.yml', extractions: [{ name: 'token', expression: 'res.body.token' }] },
        { id: 's2', requestPath: 'info.yml' }
      ]
    }));
    const flow = renderHook(() => useFlows(application)).result.current.find((candidate) => candidate.id === 'old');
    expect(flow.nodes.map((entry) => [entry.id, entry.position.x])).toEqual([['s1', 0], ['s2', 300]]);
    expect(flow.nodes[0].extractions).toEqual([{ name: 'token', expression: 'res.body.token' }]);
    expect(flow.edges).toEqual([expect.objectContaining({ source: 's1', sourceHandle: '200', target: 's2' })]);
    expect(flow.steps).toBeUndefined();
  });
});

describe('flows file', () => {
  const stored = { id: 'f1', name: 'From file', nodes: [], edges: [] };

  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the flows of the file and repairs old step flows it holds', async () => {
    mockFlowFiles({ '/apps/FromFile': [stored, { id: 'old', name: 'Old', steps: [{ id: 's1', requestPath: 'a.yml' }] }] });

    const { result } = await loadFlows({ pathname: '/apps/FromFile' });

    expect(result.current.map((flow) => flow.name)).toEqual(['From file', 'Old']);
    expect(result.current[1].nodes).toHaveLength(1);
  });

  it('reads an application once and has no flows until the file answers', async () => {
    const { invoke } = mockFlowFiles({ '/apps/ReadOnce': [stored] });
    const target = { pathname: '/apps/ReadOnce' };

    const { result } = renderHook(() => useFlows(target));
    expect(result.current).toEqual([]);
    await act(async () => {});
    renderHook(() => useFlows(target));

    expect(result.current).toHaveLength(1);
    expect(invoke.mock.calls.filter(([channel]) => channel === 'renderer:read-flows')).toHaveLength(1);
  });

  it('writes after a pause, once for a burst of changes, with the last state', async () => {
    const { invoke } = mockFlowFiles();
    const target = { pathname: '/apps/Burst' };
    await loadFlows(target);

    act(() => saveFlow(target, { ...createFlow('One'), id: 'f' }));
    act(() => saveFlow(target, { ...createFlow('Two'), id: 'f' }));
    expect(invoke).toHaveBeenCalledTimes(1);

    await act(async () => jest.advanceTimersByTime(300));

    const writes = invoke.mock.calls.filter(([channel]) => channel === 'renderer:write-flows');
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toBe('/apps/Burst');
    expect(writes[0][2].map((flow) => flow.name)).toEqual(['Two']);
  });

  it('creates no file for an application without flows', async () => {
    const { invoke } = mockFlowFiles();
    await loadFlows({ pathname: '/apps/Nothing' });
    await act(async () => jest.advanceTimersByTime(1000));
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual(['renderer:read-flows']);
  });

  it('moves the flows kept in browser storage into the file, then drops them from it', async () => {
    localStorage.setItem('tern.flows', JSON.stringify({
      '/apps/legacy': [stored],
      '/apps/other': [{ id: 'x', name: 'Other', steps: [] }]
    }));
    const ipc = mockFlowFiles();

    const { result } = await loadFlows({ pathname: '/apps/Legacy' });
    await act(async () => {});

    expect(result.current.map((flow) => flow.name)).toEqual(['From file']);
    expect(ipc.files['/apps/Legacy'].map((flow) => flow.name)).toEqual(['From file']);
    expect(Object.keys(JSON.parse(localStorage.getItem('tern.flows')))).toEqual(['/apps/other']);
  });

  it('leaves a file it cannot read alone: no flows, nothing written', async () => {
    const invoke = jest.fn((channel) => (channel === 'renderer:read-flows' ? Promise.reject(new Error('corrupt')) : Promise.resolve()));
    window.ipcRenderer = { invoke };
    const target = { pathname: '/apps/Corrupt' };
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = await loadFlows(target);
    act(() => saveFlow(target, createFlow('Lost')));
    await act(async () => jest.advanceTimersByTime(1000));

    expect(result.current).toEqual([]);
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual(['renderer:read-flows']);
    console.error.mockRestore();
  });
});

describe('request paths', () => {
  const items = [
    { uid: '1', type: 'folder', pathname: 'C:\\Apps\\Shop\\Auth', items: [{ uid: '2', type: 'http-request', request: {}, pathname: 'C:\\Apps\\Shop\\Auth\\login.yml' }] },
    { uid: '3', type: 'grpc-request', request: {}, pathname: 'C:\\Apps\\Shop\\Stream.yml' },
    { uid: '4', type: 'graphql-request', request: {}, pathname: 'C:\\Apps\\Shop\\Query.yml' }
  ];
  const app = { ...application, items };

  it('is relative to the application with forward slashes', () => {
    expect(getRequestPath(app, items[0].items[0])).toBe('Auth/login.yml');
    expect(getRequestPath(app, { pathname: 'D:\\Elsewhere\\x.yml' })).toBe('');
  });

  it('lists http and graphql requests only and finds one by its path', () => {
    expect(getFlowRequests(app).map((entry) => entry.requestPath)).toEqual(['Auth/login.yml', 'Query.yml']);
    expect(findRequestByPath(app, 'auth/LOGIN.yml').uid).toBe('2');
    expect(findRequestByPath(app, 'Stream.yml')).toBeNull();
  });
});

describe('getUpstreamNodes and freeVariableName', () => {
  const flow = {
    nodes: [node('a', { extractions: [{ name: 'token', expression: 'res.body.token' }] }), node('b'), node('c'), node('d')],
    edges: [
      { id: 'e1', source: 'a', sourceHandle: '200', target: 'b' },
      { id: 'e2', source: 'b', sourceHandle: '200', target: 'c' },
      { id: 'e3', source: 'c', sourceHandle: 'other', target: 'a' }
    ]
  };

  it('finds every node whose response can reach a node, loops included, never the node itself', () => {
    expect(getUpstreamNodes(flow, 'c').map((entry) => entry.id).sort()).toEqual(['a', 'b']);
    expect(getUpstreamNodes(flow, 'a').map((entry) => entry.id).sort()).toEqual(['b', 'c']);
    expect(getUpstreamNodes(flow, 'd')).toEqual([]);
  });

  it('gives a variable name no node of the flow uses yet', () => {
    expect(freeVariableName(flow, 'id')).toBe('id');
    expect(freeVariableName(flow, 'token')).toBe('token_2');
    expect(freeVariableName({ nodes: [node('a', { extractions: [{ name: 'token', expression: 'x' }, { name: 'token_2', expression: 'y' }] })], edges: [] }, 'token')).toBe('token_3');
  });
});

describe('names of shared values', () => {
  const share = (...pairs) => ({
    nodes: pairs.map(([id, ...names]) => node(id, { extractions: names.map((name) => ({ name, expression: 'res.body.x' })) })),
    edges: []
  });

  it('refuses a name another shared value already has, in the same request or another', () => {
    const flow = share(['a', 'username'], ['b', 'username', 'id']);

    expect(getVariableNameProblem(flow, 'b', 0, 'username')).toBe('A value named "username" is already shared by another request');
    expect(getVariableNameProblem(flow, 'a', 0, 'username')).toBe('A value named "username" is already shared by another request');
    expect(getVariableNameProblem(share(['a', 'x', 'x']), 'a', 1, 'x')).toBe('A value named "x" is already shared by this request');
    expect(getVariableNameProblem(flow, 'b', 1, 'id')).toBeNull();
    expect(getFlowNameProblem(flow)).toMatch(/already shared/);
    expect(getFlowNameProblem(share(['a', 'one'], ['b', 'two']))).toBeNull();
  });

  it('refuses a name the pipeline would not take, and ignores an empty one', () => {
    const flow = share(['a', 'ten nv']);

    expect(getVariableNameProblem(flow, 'a', 0, 'ten nv')).toMatch(/Use only letters/);
    expect(getVariableNameProblem(flow, 'a', 0, 'tên')).toMatch(/Use only letters/);
    expect(getVariableNameProblem(flow, 'a', 0, 'ma_nv-1.x')).toBeNull();
    expect(getVariableNameProblem(flow, 'a', 0, '')).toBeNull();
  });
});

describe('getStatusKind', () => {
  it('colours 2xx green, 3xx yellow, 4xx and 5xx red and the rest grey', () => {
    expect(['200', '299', 204].map(getStatusKind)).toEqual(['ok', 'ok', 'ok']);
    expect(['301', '399'].map(getStatusKind)).toEqual(['redirect', 'redirect']);
    expect(['400', '404', '500', '599'].map(getStatusKind)).toEqual(['error', 'error', 'error', 'error']);
    expect(['100', '199', 'other', 'abc'].map(getStatusKind)).toEqual(['other', 'other', 'other', 'other']);
  });
});

describe('getRequestUrlPath', () => {
  const at = (url) => getRequestUrlPath({ request: { url } });

  it('keeps the path, without host, variable host or query', () => {
    expect(at('{{baseUrl}}/users/{{id}}?x=1')).toBe('/users/{{id}}');
    expect(at('https://api.example.com/v1/orders#top')).toBe('/v1/orders');
    expect(at('/sign-in')).toBe('/sign-in');
  });

  it('gives / when there is no path', () => {
    expect(at('{{baseUrl}}')).toBe('/');
    expect(getRequestUrlPath({})).toBe('/');
  });
});

describe('getRequestStatuses', () => {
  const example = (status) => ({ response: { status } });

  it('lists the documented statuses once, in order, then other', () => {
    expect(getRequestStatuses({ examples: [example(404), example(200), example(201), example(200)] })).toEqual(['200', '201', '404', 'other']);
  });

  it('assumes a 200 when nothing is documented', () => {
    expect(getRequestStatuses({})).toEqual(['200', 'other']);
    expect(getRequestStatuses({ examples: [example(null), example('x')] })).toEqual(['200', 'other']);
  });
});
