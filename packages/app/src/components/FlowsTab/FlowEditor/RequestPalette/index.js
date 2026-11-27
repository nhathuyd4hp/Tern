import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { IconSearch } from '@tabler/icons';
import MethodBadge from 'ui/MethodBadge';
import { FLOW_DRAG } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

const PaletteItem = ({ requestPath, method, disabled, onAdd }) => {
  const [{ dragging }, drag] = useDrag({
    type: FLOW_DRAG.request,
    item: { requestPath },
    canDrag: !disabled,
    collect: (monitor) => ({ dragging: monitor.isDragging() })
  });

  return (
    <button
      type="button"
      ref={drag}
      className={`palette-item ${dragging ? 'dragging' : ''}`}
      disabled={disabled}
      onClick={() => onAdd(requestPath)}
      title="Drag onto the canvas, or click to add"
    >
      <MethodBadge method={method} />
      <span className="palette-path">{requestPath}</span>
    </button>
  );
};

// The requests of the application, to drag into the flow (or click to add).
const RequestPalette = ({ requests, disabled, onAdd }) => {
  const [filter, setFilter] = useState('');
  const shown = requests.filter(({ requestPath }) => requestPath.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <StyledWrapper data-testid="flow-palette">
      <div className="palette-title">Requests</div>
      <label className="palette-search">
        <IconSearch size={14} />
        <input
          aria-label="Search requests"
          placeholder="Search requests"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      <div className="palette-list">
        {shown.map(({ item, requestPath }) => (
          <PaletteItem key={item.uid} requestPath={requestPath} method={item.request.method} disabled={disabled} onAdd={onAdd} />
        ))}
        {shown.length === 0 && (
          <div className="palette-empty">{requests.length ? 'No request matches' : 'This application has no HTTP requests yet'}</div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default RequestPalette;
