import { useMemo, useRef } from 'react';
import { IconLock, IconPlus, IconTrash, IconX } from '@tabler/icons';
import Button from 'ui/Button';
import MethodBadge from 'ui/MethodBadge';
import Select from 'ui/Select';
import { freeVariableName, getRequestUrlPath, getVariableNameProblem } from 'utils/flows';
import { getResponseFields } from 'utils/flows/responseFields';
import ResponseView from './ResponseView';
import StatusSection from './StatusSection';
import StyledWrapper from './StyledWrapper';
import ValuePicker from './ValuePicker';
import VariableField from './VariableField';

const shorten = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};

// A value left as the request has it is not stored, so the request can still change underneath.
const withOverride = (overrides, name, value, saved) => {
  const rest = Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== name));
  return value === saved ? rest : { ...rest, [name]: value };
};

const InputRows = ({ title, entries, overrides, disabled, onChange, renderPicker, suggestions }) => {
  if (!entries.length) return null;
  return (
    <div className="panel-section">
      <div className="panel-subtitle">{title}</div>
      {entries.map((entry) => (
        <label className="input-row" key={entry.name}>
          <span className="input-name" title={entry.name}>{entry.name}</span>
          <VariableField
            aria-label={`${title} ${entry.name}`}
            value={entry.name in overrides ? overrides[entry.name] : entry.value || ''}
            disabled={disabled}
            suggestions={suggestions}
            onValueChange={(value) => onChange(entry.name, value, entry.value || '')}
          />
          {renderPicker(entry)}
        </label>
      ))}
    </div>
  );
};

// What a selected request of the flow sends, and which values it takes from the response.
const NodePanel = ({ width, flow, node, request, upstream, results, result, disabled, onChange, onChangeMany, onRemove }) => {
  const bodyRef = useRef(null);
  const fields = useMemo(() => getResponseFields(request), [request]);
  const { inputs, extractions } = node;

  const params = (request?.request?.params || []).filter((param) => param.type === 'query' || param.type === 'path');
  const headers = request?.request?.headers || [];
  const body = request?.request?.body;
  const savedBody = body?.json || '';

  const setInputs = (next) => onChange({ ...node, inputs: { ...inputs, ...next } });
  const setExtractions = (next) => onChange({ ...node, extractions: next });
  const changeExtraction = (position, next) => setExtractions(extractions.map((extraction, i) => (i === position ? { ...extraction, ...next } : extraction)));

  // Uses a value of an earlier request here: that request is made to take the field as a variable (once), and the
  // variable is put where the user asked. Both nodes change in one go, as the flow is saved as a whole.
  const takeEarlierValue = ({ source, field }, apply) => {
    const existing = source.extractions.find((extraction) => extraction.expression === field.expression);
    const name = existing ? existing.name : freeVariableName(flow, field.name);
    const nextSource = existing ? source : { ...source, extractions: [...source.extractions, { name, expression: field.expression }] };
    const nextNode = apply(`{{${name}}}`);
    onChangeMany([nextNode, nextSource]);
  };

  const pickerFor = (apply) => (
    <ValuePicker upstream={upstream} disabled={disabled} onPick={(choice) => takeEarlierValue(choice, apply)} />
  );

  const setEntry = (kind, entry, value) => ({ ...node, inputs: { ...inputs, [kind]: withOverride(inputs[kind], entry.name, value, entry.value || '') } });

  const insertIntoBody = (token) => {
    const current = inputs.body === null ? savedBody : inputs.body;
    const at = bodyRef.current?.selectionStart ?? current.length;
    const next = `${current.slice(0, at)}${token}${current.slice(at)}`;
    return { ...node, inputs: { ...inputs, body: next === savedBody ? null : next } };
  };

  // the values the earlier requests share, with the one they had in the last run
  const earlierValues = upstream.flatMap(({ node: source, request: sourceRequest }) => source.extractions
    .filter((extraction) => extraction.name)
    .map((extraction) => ({
      key: `${source.id}|${extraction.name}`,
      name: extraction.name,
      source: `${sourceRequest.request.method} ${getRequestUrlPath(sourceRequest)}`,
      expression: extraction.expression,
      value: results?.[source.id]?.extracted?.[extraction.name]
    })));

  // a row is picked from the known fields while it is empty or holds one of them; a typed expression stays a text box
  const canPick = (extraction) => fields.length > 0 && (!extraction.expression || fields.some((field) => field.expression === extraction.expression));
  const pickField = (position, expression) => {
    const field = fields.find((candidate) => candidate.expression === expression);
    if (!field) return;
    const current = extractions[position];
    changeExtraction(position, { expression, name: current.name && fields.every((candidate) => candidate.name !== current.name) ? current.name : field.name });
  };

  return (
    <StyledWrapper data-testid="node-panel" style={{ flex: `0 1 ${width}px` }}>
      <div className="panel-head">
        {request ? <MethodBadge method={request.request.method} /> : null}
        <span className="panel-request" title={node.requestPath}>{request ? getRequestUrlPath(request) : node.requestPath}</span>
        <Button size="xs" variant="ghost" color="danger" disabled={disabled} icon={<IconTrash size={14} />} onClick={onRemove} title="Remove request" />
      </div>

      <p className="panel-hint">
        Fill the input of this request. The braces button puts in a value taken from an earlier request; you can also type <code>{'{{name}}'}</code>.
      </p>

      <InputRows
        title="Params"
        entries={params}
        overrides={inputs.params}
        disabled={disabled}
        onChange={(name, value, saved) => setInputs({ params: withOverride(inputs.params, name, value, saved) })}
        renderPicker={(entry) => pickerFor((token) => setEntry('params', entry, token))}
        suggestions={earlierValues}
      />
      <InputRows
        title="Headers"
        entries={headers}
        overrides={inputs.headers}
        disabled={disabled}
        onChange={(name, value, saved) => setInputs({ headers: withOverride(inputs.headers, name, value, saved) })}
        renderPicker={(entry) => pickerFor((token) => setEntry('headers', entry, token))}
        suggestions={earlierValues}
      />
      {body?.mode === 'json' && (
        <div className="panel-section">
          <div className="panel-subtitle-row">
            <div className="panel-subtitle">Body (JSON)</div>
            {pickerFor(insertIntoBody)}
          </div>
          <VariableField
            multiline
            inputRef={bodyRef}
            aria-label="Body"
            className="body-input"
            rows={8}
            value={inputs.body === null ? savedBody : inputs.body}
            disabled={disabled}
            suggestions={earlierValues}
            onValueChange={(text) => setInputs({ body: text === savedBody ? null : text })}
          />
        </div>
      )}

      {(result?.error || typeof result?.response?.status === 'number') && (
        <div className="panel-section">
          <div className="panel-subtitle">Response</div>
          {result.error && <div className="panel-error">{result.error}</div>}
          {typeof result.response?.status === 'number' && <ResponseView response={result.response} />}
        </div>
      )}

      <StatusSection node={node} request={request} disabled={disabled} onChange={onChange} />

      <div className="panel-section">
        <div className="panel-subtitle">Share values of this response</div>
        <p className="panel-hint">Later requests can use them as <code>{'{{name}}'}</code>. Values of earlier requests are listed too, read only.</p>
        <div className="share-table" data-testid="share-table">
          <div className="share-row share-head">
            <span>Name</span>
            <span>Value</span>
            <span>From</span>
          </div>
          {earlierValues.map((entry) => (
            <div className="share-row readonly" key={entry.key} data-testid="earlier-value-row">
              <span className="share-name"><IconLock size={12} /> <code>{'{{' + entry.name + '}}'}</code></span>
              <span className="share-value" title={entry.value !== undefined ? String(entry.value) : entry.expression}>
                {entry.value !== undefined ? shorten(entry.value) : entry.expression}
              </span>
              <span className="share-from" title={entry.source}>{entry.source}</span>
            </div>
          ))}
          {extractions.map((extraction, position) => {
            const nameProblem = getVariableNameProblem(flow, node.id, position, extraction.name);
            return (
              <div key={position}>
                <div className="share-row">
                  <input
                    className={`extraction-name ${nameProblem ? 'invalid' : ''}`}
                    aria-invalid={Boolean(nameProblem)}
                    aria-label="Variable name"
                    placeholder="Variable name"
                    value={extraction.name}
                    disabled={disabled}
                    onChange={(event) => changeExtraction(position, { name: event.target.value })}
                  />
                  {canPick(extraction) ? (
                    <div className="extraction-picker">
                      <Select
                        data={fields
                          .filter((field) => field.expression === extraction.expression || !extractions.some((other) => other.expression === field.expression))
                          .map((field) => ({ value: field.expression, label: field.expression === extraction.expression ? field.expression : field.label }))}
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
                      placeholder="res.body.field"
                      value={extraction.expression}
                      disabled={disabled}
                      onChange={(event) => changeExtraction(position, { expression: event.target.value })}
                    />
                  )}
                  <span className="share-from own">
                    This request
                    <Button size="xs" variant="ghost" color="secondary" disabled={disabled} icon={<IconX size={14} />} onClick={() => setExtractions(extractions.filter((_, i) => i !== position))} title="Remove value" />
                  </span>
                </div>
                {result?.extracted && extraction.name in result.extracted && (
                  <div className="share-last" title={String(result.extracted[extraction.name])}>last run: {shorten(result.extracted[extraction.name])}</div>
                )}
                {nameProblem && <div className="extraction-error" role="alert">{nameProblem}</div>}
              </div>
            );
          })}
        </div>
        <Button size="xs" variant="ghost" disabled={disabled} icon={<IconPlus size={14} />} onClick={() => setExtractions([...extractions, { name: '', expression: '' }])}>
          Take a value from the response
        </Button>
      </div>
    </StyledWrapper>
  );
};

export default NodePanel;
