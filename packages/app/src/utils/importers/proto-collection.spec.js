import { convertProtoToBruno } from './proto-collection';

jest.mock('nanoid', () => ({ customAlphabet: () => () => 'a'.repeat(21) }));

const methods = [
  { path: '/shop.Orders/Create', type: 'unary' },
  { path: '/shop.Orders/Watch', type: 'server-streaming' },
  { path: '/shop.Billing/Charge', type: 'unary' }
];

describe('convertProtoToBruno', () => {
  it('makes a folder per service with a gRPC request per method, bound to the proto file', async () => {
    const collection = await convertProtoToBruno({ filePath: 'C:\\api\\shop.proto', methods });

    expect(collection.name).toBe('shop');
    expect(collection.items.map((folder) => folder.name)).toEqual(['shop.Orders', 'shop.Billing']);

    const [create, watch] = collection.items[0].items;
    expect(create).toMatchObject({
      type: 'grpc-request',
      name: 'Create',
      request: { method: '/shop.Orders/Create', methodType: 'unary', protoPath: 'C:\\api\\shop.proto' }
    });
    expect(watch.request.methodType).toBe('server-streaming');
  });

  it('registers the proto file and its directory so imports inside it resolve', async () => {
    const { brunoConfig } = await convertProtoToBruno({ filePath: '/home/me/api/shop.proto', methods });

    expect(brunoConfig.protobuf).toEqual({
      protoFiles: [{ path: '/home/me/api/shop.proto', type: 'file' }],
      importPaths: [{ path: '/home/me/api', enabled: true }]
    });
  });

  it('rejects a proto file without services', async () => {
    await expect(convertProtoToBruno({ filePath: '/a/empty.proto', methods: [] })).rejects.toThrow(/No gRPC services/);
  });
});
