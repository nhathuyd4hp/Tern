import { Handle, Position } from '@xyflow/react';
import MethodBadge from 'ui/MethodBadge';
import statusCodePhraseMap from 'components/ResponsePane/StatusCode/get-status-code-phrase';
import { OTHER_STATUS, getRequestLabel, getStatusKind as statusKind } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

// A request on the canvas: it comes in on the left and leaves on the right through one handle per status of its response.
// After a run it is green when it went well and red when it failed; the details (status, time, response, error) are in its panel.
const FlowNode = ({ data, selected }) => {
  const { request, requestPath, statuses, result } = data;

  return (
    <StyledWrapper className={`${selected ? 'selected' : ''} ${result ? result.status : ''}`} data-testid="flow-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-head" title={request?.name ? `${request.name}\n${requestPath}` : requestPath}>
        {request ? <MethodBadge method={getRequestLabel(request).method} className="node-method" /> : null}
        <span className={`node-path ${request ? '' : 'missing'}`}>
          {request ? getRequestLabel(request).path : `Request not found: ${requestPath}`}
        </span>
      </div>
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
