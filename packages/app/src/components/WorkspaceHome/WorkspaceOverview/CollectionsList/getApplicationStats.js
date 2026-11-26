const PROTOCOL_BY_ITEM_TYPE = {
  'http-request': 'rest',
  'graphql-request': 'graphql',
  'grpc-request': 'grpc',
  'ws-request': 'websocket'
};

/**
 * Summarizes a loaded application for the home page: how many collections (top-level groups) it has and
 * how many requests per protocol. Nested groups are walked for requests but only top-level ones are counted.
 */
export const getApplicationStats = (application) => {
  const stats = { collections: 0, requests: 0, rest: 0, graphql: 0, grpc: 0, websocket: 0 };

  const walk = (items = []) => {
    items.forEach((item) => {
      if (item.type === 'folder') {
        walk(item.items);
        return;
      }
      const protocol = PROTOCOL_BY_ITEM_TYPE[item.type];
      if (protocol) {
        stats[protocol] += 1;
        stats.requests += 1;
      }
    });
  };

  stats.collections = (application?.items || []).filter((item) => item.type === 'folder').length;
  walk(application?.items);
  return stats;
};
