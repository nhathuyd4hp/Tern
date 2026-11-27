import { useState } from 'react';
import { IconPlus, IconX } from '@tabler/icons';
import statusCodePhraseMap from 'components/ResponsePane/StatusCode/get-status-code-phrase';
import { OTHER_STATUS, getRequestStatuses, getStatusKind } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

// Statuses most often branched on, offered as one-click additions.
const QUICK_STATUSES = ['201', '204', '400', '401', '403', '404', '409', '422', '429', '500'];

const isStatusCode = (value) => /^[1-5]\d{2}$/.test(value);

// Every status listed here is an exit of the request on the canvas. Those of the spec are there from the start;
// the others are added by a click or by typing a code.
const StatusSection = ({ node, request, disabled, onChange }) => {
  const [typed, setTyped] = useState('');
  const documented = getRequestStatuses(request).filter((status) => status !== OTHER_STATUS);
  const taken = new Set([...documented, ...node.statuses]);
  const quick = QUICK_STATUSES.filter((status) => !taken.has(status));

  const add = (status) => {
    if (!isStatusCode(status) || taken.has(status)) return;
    onChange({ ...node, statuses: [...node.statuses, status].sort() });
    setTyped('');
  };
  const remove = (status) => onChange({ ...node, statuses: node.statuses.filter((existing) => existing !== status) });

  const rows = [
    ...documented.map((status) => ({ status, fromSpec: true })),
    ...node.statuses.filter((status) => !documented.includes(status)).map((status) => ({ status, fromSpec: false }))
  ].sort((a, b) => Number(a.status) - Number(b.status));
  const typedIsValid = isStatusCode(typed) && !taken.has(typed);

  return (
    <StyledWrapper className="panel-section" data-testid="node-statuses">
      <div className="panel-subtitle">Branch on status</div>
      <p className="status-hint">Each status is an exit of this request: connect it to the request that should run next.</p>

      <ul className="status-list">
        {rows.map(({ status, fromSpec }) => (
          <li className={`status-row ${getStatusKind(status)}`} key={status}>
            <span className="status-code">{status}</span>
            <span className="status-phrase">{statusCodePhraseMap[status] || ''}</span>
            {fromSpec ? (
              <span className="status-origin">from spec</span>
            ) : (
              <button type="button" className="status-remove" aria-label={`Remove status ${status}`} title="Remove" disabled={disabled} onClick={() => remove(status)}>
                <IconX size={14} />
              </button>
            )}
          </li>
        ))}
        <li className="status-row other">
          <span className="status-code">Other</span>
          <span className="status-phrase">any status not listed</span>
        </li>
      </ul>

      <div className="status-add">
        <label className="status-add-label" htmlFor="status-code-input">Add a status</label>
        {quick.length > 0 && (
          <div className="status-quick">
            {quick.map((status) => (
              <button type="button" key={status} className={`status-quick-item ${getStatusKind(status)}`} title={statusCodePhraseMap[status]} disabled={disabled} onClick={() => add(status)}>
                <IconPlus size={11} />
                {status}
              </button>
            ))}
          </div>
        )}
        <div className="status-custom">
          <input
            id="status-code-input"
            className="status-input"
            aria-label="Type a status code"
            placeholder="Another code, e.g. 418"
            inputMode="numeric"
            maxLength={3}
            value={typed}
            disabled={disabled}
            onChange={(event) => setTyped(event.target.value.replace(/\D/g, ''))}
            onKeyDown={(event) => event.key === 'Enter' && add(typed)}
          />
          <button type="button" className="status-custom-add" disabled={disabled || !typedIsValid} onClick={() => add(typed)} title="Add status">
            Add
          </button>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default StatusSection;
