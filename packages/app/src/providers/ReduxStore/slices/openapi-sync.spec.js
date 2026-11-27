import toast from 'react-hot-toast';
import { reloadApplication } from './openapi-sync';

jest.mock('react-hot-toast', () => {
  const mockToast = jest.fn();
  mockToast.loading = jest.fn(() => 'toast-1');
  mockToast.success = jest.fn();
  mockToast.error = jest.fn();
  return { __esModule: true, default: mockToast };
});

const application = (openapi) => ({
  uid: 'app-1',
  name: 'Shop',
  pathname: '/apps/Shop',
  brunoConfig: { openapi },
  items: [
    { uid: 'f1', type: 'folder', name: 'Users', pathname: '/apps/Shop/Users', items: [] },
    { uid: 'f2', type: 'folder', name: 'Orders', pathname: '/apps/Shop/Orders', items: [] },
    { uid: 'f3', type: 'folder', name: 'Local', pathname: '/apps/Shop/Local', items: [] }
  ]
});

const run = (app, invoke) => {
  window.ipcRenderer = { invoke };
  const dispatch = jest.fn((action) => (typeof action === 'function' ? action(dispatch, () => ({ collections: { collections: [app] } })) : action));
  return dispatch(reloadApplication(app));
};

describe('reloadApplication', () => {
  beforeEach(() => jest.clearAllMocks());

  it('syncs every connected collection, skips the others and says how many were reloaded', async () => {
    const invoke = jest.fn(async (channel) => (channel === 'renderer:compare-openapi-specs' ? { isValid: true } : {}));

    const result = await run(application([{ folder: 'Users', sourceUrl: 'u.yaml' }, { folder: 'Orders', sourceUrl: 'o.yaml' }]), invoke);

    expect(result).toEqual({ total: 2, reloaded: 2, failed: [] });
    const applied = invoke.mock.calls.filter(([channel]) => channel === 'renderer:apply-openapi-sync').map(([, payload]) => payload.folder);
    expect(applied).toEqual(['Users', 'Orders']);
    expect(toast.success).toHaveBeenCalledWith('Reloaded 2 collections', { id: 'toast-1' });
  });

  it('goes on after a collection fails and names it', async () => {
    const invoke = jest.fn(async (channel, payload) => {
      if (channel === 'renderer:compare-openapi-specs') return payload.folder === 'Users' ? { error: 'cannot fetch' } : { isValid: true };
      return {};
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await run(application([{ folder: 'Users', sourceUrl: 'u.yaml' }, { folder: 'Orders', sourceUrl: 'o.yaml' }]), invoke);

    expect(result).toEqual({ total: 2, reloaded: 1, failed: ['Users'] });
    expect(invoke.mock.calls.filter(([channel]) => channel === 'renderer:apply-openapi-sync')).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith('Reloaded 1 collection, 1 failed: Users', { id: 'toast-1' });
  });

  it('says so when no collection is connected to a spec', async () => {
    const invoke = jest.fn();

    const result = await run(application([]), invoke);

    expect(result).toEqual({ total: 0, reloaded: 0, failed: [] });
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('No collection is synced with an OpenAPI spec');
  });
});
