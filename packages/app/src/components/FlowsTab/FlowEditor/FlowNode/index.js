import { Handle, Position } from '@xyflow/react';
import { IconCheck, IconLoader2, IconX } from '@tabler/icons';
import MethodBadge from 'ui/MethodBadge';
import statusCodePhraseMap from 'components/ResponsePane/StatusCode/get-status-code-phrase';
import { OTHER_STATUS } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

const statusKind = (status) => {
  const code = Number(status);
  if (status === OTHER_STATUS || !Number.isFinite(code)) return 'other';
  if (code < 300) return 'ok';
  if (code < 400) return 'redirect';
  return 'error';
};

const ResultLine = ({ result }) => {
  if (!result) return null;
  if (result.status === 'running') return <span className="node-result running"><IconLoader2 size={14} className="animate-spin" /> Running…</span>;
  const detail = [result.httpStatus, result.duration != null ? `${result.duration} ms` : null].filter(Boolean).join(' · ');
  return result.status === 'passed'
    ? <span className="node-result passed"><IconCheck size={14} strokeWidth={2.5} /> {detail || 'Passed'}</span>
    : <span className="node-result failed"><IconX size={14} strokeWidth={2.5} /> {detail || 'Failed'}</span>;
};

// A request on the canvas: it comes in on the left and leaves on the right through one handle per status of its response.
const FlowNode = ({ data, selected }) => {
  const { request, requestPath, statuses, result } = data;

  return (
    <StyledWrapper className={`${selected ? 'selected' : ''} ${result ? result.status : ''}`} data-testid="flow-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-head" title={request?.name ? `${request.name}\n${requestPath}` : requestPath}>
        {request ? <MethodBadge method={request.request.method} className="node-method" /> : null}
        <span className={`node-path ${request ? '' : 'missing'}`}>
          {request ? requestPath : `Request not found: ${requestPath}`}
        </span>
      </div>
      <ResultLine result={result} />
      {result?.error && <div className="node-error">{result.error}</div>}
      <div className="node-statuses">
        {statuses.map((status) => (
          <div className={`node-status ${statusKind(status)}`} key={status} data-testid={`flow-status-${status}`}>
            <span className="status-code">{status === OTHER_STATUS ? 'Other' : status}</span>
            {statusCodePhraseMap[status] && <span className="status-phrase">{statusCodePhraseMap[status]}</span>}
            <Handle type="source" position={Position.Right} id={status} className={`status-handle ${statusKind(status)}`} />
          </div>
        ))}
      </div>
    </StyledWrapper>
  );
};

export default FlowNode;
