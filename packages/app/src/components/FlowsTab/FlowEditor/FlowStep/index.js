import { useMemo, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { IconArrowDown, IconArrowUp, IconCheck, IconGripVertical, IconLoader2, IconPlus, IconX } from '@tabler/icons';
import Button from 'ui/Button';
import MethodBadge from 'ui/MethodBadge';
import Select from 'ui/Select';
import { FLOW_DRAG } from 'utils/flows';
import { getResponseFields } from 'utils/flows/responseFields';
import StyledWrapper from './StyledWrapper';

const shorten = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};

const ResultLine = ({ result }) => {
  if (!result) return null;
  if (result.status === 'running') {
    return <span className="result running"><IconLoader2 size={14} className="animate-spin" /> Running…</span>;
  }
  if (result.status === 'skipped') return <span className="result skipped">Skipped</span>;
  const detail = [result.httpStatus, result.duration != null ? `${result.duration} ms` : null].filter(Boolean).join(' · ');
  return result.status === 'passed'
    ? <span className="result passed"><IconCheck size={14} strokeWidth={2.5} /> {detail || 'Passed'}</span>
    : <span className="result failed"><IconX size={14} strokeWidth={2.5} /> {detail || 'Failed'}</span>;
};

const FlowStep = ({ index, count, step, request, result, disabled, onChange, onMove, onRemove, onDrop }) => {
  const rootRef = useRef(null);
  const handleRef = useRef(null);
  const [{ dragging }, drag, preview] = useDrag({
    type: FLOW_DRAG.step,
    item: { index },
    canDrag: !disabled,
    collect: (monitor) => ({ dragging: monitor.isDragging() })
  });
  const [{ over }, drop] = useDrop({
    accept: [FLOW_DRAG.step, FLOW_DRAG.request],
    canDrop: () => !disabled,
    drop: (dragged, monitor) => onDrop(index, monitor.getItemType(), dragged),
    collect: (monitor) => ({ over: monitor.isOver({ shallow: true }) && monitor.canDrop() })
  });
  drag(handleRef);
  drop(preview(rootRef));

  const fields = useMemo(() => getResponseFields(request), [request]);
  // a row is picked from the known fields while it is empty or holds one of them; a typed expression stays a text box
  const canPick = (extraction) => fields.length > 0 && (!extraction.expression || fields.some((field) => field.expression === extraction.expression));
  const pickField = (position, expression) => {
    const field = fields.find((candidate) => candidate.expression === expression);
    if (!field) return;
    const current = step.extractions[position];
    changeExtraction(position, { expression, name: current.name && fields.every((candidate) => candidate.name !== current.name) ? current.name : field.name });
  };
  const changeExtraction = (position, next) => onChange({
    ...step,
    extractions: step.extractions.map((extraction, i) => (i === position ? { ...extraction, ...next } : extraction))
  });
  const addExtraction = () => onChange({ ...step, extractions: [...step.extractions, { name: '', expression: '' }] });
  const removeExtraction = (position) => onChange({ ...step, extractions: step.extractions.filter((_, i) => i !== position) });

  return (
    <StyledWrapper ref={rootRef} className={`${result?.status || ''} ${dragging ? 'dragging' : ''} ${over ? 'drop-target' : ''}`} data-testid="flow-step">
      <div className="step-head">
        <span ref={handleRef} className={`step-grip ${disabled ? 'disabled' : ''}`} title="Drag to move">
          <IconGripVertical size={16} />
        </span>
        <span className="step-number">{index + 1}</span>
        {request ? <MethodBadge method={request.request.method} /> : null}
        <span className={`step-request ${request ? '' : 'missing'}`}>
          {request ? step.requestPath : `Request not found: ${step.requestPath}`}
        </span>
        <ResultLine result={result} />
        <div className="step-actions">
          <Button size="xs" variant="ghost" color="secondary" disabled={disabled || index === 0} icon={<IconArrowUp size={14} />} onClick={() => onMove(-1)} title="Move up" />
          <Button size="xs" variant="ghost" color="secondary" disabled={disabled || index === count - 1} icon={<IconArrowDown size={14} />} onClick={() => onMove(1)} title="Move down" />
          <Button size="xs" variant="ghost" color="danger" disabled={disabled} icon={<IconX size={14} />} onClick={onRemove} title="Remove step" />
        </div>
      </div>

      {result?.error && <div className="step-error">{result.error}</div>}

      <div className="step-extractions">
        {step.extractions.map((extraction, position) => (
          <div className="extraction-row" key={position}>
            <input
              className="extraction-name"
              aria-label="Variable name"
              placeholder="token"
              value={extraction.name}
              disabled={disabled}
              onChange={(event) => changeExtraction(position, { name: event.target.value })}
            />
            <span className="extraction-equals">=</span>
            {canPick(extraction) ? (
              <div className="extraction-picker">
                <Select
                  data={fields
                    .filter((field) => field.expression === extraction.expression || !step.extractions.some((other) => other.expression === field.expression))
                    .map((field) => ({ value: field.expression, label: `${field.label}  =  ${field.sample}` }))}
                  value={extraction.expression}
                  onChange={(expression) => pickField(position, expression)}
                  placeholder="Pick a value from the response"
                  searchable
                  nothingFoundMessage="No field matches"
                  disabled={disabled}
                  aria-label="Value from the response"
                />
              </div>
            ) : (
              <input
                className="extraction-expression"
                aria-label="Expression on the response"
                placeholder="res.body.data.token"
                value={extraction.expression}
                disabled={disabled}
                onChange={(event) => changeExtraction(position, { expression: event.target.value })}
              />
            )}
            <Button size="xs" variant="ghost" color="secondary" disabled={disabled} icon={<IconX size={14} />} onClick={() => removeExtraction(position)} title="Remove value" />
            {result?.extracted && extraction.name in result.extracted && (
              <span className="extraction-value" title={String(result.extracted[extraction.name])}>{shorten(result.extracted[extraction.name])}</span>
            )}
          </div>
        ))}
        <Button size="xs" variant="ghost" disabled={disabled} icon={<IconPlus size={14} />} onClick={addExtraction}>
          Take a value from the response
        </Button>
      </div>
    </StyledWrapper>
  );
};

export default FlowStep;
