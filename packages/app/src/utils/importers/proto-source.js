import { loadGrpcMethodsFromProtoFile } from 'utils/network/index';
import { formatIpcError } from 'utils/common/error';
import { getProtoName } from './folder-source';

export const getProtoNameFromUrl = (sourceUrl) => {
  try {
    return getProtoName(decodeURIComponent(new URL(sourceUrl).pathname));
  } catch {
    return '';
  }
};

const readMethods = async (filePath) => {
  const { success, methods, error } = await loadGrpcMethodsFromProtoFile(filePath);
  return success ? { methods } : { error: `Could not read the proto file: ${error}` };
};

/**
 * Loads the gRPC methods of a proto source: a local file (`mode: 'file'`) or a URL (`mode: 'url'`).
 * A downloaded file is only staged in a temp file long enough to parse it; its text stays in `content`
 * until `materializeProtoSource` writes it into the application.
 * Returns { protoData, name } or { error }.
 */
export const loadProtoSource = async (mode, value, fetchContext = {}) => {
  try {
    if (mode === 'file') {
      const { methods, error } = await readMethods(value);
      return error ? { error } : { protoData: { filePath: value, methods }, name: getProtoName(value) };
    }

    const sourceUrl = value.trim();
    const fetched = await window.ipcRenderer.invoke('renderer:fetch-proto-file', { ...fetchContext, sourceUrl });
    if (fetched.error) return { error: fetched.error };
    try {
      const { methods, error } = await readMethods(fetched.tempPath);
      const name = getProtoNameFromUrl(sourceUrl);
      return error ? { error } : { protoData: { content: fetched.content, name, methods }, name };
    } finally {
      await window.ipcRenderer.invoke('renderer:remove-temp-proto-file', { tempPath: fetched.tempPath });
    }
  } catch (err) {
    return { error: formatIpcError(err) || 'Could not read the proto file.' };
  }
};

/** A downloaded proto becomes <application>/protos/<name>.proto; a local file is used where it is. */
export const materializeProtoSource = async (protoData, collectionPath) => {
  if (protoData.content == null) return protoData;
  const { pathname } = await window.ipcRenderer.invoke('renderer:save-proto-into-application', {
    collectionPath,
    name: protoData.name,
    content: protoData.content
  });
  return { filePath: pathname, methods: protoData.methods };
};
