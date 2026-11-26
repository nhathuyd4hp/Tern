import jsyaml from 'js-yaml';
import { DEFAULT_AUTH_PLACEMENT, DEFAULT_REQUEST_NAME_SOURCE } from '@usebruno/common';
import { getRelativePath } from 'utils/common/path';
import { convertOpenapiToBruno } from './openapi-collection';
import { convertProtoToBruno } from './proto-collection';

const OPENAPI_GROUP_BY = 'tags';

export const parseSpecContent = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    return jsyaml.load(content);
  }
};

export const getProtoName = (filePath) => filePath.split(/[\\/]/).pop().replace(/\.proto$/i, '');

/**
 * Requests of an OpenAPI spec for a collection inside an application, plus the sync entry that keeps the
 * collection connected to the spec (the electron side adds its `folder` and stores the raw spec).
 */
export const buildOpenApiFolderImport = ({ spec, specContent, sourceUrl }) => {
  const options = { groupBy: OPENAPI_GROUP_BY, authPlacement: DEFAULT_AUTH_PLACEMENT, requestNameSource: DEFAULT_REQUEST_NAME_SOURCE };
  const { items } = convertOpenapiToBruno(spec, options);

  return {
    items,
    openapiSync: {
      entry: { sourceUrl, ...options, autoCheck: true, autoCheckInterval: 5 },
      specContent
    }
  };
};

const addMissing = (existing = [], additions) => [
  ...existing,
  ...additions.filter((addition) => !existing.some((entry) => entry.path === addition.path))
];

/**
 * Requests of a .proto file (a collection per service) for a collection inside an application, plus the
 * application's protobuf config with the file and its directory added (relative to the application, no duplicates).
 * Returns `protobuf: null` when the config already has both.
 */
export const buildProtoFolderImport = async ({ filePath, methods }, { collectionPathname, protobuf = {} }) => {
  const { items, brunoConfig } = await convertProtoToBruno({ filePath, methods });
  const [{ path: protoPath }] = brunoConfig.protobuf.protoFiles;
  const [{ path: importPath }] = brunoConfig.protobuf.importPaths;

  const protoFiles = addMissing(protobuf.protoFiles, [{ path: getRelativePath(collectionPathname, protoPath, true), type: 'file' }]);
  const importPaths = addMissing(protobuf.importPaths, [{ path: getRelativePath(collectionPathname, importPath, true), enabled: true }]);
  const changed = protoFiles.length !== (protobuf.protoFiles || []).length || importPaths.length !== (protobuf.importPaths || []).length;

  return { items, protobuf: changed ? { ...protobuf, protoFiles, importPaths } : null };
};
