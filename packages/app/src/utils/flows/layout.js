const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 200;

/**
 * Puts the requests of a flow in columns: a request goes one column right of the furthest request that leads to it, and the
 * requests of a column are stacked in the order they already have from top to bottom. Returns the nodes with new positions.
 */
export const arrangeNodes = (flow) => {
  const { nodes, edges } = flow;
  const depth = Object.fromEntries(nodes.filter((node) => !edges.some((edge) => edge.target === node.id)).map((node) => [node.id, 0]));
  // a flow may go round in a loop, so the columns stop growing after as many rounds as there are requests
  for (let round = 0; round < nodes.length; round++) {
    edges.forEach((edge) => {
      if (depth[edge.source] === undefined) return;
      depth[edge.target] = Math.min(nodes.length - 1, Math.max(depth[edge.target] ?? 0, depth[edge.source] + 1));
    });
  }

  const rows = {};
  return [...nodes]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((node) => {
      const column = depth[node.id] ?? 0;
      const row = rows[column] || 0;
      rows[column] = row + 1;
      return { ...node, position: { x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT } };
    })
    .sort((a, b) => nodes.findIndex((node) => node.id === a.id) - nodes.findIndex((node) => node.id === b.id));
};
