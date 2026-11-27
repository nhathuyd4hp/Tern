import { useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { v4 as uuid } from 'uuid';
import { ReactFlowProvider } from '@xyflow/react';
import { IconPlayerPlay, IconPlayerStop, IconTrash } from '@tabler/icons';
import Button from 'ui/Button';
import { deleteFlow, getFlowRequests, saveFlow } from 'utils/flows';
import { runFlow } from 'utils/flows/runFlow';
import FlowCanvas from './FlowCanvas';
import NodePanel from './NodePanel';
import RequestPalette from './RequestPalette';
import StyledWrapper from './StyledWrapper';

const NODE_SPACING = 300;

const FlowEditor = ({ application, flow, onDeleted }) => {
  const dispatch = useDispatch();
  const [results, setResults] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const stopRequested = useRef(false);

  const requests = useMemo(() => getFlowRequests(application), [application]);
  const requestOf = useMemo(() => (requestPath) => requests.find((entry) => entry.requestPath.toLowerCase() === requestPath.toLowerCase())?.item || null, [requests]);

  const change = (next) => saveFlow(application, { ...flow, ...next });

  const addNode = (requestPath, position) => {
    const rightmost = flow.nodes.reduce((edge, node) => Math.max(edge, node.position.x), -NODE_SPACING);
    const node = {
      id: uuid(),
      requestPath,
      position: position || { x: rightmost + NODE_SPACING, y: 0 },
      inputs: { params: {}, headers: {}, body: null },
      extractions: []
    };
    change({ nodes: [...flow.nodes, node] });
    setSelectedId(node.id);
  };

  const changeNode = (next) => change({ nodes: flow.nodes.map((node) => (node.id === next.id ? next : node)) });

  const removeNode = (nodeId) => {
    change({
      nodes: flow.nodes.filter((node) => node.id !== nodeId),
      edges: flow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    });
    setSelectedId(null);
  };

  const run = async () => {
    stopRequested.current = false;
    setResults({});
    setOutcome(null);
    setRunning(true);
    try {
      const finished = await dispatch(runFlow(flow, application.uid, {
        onNode: (nodeId, result) => setResults((current) => ({ ...current, [nodeId]: result })),
        shouldStop: () => stopRequested.current
      }));
      setOutcome({ status: finished.status, message: finished.message });
    } finally {
      setRunning(false);
    }
  };

  const remove = () => {
    deleteFlow(application, flow.id);
    onDeleted();
  };

  const selected = flow.nodes.find((node) => node.id === selectedId) || null;

  return (
    <StyledWrapper data-testid="flow-editor">
      <div className="flow-header">
        <input
          className="flow-name"
          aria-label="Flow name"
          value={flow.name}
          onChange={(event) => change({ name: event.target.value })}
        />
        {running ? (
          <Button color="secondary" variant="outline" icon={<IconPlayerStop size={14} />} onClick={() => { stopRequested.current = true; }} data-testid="flow-stop">
            Stop
          </Button>
        ) : (
          <Button icon={<IconPlayerPlay size={14} />} disabled={flow.nodes.length === 0} onClick={run} data-testid="flow-run">
            Run
          </Button>
        )}
        <Button color="danger" variant="ghost" icon={<IconTrash size={14} />} disabled={running} onClick={remove} data-testid="flow-delete">
          Delete
        </Button>
      </div>

      <p className="flow-hint">
        Drag requests onto the canvas, then drag from a status on the right of a request to the next one: that one runs when the response comes back with that status.
        Select a connection or a request and press Delete to remove it.
      </p>

      {outcome && !running && (
        <div className={`flow-summary ${outcome.status}`} data-testid="flow-summary">
          {outcome.message}
        </div>
      )}

      <div className="flow-body">
        <RequestPalette requests={requests} disabled={running} onAdd={(requestPath) => addNode(requestPath)} />
        <ReactFlowProvider>
          <FlowCanvas
            flow={flow}
            requestOf={requestOf}
            results={results}
            running={running}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={change}
            onDropRequest={addNode}
          />
        </ReactFlowProvider>
        {selected && (
          <NodePanel
            key={selected.id}
            node={selected}
            request={requestOf(selected.requestPath)}
            result={results[selected.id]}
            disabled={running}
            onChange={changeNode}
            onRemove={() => removeNode(selected.id)}
          />
        )}
      </div>
    </StyledWrapper>
  );
};

export default FlowEditor;
