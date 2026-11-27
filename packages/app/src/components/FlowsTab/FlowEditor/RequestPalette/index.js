import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { IconSearch } from '@tabler/icons';
import MethodBadge from 'ui/MethodBadge';
import Select from 'ui/Select';
import { FLOW_DRAG, getRequestUrlPath } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

const PaletteItem = ({ requestPath, label, method, disabled, onAdd }) => {
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
      title={`${requestPath}\nDrag onto the canvas, or click to add`}
    >
      <MethodBadge method={method} />
      <span className="palette-path">{label}</span>
    </button>
  );
};

// The requests of the application, to drag into the flow (or click to add).
const ALL_COLLECTIONS = '';
const ROOT = '/';

// The collection of a request is the first folder of its path; requests outside any folder belong to the application itself.
const collectionOf = (requestPath) => (requestPath.includes('/') ? requestPath.split('/')[0] : ROOT);

const RequestPalette = ({ requests, width, disabled, onAdd }) => {
  const [filter, setFilter] = useState('');
  const [collection, setCollection] = useState(ALL_COLLECTIONS);
  const collections = [...new Set(requests.map(({ requestPath }) => collectionOf(requestPath)))];
  const shown = requests.filter(({ item, requestPath }) => {
    if (collection !== ALL_COLLECTIONS && collectionOf(requestPath) !== collection) return false;
    const text = filter.trim().toLowerCase();
    return getRequestUrlPath(item).toLowerCase().includes(text) || requestPath.toLowerCase().includes(text);
  });

  return (
    <StyledWrapper data-testid="flow-palette" style={{ flex: `0 1 ${width}px` }}>
      <div className="palette-title">Requests</div>
      {collections.length > 1 && (
        <div className="palette-collection">
          <Select
            data={[{ value: ALL_COLLECTIONS, label: 'All collections' }, ...collections.map((name) => ({ value: name, label: name === ROOT ? 'Application root' : name }))]}
            value={collection}
            onChange={setCollection}
            aria-label="Collection"
          />
        </div>
      )}
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
          <PaletteItem key={item.uid} requestPath={requestPath} label={getRequestUrlPath(item)} method={item.request.method} disabled={disabled} onAdd={onAdd} />
        ))}
        {shown.length === 0 && (
          <div className="palette-empty">{requests.length ? 'No request matches' : 'This application has no HTTP requests yet'}</div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default RequestPalette;
