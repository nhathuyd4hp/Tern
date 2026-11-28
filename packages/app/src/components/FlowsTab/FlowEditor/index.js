import { useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuid } from 'uuid';
import { ReactFlowProvider } from '@xyflow/react';
import { IconClock, IconPlayerPlay, IconPlayerStop, IconSitemap, IconTrash } from '@tabler/icons';
import Button from 'ui/Button';
import Select from 'ui/Select';
import { DEFAULT_FLOW_TIMEOUT, deleteFlow, getFlowNameProblem, getFlowRequests, getUpstreamNodes, saveFlow } from 'utils/flows';
import { getEnvironmentSuggestions } from 'utils/flows/environmentVariables';
import { arrangeNodes } from 'utils/flows/layout';
import { runFlow } from 'utils/flows/runFlow';
import CollapsedRail from '../CollapsedRail';
import TimeoutField from '../TimeoutField';
import FlowCanvas from './FlowCanvas';
import NodePanel from './NodePanel';
import RequestPalette from './RequestPalette';
import ResizeHandle from '../ResizeHandle';
import StyledWrapper from './StyledWrapper';

const NODE_SPACING = 300;
const MAX_RUNS = 5;
const LATEST = 'latest';

// The last runs of each flow, kept while the app is open (not saved: a response may be large).
const runHistory = new Map();

const runLabel = ({ at, status, scope }) => `${new Date(at).toLocaleTimeString('en-GB')} · ${status[0].toUpperCase()}${status.slice(1)}${scope ? ` · ${scope}` : ''}`;

const FlowEditor = ({ application, flow, onDeleted }) => {
  const dispatch = useDispatch();
  const [liveResults, setResults] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState(() => runHistory.get(flow.id) || []);
  const [viewedRunId, setViewedRunId] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [paletteWidth, setPaletteWidth] = useState(220);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(340);
  const stopRequested = useRef(false);

  const { globalEnvironments, activeGlobalEnvironmentUid } = useSelector((state) => state.globalEnvironments);
  const environmentValues = useMemo(
    () => getEnvironmentSuggestions(application, { globalEnvironments, activeGlobalEnvironmentUid }),
    [application, globalEnvironments, activeGlobalEnvironmentUid]
  );
  const environmentNames = useMemo(() => environmentValues.map((entry) => entry.name), [environmentValues]);

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
      statuses: [],
      extractions: []
    };
    change({ nodes: [...flow.nodes, node] });
    setSelectedId(node.id);
  };

  // A status taken away from a node takes the connection that left through it.
  const changeNode = (next) => {
    const previous = flow.nodes.find((node) => node.id === next.id);
    const removed = (previous?.statuses || []).filter((status) => !next.statuses.includes(status));
    change({
      nodes: flow.nodes.map((node) => (node.id === next.id ? next : node)),
      edges: flow.edges.filter((edge) => !(edge.source === next.id && removed.includes(edge.sourceHandle)))
    });
  };

  const changeNodes = (nextNodes) => change({ nodes: flow.nodes.map((node) => nextNodes.find((next) => next.id === node.id) || node) });

  const removeNode = (nodeId) => {
    change({
      nodes: flow.nodes.filter((node) => node.id !== nodeId),
      edges: flow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    });
    setSelectedId(null);
  };

  // The run on show: the latest, or one picked from the history.
  const viewedRun = history.find((entry) => entry.id === viewedRunId) || null;
  const results = viewedRun ? viewedRun.results : liveResults;

  // From the first request, or from `startAt` (alone with `only`), which takes the values the run on show took.
  const run = async ({ startAt, only } = {}) => {
    const variables = startAt ? Object.assign({}, ...Object.values(results).map((result) => result.extracted)) : {};
    stopRequested.current = false;
    setViewedRunId(null);
    setResults({});
    setOutcome(null);
    setRunning(true);
    try {
      const finished = await dispatch(runFlow(flow, application.uid, {
        startAt,
        only,
        variables,
        onNode: (nodeId, result) => {
          setResults((current) => ({ ...current, [nodeId]: result }));
          // the panel follows the request being run, so its response is there as soon as it comes back
          setSelectedId(nodeId);
        },
        shouldStop: () => stopRequested.current
      }));
      setOutcome({ status: finished.status, message: finished.message });
      const kept = [{ id: uuid(), at: Date.now(), status: finished.status, results: finished.results || {}, scope: only ? 'one request' : startAt ? 'from a request' : '' }, ...(runHistory.get(flow.id) || [])].slice(0, MAX_RUNS);
      runHistory.set(flow.id, kept);
      setHistory(kept);
      // at the end, show the request that failed, else the last one
      const ran = Object.entries(finished.results || {});
      const failed = ran.find(([, result]) => result.status === 'failed');
      const shown = failed || ran[ran.length - 1];
      if (shown) setSelectedId(shown[0]);
    } finally {
      setRunning(false);
    }
  };

  const remove = () => {
    deleteFlow(application, flow.id);
    onDeleted();
  };

  const nameProblem = getFlowNameProblem(flow, environmentNames);
  const selected = flow.nodes.find((node) => node.id === selectedId) || null;
  // the earlier requests whose responses a request can use
  const upstream = selected
    ? getUpstreamNodes(flow, selected.id).map((node) => ({ node, request: requestOf(node.requestPath) })).filter((entry) => entry.request)
    : [];

  return (
    <StyledWrapper data-testid="flow-editor">
      <div className="flow-header">
        <input
          className="flow-name"
          aria-label="Flow name"
          value={flow.name}
          onChange={(event) => change({ name: event.target.value })}
        />
        <div className="flow-actions">
          <div className="flow-timeout" title="The flow is shut down after this many seconds">
            <IconClock size={14} />
            <TimeoutField label="Timeout of the flow in seconds" value={flow.timeout} placeholder={String(DEFAULT_FLOW_TIMEOUT)} disabled={running} onChange={(timeout) => change({ timeout })} />
            <span>s</span>
          </div>
          {history.length > 0 && (
            <div className="flow-history" title="Look at an earlier run">
              <Select
                aria-label="Earlier runs"
                data={[{ value: LATEST, label: 'Latest run' }, ...history.map((entry) => ({ value: entry.id, label: runLabel(entry) }))]}
                value={viewedRun ? viewedRun.id : LATEST}
                onChange={(value) => setViewedRunId(value === LATEST ? null : value)}
                disabled={running}
              />
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            color="secondary"
            icon={<IconSitemap size={16} />}
            disabled={running || flow.nodes.length < 2}
            onClick={() => {
              change({ nodes: arrangeNodes(flow) }); setFitKey((key) => key + 1);
            }}
            title="Arrange the requests in columns"
            aria-label="Arrange requests"
            data-testid="flow-arrange"
          />
          <span className="flow-divider" aria-hidden="true" />
          <Button size="sm" color="danger" variant="ghost" icon={<IconTrash size={16} />} disabled={running} onClick={remove} title="Delete this flow" aria-label="Delete flow" data-testid="flow-delete" />
          {running ? (
            <Button color="secondary" variant="outline" icon={<IconPlayerStop size={14} />} onClick={() => { stopRequested.current = true; }} data-testid="flow-stop">
              Stop
            </Button>
          ) : (
            <Button icon={<IconPlayerPlay size={14} />} disabled={flow.nodes.length === 0 || Boolean(nameProblem)} title={nameProblem || undefined} onClick={() => run()} data-testid="flow-run">
              Run
            </Button>
          )}
        </div>
      </div>

      <p className="flow-hint">
        Drag requests onto the canvas, then drag from a status on the right of a request to the next one: that one runs when the response comes back with that status.
        Select a connection or a request and press Delete to remove it.
      </p>

      {nameProblem && (
        <div className="flow-summary failed" data-testid="flow-name-problem">{nameProblem}. Change one of the names to run the flow.</div>
      )}

      {outcome && !running && (
        <div className={`flow-summary ${outcome.status}`} data-testid="flow-summary">
          {outcome.message}
        </div>
      )}

      <div className="flow-body">
        {paletteCollapsed ? (
          <CollapsedRail label="Requests" onExpand={() => setPaletteCollapsed(false)} />
        ) : (
          <>
            <RequestPalette requests={requests} width={paletteWidth} disabled={running} onAdd={(requestPath) => addNode(requestPath)} onCollapse={() => setPaletteCollapsed(true)} />
            <ResizeHandle label="Resize the list of requests" onResize={(delta) => setPaletteWidth((width) => Math.min(480, Math.max(140, width + delta)))} />
          </>
        )}
        <ReactFlowProvider key={fitKey}>
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
          <>
            <ResizeHandle label="Resize the details of the request" onResize={(delta) => setPanelWidth((width) => Math.min(720, Math.max(260, width - delta)))} />
            <NodePanel
              key={selected.id}
              width={panelWidth}
              flow={flow}
              node={selected}
              upstream={upstream}
              environmentValues={environmentValues}
              results={results}
              onChangeMany={changeNodes}
              requests={requests}
              request={requestOf(selected.requestPath)}
              onRunFrom={() => run({ startAt: selected.id })}
              onRunOnly={() => run({ startAt: selected.id, only: true })}
              result={results[selected.id]}
              disabled={running}
              onChange={changeNode}
              onRemove={() => removeNode(selected.id)}
            />
          </>
        )}
      </div>
    </StyledWrapper>
  );
};

export default FlowEditor;
