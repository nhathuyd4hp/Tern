import { useMemo, useState } from 'react';
import { useDrop } from 'react-dnd';
import { v4 as uuid } from 'uuid';
import { Background, ConnectionLineType, Controls, MarkerType, ReactFlow, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'styled-components';
import { FLOW_DRAG, OTHER_STATUS, getRequestStatuses, getStatusKind } from 'utils/flows';
import FlowNode from '../FlowNode';
import StyledWrapper from './StyledWrapper';

const nodeTypes = { request: FlowNode };

// codes by number, then the names of gRPC statuses and WebSocket outcomes, Other last
const byStatus = (a, b) => (a === OTHER_STATUS ? 1 : b === OTHER_STATUS ? -1 : Number.isNaN(Number(a) - Number(b)) ? a.localeCompare(b) : Number(a) - Number(b));
const without = (map, id) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== id));

// The nodes and connections of a flow. It must be inside a ReactFlowProvider.
const FlowCanvas = ({ flow, requestOf, results, running, selectedId, onSelect, onChange, onDropRequest }) => {
  const { screenToFlowPosition } = useReactFlow();
  const [moving, setMoving] = useState({});
  const [measured, setMeasured] = useState({});
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const theme = useTheme();

  const [, dropTarget] = useDrop({
    accept: FLOW_DRAG.request,
    canDrop: () => !running,
    drop: (dragged, monitor) => onDropRequest(dragged.requestPath, screenToFlowPosition(monitor.getClientOffset()))
  });

  const nodes = useMemo(() => flow.nodes.map((node) => {
    const request = requestOf(node.requestPath);
    const connected = flow.edges.filter((edge) => edge.source === node.id).map((edge) => edge.sourceHandle);
    const handles = new Set([...[...getRequestStatuses(request), ...node.statuses].filter((status) => !node.hidden.includes(status)), ...connected]);
    return {
      id: node.id,
      type: 'request',
      position: moving[node.id] || node.position,
      measured: measured[node.id],
      selected: node.id === selectedId,
      data: { request, requestPath: node.requestPath, statuses: [...handles].sort(byStatus), result: results[node.id] }
    };
  }), [flow, requestOf, results, moving, measured, selectedId]);

  // After a run, the connections the flow took are green (red when it went on after a failure); the others are dashed.
  const edges = useMemo(() => flow.edges.map((edge) => {
    const hasRun = Object.keys(results).length > 0;
    const taken = results[edge.source] && results[edge.target]?.via === edge.sourceHandle;
    // a 4xx the flow handles went as planned (green); red is for a server error (5xx) or a gRPC / WebSocket error.
    // Other has no status of its own, so it follows whether the node itself went well
    const isServerError = (handle) => getStatusKind(handle) === 'error' && !/^4\d\d$/.test(handle);
    const failed = edge.sourceHandle === OTHER_STATUS ? results[edge.source]?.status === 'failed' : isServerError(edge.sourceHandle);
    const color = taken ? (failed ? theme.colors.text.danger : theme.colors.text.green) : undefined;
    return {
      ...edge,
      selected: edge.id === selectedEdgeId,
      type: 'smoothstep',
      // the connection that leads to the request running right now moves, to show where the flow is
      animated: taken && results[edge.target].status === 'running',
      pathOptions: { borderRadius: 6 },
      ...(color ? { style: { stroke: color, strokeWidth: 2 } } : hasRun && !taken ? { style: { strokeDasharray: '6 4' } } : {}),
      markerEnd: { type: MarkerType.ArrowClosed, ...(color ? { color } : {}) }
    };
  }), [flow.edges, selectedEdgeId, results, theme]);

  // Controlled canvas: only moves, sizes and selection are kept here; the rest goes to the flow itself.
  const onNodesChange = (changes) => changes.forEach((change) => {
    if (change.type === 'position' && change.position) setMoving((current) => ({ ...current, [change.id]: change.position }));
    if (change.type === 'dimensions' && change.dimensions) setMeasured((current) => ({ ...current, [change.id]: change.dimensions }));
    if (change.type === 'select') onSelect((current) => (change.selected ? change.id : current === change.id ? null : current));
  });

  const onEdgesChange = (changes) => changes.forEach((change) => {
    if (change.type === 'select') setSelectedEdgeId((current) => (change.selected ? change.id : current === change.id ? null : current));
  });

  const onNodeDragStop = (event, node, dragged) => {
    const positions = Object.fromEntries(dragged.map((moved) => [moved.id, moved.position]));
    onChange({ nodes: flow.nodes.map((existing) => (existing.id in positions ? { ...existing, position: positions[existing.id] } : existing)) });
    setMoving((current) => Object.keys(positions).reduce(without, current));
  };

  // A status leaves a node through one connection: a new one replaces the old.
  const onConnect = ({ source, sourceHandle, target }) => {
    if (source === target) return;
    onChange({
      edges: [...flow.edges.filter((edge) => !(edge.source === source && edge.sourceHandle === sourceHandle)), { id: uuid(), source, sourceHandle, target }]
    });
  };

  const onDelete = ({ nodes: removedNodes, edges: removedEdges }) => {
    const nodeIds = new Set(removedNodes.map((node) => node.id));
    const edgeIds = new Set(removedEdges.map((edge) => edge.id));
    onChange({
      nodes: flow.nodes.filter((node) => !nodeIds.has(node.id)),
      edges: flow.edges.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target))
    });
  };

  return (
    <StyledWrapper ref={dropTarget} data-testid="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onDelete={onDelete}
        nodesDraggable={!running}
        nodesConnectable={!running}
        connectionRadius={80}
        connectionLineType={ConnectionLineType.SmoothStep}
        deleteKeyCode={running ? null : ['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 0.7 }}
        minZoom={0.2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </StyledWrapper>
  );
};

export default FlowCanvas;
