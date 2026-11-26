jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() }
}));

jest.mock('../services/runner-exchange', () => ({ readRunnerExchange: jest.fn(), clearRunnerResponses: jest.fn() }));

const { ipcMain } = require('electron');
const { readRunnerExchange, clearRunnerResponses } = require('../services/runner-exchange');
const { registerSqliteIpc } = require('./sqlite');

describe('registerSqliteIpc', () => {
  let handlers;

  const invoke = (channel, ...args) => handlers.get(channel)({}, ...args);

  beforeEach(() => {
    ipcMain.handle.mockReset();
    registerSqliteIpc();
    handlers = new Map(ipcMain.handle.mock.calls);
  });

  it('registers one channel per exposed statement', () => {
    expect([...handlers.keys()]).toEqual([
      'datastore:runner_responses:get_runner_response',
      'datastore:runner_responses:delete_runner_responses_for_collection'
    ]);
  });

  describe('get_runner_response', () => {
    const channel = 'datastore:runner_responses:get_runner_response';

    beforeEach(() => {
      readRunnerExchange.mockReset().mockResolvedValue('exchange');
    });

    it('returns the exchange rebuilt from the row and its files', async () => {
      expect(await invoke(channel, { request_uid: 'run-1', extra: 'ignored' })).toBe('exchange');
      expect(readRunnerExchange).toHaveBeenCalledWith('run-1');
    });

    it.each([undefined, {}, { request_uid: '' }, { request_uid: 42 }, { request_uid: { id: 'x' } }])(
      'rejects %p without touching the database',
      (params) => {
        expect(() => invoke(channel, params)).toThrow('request_uid must be a non-empty string');
        expect(readRunnerExchange).not.toHaveBeenCalled();
      }
    );
  });

  describe('delete_runner_responses_for_collection', () => {
    const channel = 'datastore:runner_responses:delete_runner_responses_for_collection';

    beforeEach(() => {
      clearRunnerResponses.mockReset().mockResolvedValue(undefined);
    });

    it('clears the rows and their files by collection uid only', async () => {
      await invoke(channel, { collection_uid: 'col-1', extra: 'ignored' });
      expect(clearRunnerResponses).toHaveBeenCalledWith('col-1');
    });

    it.each([undefined, {}, { collection_uid: '' }, { collection_uid: 42 }])(
      'rejects %p without touching the database',
      (params) => {
        expect(() => invoke(channel, params)).toThrow('collection_uid must be a non-empty string');
        expect(clearRunnerResponses).not.toHaveBeenCalled();
      }
    );
  });
});
