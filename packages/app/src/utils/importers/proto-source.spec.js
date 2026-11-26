import { getProtoNameFromUrl, loadProtoSource, materializeProtoSource } from './proto-source';
import { loadGrpcMethodsFromProtoFile } from 'utils/network/index';

jest.mock('utils/network/index', () => ({ loadGrpcMethodsFromProtoFile: jest.fn() }));

describe('proto-source', () => {
  const invoke = jest.fn();

  beforeEach(() => {
    invoke.mockReset();
    loadGrpcMethodsFromProtoFile.mockReset();
    window.ipcRenderer = { invoke };
  });

  it('takes the name from the URL path', () => {
    expect(getProtoNameFromUrl('https://x.test/api/Greeter.proto?v=1')).toBe('Greeter');
    expect(getProtoNameFromUrl('not a url')).toBe('');
  });

  it('loads a local file as is', async () => {
    loadGrpcMethodsFromProtoFile.mockResolvedValue({ success: true, methods: [1] });
    const result = await loadProtoSource('file', '/p/a.proto');
    expect(result).toEqual({ protoData: { filePath: '/p/a.proto', methods: [1] }, name: 'a' });
  });

  it('parses a downloaded proto from a temp file and always removes it', async () => {
    invoke.mockImplementation(async (channel) => (channel === 'renderer:fetch-proto-file' ? { content: 'C', tempPath: '/tmp/t.proto' } : {}));
    loadGrpcMethodsFromProtoFile.mockResolvedValue({ success: false, error: 'bad syntax' });

    const result = await loadProtoSource('url', ' https://x.test/a.proto ');

    expect(result.error).toBe('Could not read the proto file: bad syntax');
    expect(invoke).toHaveBeenCalledWith('renderer:remove-temp-proto-file', { tempPath: '/tmp/t.proto' });
  });

  it('returns a fetch error without loading', async () => {
    invoke.mockResolvedValue({ error: 'Could not reach' });
    expect(await loadProtoSource('url', 'https://x.test/a.proto')).toEqual({ error: 'Could not reach' });
    expect(loadGrpcMethodsFromProtoFile).not.toHaveBeenCalled();
  });

  it('writes a downloaded proto into the application, but leaves a local file alone', async () => {
    invoke.mockResolvedValue({ pathname: '/app/protos/a.proto' });
    const saved = await materializeProtoSource({ content: 'C', name: 'a', methods: [1] }, '/app');
    expect(saved).toEqual({ filePath: '/app/protos/a.proto', methods: [1] });

    const local = { filePath: '/p/a.proto', methods: [] };
    expect(await materializeProtoSource(local, '/app')).toBe(local);
  });
});
