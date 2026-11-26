import { IconTrash } from '@tabler/icons';
import SpecSourcePicker from 'components/OpenAPISyncTab/SpecSourcePicker';
import { isSpecSourceReady, PROTO_SOURCE_PICKER_PROPS } from 'components/OpenAPISyncTab/SpecSourcePicker/utils';
import { parseSpecContent } from 'utils/importers/folder-source';
import { loadProtoSource } from 'utils/importers/proto-source';
import { formatIpcError } from 'utils/common/error';
import Button from 'ui/Button';
import Select from 'ui/Select';

export const createSource = (type) => ({
  id: `${Date.now()}-${Math.random()}`,
  type,
  name: '',
  isNameEdited: false,
  specMode: 'url',
  specValue: '',
  specData: null,
  protoData: null,
  error: null,
  loading: false
});

// One source of the new application: it becomes one collection, named after the spec title / proto file unless edited.
const SourceRow = ({ source, onChange, onRemove }) => {
  const { id, type, specMode, specValue, specData, protoData, error, loading } = source;
  const update = (patch) => onChange(id, patch);

  const prefillName = (name) => (source.isNameEdited || !name ? {} : { name });

  const loadSpec = async (sourceUrl) => {
    update({ specData: null, error: null, loading: true });
    try {
      const result = await window.ipcRenderer.invoke('renderer:fetch-openapi-spec', { sourceUrl });
      if (result.error) {
        update({ error: result.error, loading: false });
        return;
      }
      const spec = parseSpecContent(result.content);
      update({ specData: { spec, specContent: result.content, sourceUrl }, loading: false, ...prefillName(spec?.info?.title) });
    } catch (err) {
      update({ error: formatIpcError(err) || 'Failed to load the spec', loading: false });
    }
  };

  const loadProto = async (mode, value) => {
    update({ protoData: null, error: null, loading: true });
    const { protoData: loaded, name, error: protoError } = await loadProtoSource(mode, value);
    update(protoError ? { error: protoError, loading: false } : { protoData: loaded, loading: false, ...prefillName(name) });
  };

  return (
    <div className="source-row" data-testid="create-source-row">
      <div className="flex items-center gap-2">
        <div style={{ width: 150, flexShrink: 0 }}>
          <Select
            data={[
              { value: 'openapi', label: 'OpenAPI' },
              { value: 'proto', label: 'Proto file' }
            ]}
            value={type}
            allowDeselect={false}
            onChange={(next) => onChange(id, { ...createSource(next), id, name: source.name, isNameEdited: source.isNameEdited })}
            data-testid="create-source-type"
          />
        </div>
        <input
          type="text"
          className="textbox flex-1"
          placeholder="Collection name"
          aria-label="Collection name"
          autoComplete="off"
          spellCheck="false"
          value={source.name}
          onChange={(e) => update({ name: e.target.value, isNameEdited: true })}
          data-testid="create-source-name"
        />
        <button type="button" className="opacity-60 hover:opacity-100" onClick={() => onRemove(id)} aria-label="Remove collection" data-testid="create-source-remove">
          <IconTrash size={16} strokeWidth={1.5} />
        </button>
      </div>
      {type === 'openapi' && (
        <div className="mt-3">
          <SpecSourcePicker
            mode={specMode}
            onModeChange={(mode) => update({ specMode: mode, specValue: '', specData: null, error: null })}
            value={specValue}
            onChange={(value) => {
              update({ specValue: value, specData: null });
              if (specMode === 'file' && value) loadSpec(value);
            }}
            onError={(message) => update({ error: message, ...(message ? { specValue: '' } : {}) })}
            action={specMode === 'url' ? (
              <Button
                type="button"
                size="sm"
                loading={loading}
                disabled={!isSpecSourceReady(specMode, specValue)}
                onClick={() => loadSpec(specValue.trim())}
                data-testid="create-source-load-spec"
              >
                Load
              </Button>
            ) : null}
          />
          {specData && <div className="text-muted mt-2">Spec loaded: {specData.spec?.info?.title}</div>}
        </div>
      )}
      {type === 'proto' && (
        <div className="mt-3">
          <SpecSourcePicker
            {...PROTO_SOURCE_PICKER_PROPS}
            mode={specMode}
            onModeChange={(mode) => update({ specMode: mode, specValue: '', protoData: null, error: null })}
            value={specValue}
            onChange={(value) => {
              update({ specValue: value, protoData: null });
              if (specMode === 'file' && value) loadProto('file', value);
            }}
            onError={(message) => update({ error: message, ...(message ? { specValue: '' } : {}) })}
            action={specMode === 'url' ? (
              <Button
                type="button"
                size="sm"
                loading={loading}
                disabled={!isSpecSourceReady(specMode, specValue)}
                onClick={() => loadProto('url', specValue)}
                data-testid="create-source-load-proto"
              >
                Load
              </Button>
            ) : null}
          />
          <div className="text-muted mt-2">
            {protoData ? 'Proto file loaded' : 'Service → collection, method → request.'}
          </div>
        </div>
      )}
      {error && <div className="text-red-500 mt-2" data-testid="create-source-error">{error}</div>}
    </div>
  );
};

export default SourceRow;
