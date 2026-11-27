import { useMemo } from 'react';
import { IconPlus, IconTrash, IconX } from '@tabler/icons';
import Button from 'ui/Button';
import MethodBadge from 'ui/MethodBadge';
import Select from 'ui/Select';
import { getResponseFields } from 'utils/flows/responseFields';
import StyledWrapper from './StyledWrapper';

const shorten = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};

// A value left as the request has it is not stored, so the request can still change underneath.
const withOverride = (overrides, name, value, saved) => {
  const rest = Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== name));
  return value === saved ? rest : { ...rest, [name]: value };
};

const InputRows = ({ title, entries, overrides, disabled, onChange }) => {
  if (!entries.length) return null;
  return (
    <div className="panel-section">
      <div className="panel-subtitle">{title}</div>
      {entries.map((entry) => (
        <label className="input-row" key={entry.name}>
          <span className="input-name" title={entry.name}>{entry.name}</span>
          <input
            aria-label={`${title} ${entry.name}`}
            value={entry.name in overrides ? overrides[entry.name] : entry.value || ''}
            disabled={disabled}
            onChange={(event) => onChange(entry.name, event.target.value, entry.value || '')}
          />
        </label>
      ))}
    </div>
  );
};

// What a selected request of the flow sends, and which values it takes from the response.
const NodePanel = ({ node, request, result, disabled, onChange, onRemove }) => {
  const fields = useMemo(() => getResponseFields(request), [request]);
  const { inputs, extractions } = node;

  const params = (request?.request?.params || []).filter((param) => param.type === 'query' || param.type === 'path');
  const headers = request?.request?.headers || [];
  const body = request?.request?.body;
  const savedBody = body?.json || '';

  const setInputs = (next) => onChange({ ...node, inputs: { ...inputs, ...next } });
  const setExtractions = (next) => onChange({ ...node, extractions: next });
  const changeExtraction = (position, next) => setExtractions(extractions.map((extraction, i) => (i === position ? { ...extraction, ...next } : extraction)));

  // a row is picked from the known fields while it is empty or holds one of them; a typed expression stays a text box
  const canPick = (extraction) => fields.length > 0 && (!extraction.expression || fields.some((field) => field.expression === extraction.expression));
  const pickField = (position, expression) => {
    const field = fields.find((candidate) => candidate.expression === expression);
    if (!field) return;
    const current = extractions[position];
    changeExtraction(position, { expression, name: current.name && fields.every((candidate) => candidate.name !== current.name) ? current.name : field.name });
  };

  return (
    <StyledWrapper data-testid="node-panel">
      <div className="panel-head">
        {request ? <MethodBadge method={request.request.method} /> : null}
        <span className="panel-request" title={node.requestPath}>{node.requestPath}</span>
        <Button size="xs" variant="ghost" color="danger" disabled={disabled} icon={<IconTrash size={14} />} onClick={onRemove} title="Remove request" />
      </div>

      <p className="panel-hint">
        Fill the input of this request. Use <code>{'{{name}}'}</code> for a value taken from the response of an earlier request.
      </p>

      <InputRows
        title="Params"
        entries={params}
        overrides={inputs.params}
        disabled={disabled}
        onChange={(name, value, saved) => setInputs({ params: withOverride(inputs.params, name, value, saved) })}
      />
      <InputRows
        title="Headers"
        entries={headers}
        overrides={inputs.headers}
        disabled={disabled}
        onChange={(name, value, saved) => setInputs({ headers: withOverride(inputs.headers, name, value, saved) })}
      />
      {body?.mode === 'json' && (
        <div className="panel-section">
          <div className="panel-subtitle">Body (JSON)</div>
          <textarea
            aria-label="Body"
            className="body-input"
            rows={8}
            value={inputs.body === null ? savedBody : inputs.body}
            disabled={disabled}
            onChange={(event) => setInputs({ body: event.target.value === savedBody ? null : event.target.value })}
          />
        </div>
      )}

      <div className="panel-section">
        <div className="panel-subtitle">Values taken from the response</div>
        {extractions.map((extraction, position) => (
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
                    .filter((field) => field.expression === extraction.expression || !extractions.some((other) => other.expression === field.expression))
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
            <Button size="xs" variant="ghost" color="secondary" disabled={disabled} icon={<IconX size={14} />} onClick={() => setExtractions(extractions.filter((_, i) => i !== position))} title="Remove value" />
            {result?.extracted && extraction.name in result.extracted && (
              <span className="extraction-value" title={String(result.extracted[extraction.name])}>{shorten(result.extracted[extraction.name])}</span>
            )}
          </div>
        ))}
        <Button size="xs" variant="ghost" disabled={disabled} icon={<IconPlus size={14} />} onClick={() => setExtractions([...extractions, { name: '', expression: '' }])}>
          Take a value from the response
        </Button>
      </div>
    </StyledWrapper>
  );
};

export default NodePanel;
