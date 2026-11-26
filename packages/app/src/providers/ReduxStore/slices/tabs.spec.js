import reducer, { setSidebarRevealRequest } from 'providers/ReduxStore/slices/tabs';

describe('sidebar reveal request', () => {
  it('records a sidebar reveal request so a repeat request is distinguishable', () => {
    let state = reducer(undefined, setSidebarRevealRequest({ uid: 'req-1', requestedAt: 100 }));
    expect(state.sidebarRevealRequest).toEqual({ uid: 'req-1', requestedAt: 100 });

    state = reducer(state, setSidebarRevealRequest({ uid: 'req-1', requestedAt: 200 }));
    expect(state.sidebarRevealRequest).toEqual({ uid: 'req-1', requestedAt: 200 });
  });
});
