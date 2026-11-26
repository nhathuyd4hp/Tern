import { useDispatch } from 'react-redux';
import { IconTrash } from '@tabler/icons';
import SpecSourcePicker from 'components/OpenAPISyncTab/SpecSourcePicker';
import { isSpecSourceReady } from 'components/OpenAPISyncTab/SpecSourcePicker/utils';
import { browseFiles } from 'providers/ReduxStore/slices/collections/actions';
import { loadGrpcMethodsFromProtoFile } from 'utils/network/index';
import { parseSpecContent, getProtoName } from 'utils/importers/folder-source';
import { formatIpcError } from 'utils/common/error';
import Button from 'ui/Button';

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
  const dispatch = useDispatch();
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

  const chooseProtoFile = async () => {
    update({ error: null });
    try {
      const [filePath] = (await dispatch(browseFiles([{ name: 'Proto Files', extensions: ['proto'] }], [''])) || []);
      if (!filePath) return;

      update({ loading: true });
      const { success, methods, error: protoError } = await loadGrpcMethodsFromProtoFile(filePath);
      if (!success) {
        update({ protoData: null, error: `Could not read the proto file: ${protoError}`, loading: false });
        return;
      }
      update({ protoData: { filePath, methods }, loading: false, ...prefillName(getProtoName(filePath)) });
    } catch (err) {
      update({ error: 'Could not read the proto file.', loading: false });
    }
  };

  return (
    <div className="border rounded-md p-3 mt-2" data-testid="create-source-row">
      <div className="flex items-center gap-2">
        <select
          className="textbox"
          value={type}
          onChange={(e) => onChange(id, { ...createSource(e.target.value), id, name: source.name, isNameEdited: source.isNameEdited })}
          aria-label="Source type"
          data-testid="create-source-type"
        >
          <option value="openapi">OpenAPI</option>
          <option value="proto">Proto file</option>
        </select>
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
        <button type="button" className="opacity-60 hover:opacity-100" onClick={() => onRemove(id)} aria-label="Remove source" data-testid="create-source-remove">
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
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" variant="filled" color="primary" size="sm" loading={loading} onClick={chooseProtoFile} data-testid="create-source-choose-proto">
            Choose .proto file
          </Button>
          <span className="text-muted truncate">{protoData ? protoData.filePath : 'Service → collection, method → request.'}</span>
        </div>
      )}
      {error && <div className="text-red-500 mt-2" data-testid="create-source-error">{error}</div>}
    </div>
  );
};

export default SourceRow;
