import { renderHook, act } from '@testing-library/react';
import { createFlow, saveFlow, deleteFlow, useFlows, getRequestPath, getFlowRequests, findRequestByPath, getRequestStatuses } from './index';
import { flushFlowWrites, mockFlowFiles } from './testUtils';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));

const application = { pathname: 'C:\\Apps\\Shop' };

const node = (id, extra = {}) => ({ id, requestPath: `${id}.yml`, position: { x: 0, y: 0 }, inputs: { params: {}, headers: {}, body: null }, extractions: [], ...extra });

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
