import { renderHook, act } from '@testing-library/react';
import { createFlow, saveFlow, deleteFlow, useFlows, getRequestPath, getFlowRequests, findRequestByPath } from './index';

const application = { pathname: 'C:\\Apps\\Shop' };

describe('flows store', () => {
  it('keeps the flows of an application, shared by every user of the hook, and survives a reload', () => {
    const { result } = renderHook(() => useFlows(application));
    const flow = { ...createFlow('Login'), steps: [{ id: 's1', requestPath: 'Auth/login.yml', extractions: [{ name: 'token', expression: 'res.body.token' }] }] };

    act(() => saveFlow(application, flow));
    expect(result.current).toHaveLength(1);
    expect(renderHook(() => useFlows({ pathname: 'c:/apps/shop/' })).result.current[0].name).toBe('Login');
    expect(JSON.parse(localStorage.getItem('tern.flows'))['c:/apps/shop'][0].steps[0].extractions[0].name).toBe('token');

    act(() => saveFlow(application, { ...flow, name: 'Renamed' }));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('Renamed');

    act(() => deleteFlow(application, flow.id));
    expect(result.current).toHaveLength(0);
  });

  it('keeps flows of different applications apart', () => {
    const other = { pathname: '/apps/Other' };
    act(() => saveFlow(other, createFlow('Only here')));
    expect(renderHook(() => useFlows(application)).result.current.some((flow) => flow.name === 'Only here')).toBe(false);
  });

  it('repairs stored data it cannot trust', () => {
    act(() => saveFlow(application, { id: 5, name: null, steps: [{ requestPath: 7, extractions: [{ name: {}, expression: 1 }] }, 'nope'] }));
    const flow = renderHook(() => useFlows(application)).result.current.at(-1);
    expect(flow.name).toBe('Untitled flow');
    expect(flow.steps[0]).toMatchObject({ requestPath: '', extractions: [{ name: '', expression: '' }] });
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
