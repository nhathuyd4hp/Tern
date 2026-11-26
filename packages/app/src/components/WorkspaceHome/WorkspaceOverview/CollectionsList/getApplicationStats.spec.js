import { getApplicationStats } from './getApplicationStats';

describe('getApplicationStats', () => {
  it('counts top-level collections and requests per protocol, walking nested groups', () => {
    const application = {
      items: [
        { type: 'http-request' },
        {
          type: 'folder',
          items: [
            { type: 'http-request' },
            { type: 'grpc-request' },
            { type: 'folder', items: [{ type: 'graphql-request' }, { type: 'ws-request' }] }
          ]
        },
        { type: 'folder', items: [{ type: 'grpc-request' }] }
      ]
    };

    expect(getApplicationStats(application)).toEqual({
      collections: 2, requests: 6, rest: 2, graphql: 1, grpc: 2, websocket: 1
    });
  });

  it('returns zeros for an application that is not loaded', () => {
    expect(getApplicationStats({ items: [] })).toEqual({ collections: 0, requests: 0, rest: 0, graphql: 0, grpc: 0, websocket: 0 });
    expect(getApplicationStats(undefined).requests).toBe(0);
  });
});
