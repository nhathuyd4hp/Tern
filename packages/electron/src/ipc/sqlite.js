const { ipcMain } = require('electron');
const { readRunnerExchange, clearRunnerResponses } = require('../services/runner-exchange');

const requireUid = (value, name) => {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
};

const registerSqliteIpc = () => {
  ipcMain.handle('datastore:runner_responses:get_runner_response', (_event, params) => {
    const request_uid = requireUid(params?.request_uid, 'request_uid');
    return readRunnerExchange(request_uid);
  });

  ipcMain.handle('datastore:runner_responses:delete_runner_responses_for_collection', (_event, params) => {
    const collection_uid = requireUid(params?.collection_uid, 'collection_uid');
    return clearRunnerResponses(collection_uid);
  });
};

module.exports = { registerSqliteIpc };
