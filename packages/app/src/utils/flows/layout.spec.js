import { arrangeNodes } from './layout';

const node = (id, x = 0, y = 0) => ({ id, position: { x, y } });
const edge = (source, target) => ({ id: `${source}-${target}`, source, sourceHandle: '200', target });
const positionsOf = (nodes) => Object.fromEntries(nodes.map((entry) => [entry.id, entry.position]));

describe('arrangeNodes', () => {
  it('puts each request one column right of the one that leads to it', () => {
    const nodes = arrangeNodes({ nodes: [node('a', 500, 90), node('b', -40, 10), node('c', 7, 7)], edges: [edge('a', 'b'), edge('b', 'c')] });

    expect(positionsOf(nodes)).toEqual({ a: { x: 0, y: 0 }, b: { x: 340, y: 0 }, c: { x: 680, y: 0 } });
  });

  it('stacks the requests of a column in the order they have from top to bottom', () => {
    const nodes = arrangeNodes({ nodes: [node('a'), node('low', 0, 300), node('high', 0, 50)], edges: [edge('a', 'low'), edge('a', 'high')] });

    expect(positionsOf(nodes)).toMatchObject({ high: { x: 340, y: 0 }, low: { x: 340, y: 200 } });
  });

  it('keeps the order of the requests in the flow and leaves a loop in finite columns', () => {
    const nodes = arrangeNodes({ nodes: [node('a'), node('b')], edges: [edge('a', 'b'), edge('b', 'a')] });

    expect(nodes.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(nodes.every((entry) => Number.isFinite(entry.position.x))).toBe(true);
  });
});
