import { useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconPlayerPlay, IconPlayerStop, IconTrash } from '@tabler/icons';
import Button from 'ui/Button';
import Select from 'ui/Select';
import { deleteFlow, getFlowRequests, saveFlow } from 'utils/flows';
import { runFlow } from 'utils/flows/runFlow';
import FlowStep from './FlowStep';
import StyledWrapper from './StyledWrapper';

const FlowEditor = ({ application, flow, onDeleted }) => {
  const dispatch = useDispatch();
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const stopRequested = useRef(false);

  const requests = useMemo(() => getFlowRequests(application), [application]);
  const requestOf = (requestPath) => requests.find((entry) => entry.requestPath.toLowerCase() === requestPath.toLowerCase())?.item || null;

  const change = (next) => saveFlow(application, { ...flow, ...next });
  const changeStep = (index, step) => change({ steps: flow.steps.map((existing, i) => (i === index ? step : existing)) });
  const removeStep = (index) => change({ steps: flow.steps.filter((_, i) => i !== index) });
  const moveStep = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= flow.steps.length) return;
    const steps = [...flow.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    change({ steps });
  };
  const addStep = (requestPath) => requestPath && change({ steps: [...flow.steps, { requestPath, extractions: [] }] });

  const run = async () => {
    stopRequested.current = false;
    setResults([]);
    setRunning(true);
    try {
      await dispatch(runFlow(flow, application.uid, {
        onStep: (index, result) => setResults((current) => Object.assign([...current], { [index]: result })),
        shouldStop: () => stopRequested.current
      }));
    } finally {
      setRunning(false);
    }
  };

  const remove = () => {
    deleteFlow(application, flow.id);
    onDeleted();
  };

  const failedStep = results.findIndex((result) => result?.status === 'failed');
  const finished = !running && results.length > 0;

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
          <Button icon={<IconPlayerPlay size={14} />} disabled={flow.steps.length === 0} onClick={run} data-testid="flow-run">
            Run
          </Button>
        )}
        <Button color="danger" variant="ghost" icon={<IconTrash size={14} />} disabled={running} onClick={remove} data-testid="flow-delete">
          Delete
        </Button>
      </div>

      <p className="flow-hint">
        Steps run in order and stop at the first one that fails. Each step sends the saved version of its request.
        Use a value taken from a response in later steps as <code>{'{{name}}'}</code>.
      </p>

      {finished && (
        <div className={`flow-summary ${failedStep >= 0 ? 'failed' : 'passed'}`} data-testid="flow-summary">
          {failedStep >= 0 ? `Stopped at step ${failedStep + 1}` : 'All steps passed'}
        </div>
      )}

      <div className="flow-steps">
        {flow.steps.map((step, index) => (
          <FlowStep
            key={step.id}
            index={index}
            count={flow.steps.length}
            step={step}
            request={requestOf(step.requestPath)}
            result={results[index]}
            disabled={running}
            onChange={(next) => changeStep(index, next)}
            onMove={(direction) => moveStep(index, direction)}
            onRemove={() => removeStep(index)}
          />
        ))}
      </div>

      <div className="flow-add">
        <Select
          data={requests.map(({ item, requestPath }) => ({ value: requestPath, label: `${item.request.method} ${requestPath}` }))}
          value=""
          onChange={addStep}
          placeholder={requests.length ? 'Add a request as the next step' : 'This application has no HTTP requests yet'}
          disabled={running || requests.length === 0}
          searchable
          nothingFoundMessage="No request matches"
          aria-label="Add step"
        />
      </div>
    </StyledWrapper>
  );
};

export default FlowEditor;
