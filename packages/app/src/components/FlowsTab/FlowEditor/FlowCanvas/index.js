import { useMemo, useState } from 'react';
import { useDrop } from 'react-dnd';
import { v4 as uuid } from 'uuid';
import { Background, Controls, MarkerType, ReactFlow, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FLOW_DRAG, OTHER_STATUS, getRequestStatuses } from 'utils/flows';
import FlowNode from '../FlowNode';
import StyledWrapper from './StyledWrapper';

const nodeTypes = { request: FlowNode };

const byStatus = (a, b) => (a === OTHER_STATUS ? 1 : b === OTHER_STATUS ? -1 : Number(a) - Number(b));
const without = (map, id) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== id));

// The nodes and connections of a flow. It must be inside a ReactFlowProvider.
const FlowCanvas = ({ flow, requestOf, results, running, selectedId, onSelect, onChange, onDropRequest }) => {
  const { screenToFlowPosition } = useReactFlow();
  const [moving, setMoving] = useState({});
  const [measured, setMeasured] = useState({});
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  const [, dropTarget] = useDrop({
    accept: FLOW_DRAG.request,
    canDrop: () => !running,
    drop: (dragged, monitor) => onDropRequest(dragged.requestPath, screenToFlowPosition(monitor.getClientOffset()))
  });

  const nodes = useMemo(() => flow.nodes.map((node) => {
    const request = requestOf(node.requestPath);
    const handles = new Set([...getRequestStatuses(request), ...node.statuses, ...flow.edges.filter((edge) => edge.source === node.id).map((edge) => edge.sourceHandle)]);
    return {
      id: node.id,
      type: 'request',
      position: moving[node.id] || node.position,
      measured: measured[node.id],
      selected: node.id === selectedId,
      data: { request, requestPath: node.requestPath, statuses: [...handles].sort(byStatus), result: results[node.id] }
    };
  }), [flow, requestOf, results, moving, measured, selectedId]);

  const edges = useMemo(() => flow.edges.map((edge) => ({
    ...edge,
    selected: edge.id === selectedEdgeId,
    markerEnd: { type: MarkerType.ArrowClosed }
  })), [flow.edges, selectedEdgeId]);

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
