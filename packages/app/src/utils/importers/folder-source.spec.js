import { buildOpenApiFolderImport, buildProtoFolderImport, parseSpecContent, getProtoName } from './folder-source';

jest.mock('nanoid', () => ({ customAlphabet: () => () => 'a'.repeat(21) }));

const spec = {
  openapi: '3.0.0',
  info: { title: 'Petstore', version: '1' },
  paths: { '/pets': { get: { tags: ['pets'], summary: 'List pets', responses: { 200: { description: 'ok' } } } } }
};

describe('buildOpenApiFolderImport', () => {
  it('converts the spec into items grouped by tag and describes the sync entry', () => {
    const { items, openapiSync } = buildOpenApiFolderImport({ spec, specContent: '{}', sourceUrl: 'https://x.test/openapi.json' });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'folder', name: 'pets' });
    expect(openapiSync.entry).toEqual({
      sourceUrl: 'https://x.test/openapi.json',
      groupBy: 'tags',
      authPlacement: 'request',
      requestNameSource: 'summary',
      autoCheck: true,
      autoCheckInterval: 5
    });
    expect(openapiSync.specContent).toBe('{}');
  });

  it('parses a spec as JSON or YAML', () => {
    expect(parseSpecContent('{"a":1}')).toEqual({ a: 1 });
    expect(parseSpecContent('a: 1')).toEqual({ a: 1 });
  });
});

describe('buildProtoFolderImport', () => {
  const methods = [{ path: '/shop.Orders/Create', type: 'unary' }];

  it('keeps the service collections as items and adds the proto file and its directory to the config', async () => {
    const { items, protobuf } = await buildProtoFolderImport({ filePath: '/home/me/api/shop.proto', methods }, { collectionPathname: '/home/me/app', protobuf: {} });

    expect(items.map((folder) => folder.name)).toEqual(['shop.Orders']);
    expect(protobuf).toEqual({
      protoFiles: [{ path: '../api/shop.proto', type: 'file' }],
      importPaths: [{ path: '../api', enabled: true }]
    });
  });

  it('does not duplicate what the config already has', async () => {
    const existing = { protoFiles: [{ path: '../api/shop.proto', type: 'file' }], importPaths: [{ path: '../api', enabled: true }] };
    const result = await buildProtoFolderImport({ filePath: '/home/me/api/shop.proto', methods }, { collectionPathname: '/home/me/app', protobuf: existing });

    expect(result.protobuf).toBeNull();
  });

  it('names the collection after the proto file', () => {
    expect(getProtoName('C:\\api\\shop.proto')).toBe('shop');
  });
});
