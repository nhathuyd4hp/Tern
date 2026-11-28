import { IconX } from '@tabler/icons';
import Select from 'ui/Select';
import statusCodePhraseMap from 'components/ResponsePane/StatusCode/get-status-code-phrase';
import { GRPC_STATUSES, OTHER_STATUS, WS_STATUSES, getRequestStatuses, getStatusKind, isStatusKey } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

// The statuses a request of this kind can end with: HTTP codes, gRPC statuses or WebSocket outcomes.
const statusChoicesOf = (request) => {
  if (request?.type === 'grpc-request') return GRPC_STATUSES.map((status) => ({ value: status, label: status }));
  if (request?.type === 'ws-request') return WS_STATUSES.map((status) => ({ value: status, label: status }));
  return Object.keys(statusCodePhraseMap).filter(isStatusKey).map((status) => ({ value: status, label: `${status} ${statusCodePhraseMap[status]}` }));
};

// Every status listed here is an exit of the request on the canvas. Those of the spec are there from the start;
// the others are picked from the list of status codes. Any of them can be taken away while nothing is connected to it.
const StatusSection = ({ node, request, connected, disabled, onChange }) => {
  const documented = getRequestStatuses(request).filter((status) => status !== OTHER_STATUS);
  const shown = new Set([...documented, ...node.statuses].filter((status) => !node.hidden.includes(status)));
  const otherShown = !node.hidden.includes(OTHER_STATUS);
  // what can still be added: Other once it was taken away, and every status code not listed yet
  const options = [
    ...(otherShown ? [] : [{ value: OTHER_STATUS, label: 'Other: any other status' }]),
    ...statusChoicesOf(request).filter((choice) => !shown.has(choice.value))
  ];

  const add = (status) => {
    if (!isStatusKey(status) || shown.has(status)) return;
    const hidden = node.hidden.filter((existing) => existing !== status);
    onChange({ ...node, hidden, statuses: documented.includes(status) ? node.statuses : [...new Set([...node.statuses, status])].sort() });
  };
  const remove = (status) => onChange({
    ...node,
    statuses: node.statuses.filter((existing) => existing !== status),
    hidden: documented.includes(status) || status === OTHER_STATUS ? [...new Set([...node.hidden, status])].sort() : node.hidden
  });
  const restoreOther = () => onChange({ ...node, hidden: node.hidden.filter((status) => status !== OTHER_STATUS) });

  const rows = [...shown].map((status) => ({ status, fromSpec: documented.includes(status) })).sort((a, b) => Number(a.status) - Number(b.status));
  const removeButton = (status) => (
    <button
      type="button"
      className="status-remove"
      aria-label={`Remove status ${status}`}
      title={connected.has(status) ? 'Disconnect it on the canvas first' : 'Remove'}
      disabled={disabled || connected.has(status)}
      onClick={() => remove(status)}
    >
      <IconX size={14} />
    </button>
  );

  return (
    <StyledWrapper className="panel-section" data-testid="node-statuses">
      <div className="panel-subtitle">Branch on status</div>
      <p className="status-hint">Each status is an exit of this request: connect it to the request that should run next.</p>

      <ul className="status-list">
        {rows.map(({ status, fromSpec }) => (
          <li className={`status-row ${getStatusKind(status)}`} key={status}>
            <span className="status-code">{status}</span>
            <span className="status-phrase">{statusCodePhraseMap[status] || ''}</span>
            <span className="status-actions">
              {fromSpec && <span className="status-origin">from spec</span>}
              {removeButton(status)}
            </span>
          </li>
        ))}
        {otherShown && (
          <li className="status-row other">
            <span className="status-code">Other</span>
            <span className="status-phrase">Any other status</span>
            <span className="status-actions">{removeButton(OTHER_STATUS)}</span>
          </li>
        )}
      </ul>

      <div className="status-add">
        <Select
          data={options}
          value={null}
          onChange={(status) => (status === OTHER_STATUS ? restoreOther() : add(status))}
          placeholder="Add a status"
          searchable
          nothingFoundMessage="No status matches"
          disabled={disabled}
          aria-label="Add a status"
        />
      </div>
    </StyledWrapper>
  );
};

export default StatusSection;
