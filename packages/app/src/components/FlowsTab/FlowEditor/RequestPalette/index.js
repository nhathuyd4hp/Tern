import { Fragment, useState } from 'react';
import { useDrag } from 'react-dnd';
import { IconChevronLeft, IconPlus, IconSearch } from '@tabler/icons';
import Button from 'ui/Button';
import MethodBadge from 'ui/MethodBadge';
import Select from 'ui/Select';
import { FLOW_DRAG, FLOW_REQUEST_TYPE_LABELS, getRequestLabel } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

// What a request is, shown under its row: the name, the kind, the method and the url.
const RequestDetails = ({ request, disabled, onAdd }) => (
  <div className="palette-details" data-testid="request-details">
    <div className="details-head">
      <span className="details-name">{request.item.name}</span>
      <span className="details-type">{FLOW_REQUEST_TYPE_LABELS[request.item.type] || request.item.type}</span>
    </div>
    <div className="details-url" title={request.item.request?.url}>
      <MethodBadge method={getRequestLabel(request.item).method} />
      <span>{request.item.request?.url}</span>
    </div>
    <Button size="sm" disabled={disabled} icon={<IconPlus size={14} />} onClick={() => onAdd(request.requestPath)}>
      Add to flow
    </Button>
  </div>
);

const PaletteItem = ({ requestPath, label, method, selected, disabled, onSelect, onAdd }) => {
  const [{ dragging }, drag] = useDrag({
    type: FLOW_DRAG.request,
    item: { requestPath },
    canDrag: !disabled,
    collect: (monitor) => ({ dragging: monitor.isDragging() })
  });

  return (
    <div ref={drag} className={`palette-row ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}>
      <button type="button" className="palette-item" onClick={() => onSelect(requestPath)} title={`${requestPath}\nClick for its details, drag it onto the canvas to add it`}>
        <MethodBadge method={method} />
        <span className="palette-path">{label}</span>
      </button>
      <button type="button" className="palette-add" aria-label="Add to flow" title="Add to the flow" disabled={disabled} onClick={() => onAdd(requestPath)}>
        <IconPlus size={14} />
      </button>
    </div>
  );
};

// The requests of the application, to drag into the flow (or click to add).
const ALL = '';
const ALL_COLLECTIONS = ALL;
const ROOT = '/';

// The collection of a request is the first folder of its path; requests outside any folder belong to the application itself.
const collectionOf = (requestPath) => (requestPath.includes('/') ? requestPath.split('/')[0] : ROOT);

const RequestPalette = ({ requests, width, disabled, onAdd, onCollapse }) => {
  const [filter, setFilter] = useState('');
  const [collection, setCollection] = useState(ALL_COLLECTIONS);
  const [type, setType] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [selectedPath, setSelectedPath] = useState(null);
  const selected = requests.find(({ requestPath }) => requestPath === selectedPath) || null;
  const collections = [...new Set(requests.map(({ requestPath }) => collectionOf(requestPath)))];
  const types = [...new Set(requests.map(({ item }) => item.type))];
  const methods = [...new Set(requests.map(({ item }) => getRequestLabel(item).method))].sort();
  const shown = requests.filter(({ item, requestPath }) => {
    if (collection !== ALL_COLLECTIONS && collectionOf(requestPath) !== collection) return false;
    if (type !== ALL && item.type !== type) return false;
    if (method !== ALL && getRequestLabel(item).method !== method) return false;
    const text = filter.trim().toLowerCase();
    return [item.name, getRequestLabel(item).path, requestPath].some((candidate) => (candidate || '').toLowerCase().includes(text));
  });

  return (
    <StyledWrapper data-testid="flow-palette" style={{ flex: `0 1 ${width}px` }}>
      <div className="palette-title">
        <span>Requests</span>
        <Button size="xs" variant="ghost" color="secondary" icon={<IconChevronLeft size={14} />} onClick={onCollapse} title="Hide the list of requests" aria-label="Hide the list of requests" />
      </div>
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
      <div className="palette-filters">
        <Select
          data={[{ value: ALL, label: 'All types' }, ...types.map((value) => ({ value, label: FLOW_REQUEST_TYPE_LABELS[value] || value }))]}
          value={type}
          onChange={setType}
          aria-label="Type"
        />
        <Select
          data={[{ value: ALL, label: 'All methods' }, ...methods.map((value) => ({ value, label: value }))]}
          value={method}
          onChange={setMethod}
          aria-label="Method"
        />
      </div>
      <label className="palette-search">
        <IconSearch size={14} />
        <input
          aria-label="Search requests"
          placeholder="Search by name"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      <div className="palette-list">
        {shown.map(({ item, requestPath }) => (
          <Fragment key={item.uid}>
            <PaletteItem requestPath={requestPath} label={getRequestLabel(item).path} method={getRequestLabel(item).method} selected={requestPath === selectedPath} disabled={disabled} onSelect={(path) => setSelectedPath(path === selectedPath ? null : path)} onAdd={onAdd} />
            {selected && requestPath === selectedPath && <RequestDetails request={selected} disabled={disabled} onAdd={onAdd} />}
          </Fragment>
        ))}
        {shown.length === 0 && (
          <div className="palette-empty">{requests.length ? 'No request matches' : 'This application has no requests yet'}</div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default RequestPalette;
