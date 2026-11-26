import { BrunoError } from 'utils/common/error';
import { processBrunoCollection } from './bruno-collection';

const getDirectory = (filePath) => filePath.replace(/[\\/][^\\/]*$/, '');

const getFileName = (filePath) => filePath.split(/[\\/]/).pop();

const NO_AUTH = { mode: 'none', awsv4: null, basic: null, bearer: null, digest: null, ntlm: null, oauth1: null, oauth2: null, wsse: null, apikey: null };

const toRequestItem = (method, filePath, seq) => ({
  type: 'grpc-request',
  name: method.path.split('/')[2],
  seq,
  request: {
    url: '',
    method: method.path,
    methodType: method.type,
    protoPath: filePath,
    headers: [],
    auth: NO_AUTH,
    body: { mode: 'grpc', grpc: [{ name: 'message 1', content: '{}' }] },
    script: {},
    vars: { req: [], res: [] },
    assertions: [],
    tests: '',
    docs: ''
  }
});

const toServiceFolder = (name, methods, filePath) => ({
  type: 'folder',
  name,
  root: {
    request: { auth: { mode: 'inherit', basic: null, bearer: null, digest: null, apikey: null, oauth2: null } },
    meta: { name }
  },
  items: methods.map((method, index) => toRequestItem(method, filePath, index + 1))
});

/**
 * Builds a collection from the methods of one .proto file: a folder per service, a gRPC request per method.
 * The file is referenced by its absolute path and its directory is added as an import path, because the
 * collection location is only chosen afterwards and imports inside the proto resolve against that directory.
 */
export const convertProtoToBruno = async ({ filePath, methods }) => {
  if (!methods?.length) {
    throw new BrunoError('No gRPC services were found in this proto file');
  }

  const methodsByService = new Map();
  methods.forEach((method) => {
    const service = method.path.split('/')[1];
    methodsByService.set(service, [...(methodsByService.get(service) || []), method]);
  });

  const name = getFileName(filePath).replace(/\.proto$/i, '');

  return processBrunoCollection({
    name,
    version: '1',
    items: [...methodsByService].map(([service, serviceMethods]) => toServiceFolder(service, serviceMethods, filePath)),
    environments: [],
    brunoConfig: {
      version: '1',
      name,
      type: 'collection',
      ignore: ['node_modules', '.git'],
      protobuf: {
        protoFiles: [{ path: filePath, type: 'file' }],
        importPaths: [{ path: getDirectory(filePath), enabled: true }]
      }
    }
  });
};
