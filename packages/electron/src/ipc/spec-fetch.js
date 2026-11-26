const { ipcMain } = require('electron');
const { getCertsAndProxyConfig } = require('./network/cert-utils');
const { makeAxiosInstance } = require('./network/axios-instance');
const { proxySwaggerFetch } = require('./swagger-fetch');

const registerSpecFetchIpc = () => {
  // Used by the importer to download a remote OpenAPI/Swagger spec.
  ipcMain.handle('renderer:fetch-api-spec', async (event, url) => {
    try {
      // Use a proxy-aware axios instance so that the user's configured proxy applies
      const { proxyMode, proxyConfig, httpsAgentRequestFields, interpolationOptions }
        = await getCertsAndProxyConfig({
          collectionUid: null,
          collection: { promptVariables: {} },
          request: {},
          envVars: {},
          runtimeVariables: {},
          processEnvVars: {},
          collectionPath: '',
          globalEnvironmentVariables: {}
        });

      const axiosInstance = makeAxiosInstance({ proxyMode, proxyConfig, httpsAgentRequestFields, interpolationOptions });
      const response = await axiosInstance.get(url, {
        timeout: 30000,
        transformResponse: [(data) => data]
      });
      return response.data;
    } catch (error) {
      return Promise.reject(error);
    }
  });

  // Try-it-out requests from the embedded Swagger UI
  ipcMain.handle('renderer:swagger-fetch', async (event, req) => {
    return proxySwaggerFetch(req);
  });
};

module.exports = registerSpecFetchIpc;
