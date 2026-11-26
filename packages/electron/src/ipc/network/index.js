const https = require('https');
const axios = require('axios');
const path = require('path');
const { applyOAuth1ToRequest } = require('@usebruno/requests');
const { buildScriptedEntry } = require('@usebruno/requests').scripting;
const qs = require('qs');
const contentDispositionParser = require('content-disposition');
const mime = require('mime-types');
const { ipcMain } = require('electron');
const { get, extend, cloneDeep, merge } = require('lodash');
const { NtlmClient } = require('axios-ntlm');
const { VarsRuntime, AssertRuntime, ScriptRuntime, TestRuntime, formatErrorWithContextV2, trackUnresolvedVariables, getUnresolvedVariableCollector } = require('@usebruno/js');
const { encodeUrl, hasExplicitScheme, DEFAULT_MAX_REDIRECTS } = require('@usebruno/common').utils;
const { interpolateString } = require('./interpolate-string');
const { resolveAwsV4Credentials, addAwsV4Interceptor } = require('./awsv4auth-helper');
const {
  addDigestInterceptor,
  addEdgeGridInterceptor,
  applySentHeadersToRequest,
  measureResponseTime
} = require('@usebruno/requests');
const prepareGqlIntrospectionRequest = require('./prepare-gql-introspection-request');
const { prepareRequest } = require('./prepare-request');
const interpolateVars = require('./interpolate-vars');
const { applyCollectionVarsToCollectionRoot } = require('./apply-collection-vars');
const { makeAxiosInstance, completeOpenHop } = require('./axios-instance');
const { refreshExplicitHeaderNames } = require('@usebruno/common');
const { resolveInheritedSettings } = require('../../utils/collection');
const { cancelTokens, saveCancelToken, deleteCancelToken } = require('../../utils/cancel-token');
const { uuid, safeStringifyJSON, safeParseJSON, parseDataFromResponse, parseDataFromRequest, isBinaryRequestBody } = require('../../utils/common');
const { chooseFileToSave, writeFile, getCollectionFormat, hasRequestExtension } = require('../../utils/filesystem');
const { addCookieToJar, getDomainsWithCookies, getCookieStringForUrl } = require('../../utils/cookies');
const { createFormData } = require('../../utils/form-data');
const { findItemInCollectionByPathname, getEnvVars, getTreePathFromCollectionToItem, mergeVars } = require('../../utils/collection');
const { getOAuth2TokenUsingAuthorizationCode, getOAuth2TokenUsingClientCredentials, getOAuth2TokenUsingPasswordCredentials, getOAuth2TokenUsingImplicitGrant, clearOauth2CredentialsByCredentialsId } = require('../../utils/oauth2');
const { preferencesUtil } = require('../../store/preferences');
const { getProcessEnvVars } = require('../../store/process-env');
const { getBrunoConfig } = require('../../store/bruno-config');
const Oauth2Store = require('../../store/oauth2');
const { cookiesStore } = require('../../store/cookies');
const registerGrpcEventHandlers = require('./grpc-event-handlers');
const { registerWsEventHandlers } = require('./ws-event-handlers');
const { getCertsAndProxyConfig, buildCertsAndProxyConfig } = require('./cert-utils');
const { easterEggResponse } = require('../../utils/woof');
const { buildFormUrlEncodedPayload, isFormData, getMediaType, extractBoundaryFromContentType } = require('@usebruno/common').utils;

const ERROR_OCCURRED_WHILE_EXECUTING_REQUEST = 'Error occurred while executing the request!';

const saveCookies = (url, headers) => {
  if (preferencesUtil.shouldStoreCookies()) {
    let setCookieHeaders = [];
    if (headers['set-cookie']) {
      setCookieHeaders = Array.isArray(headers['set-cookie'])
        ? headers['set-cookie']
        : [headers['set-cookie']];
      for (let setCookieHeader of setCookieHeaders) {
        if (typeof setCookieHeader === 'string' && setCookieHeader.length) {
          addCookieToJar(setCookieHeader, url);
        }
      }
    }
  }
};

// Duplicated as getJsSandboxRuntime in utils/collection.js; keep the two in sync.
const getJsSandboxRuntime = (collection) => {
  const securityConfig = get(collection, 'securityConfig', {});

  if (securityConfig.jsSandboxMode === 'developer') {
    return 'nodevm';
  }

  // default runtime is `quickjs`
  return 'quickjs';
};

const hasStreamHeaders = (headers) => {
  const headerSplit = (headers.get('content-type') ?? '').split(';').map((d) => d.trim());
  return headerSplit.indexOf('text/event-stream') > -1;
};

const buildResponseBodyFromStreamChunks = (sseChunks, headers, disableParsingResponseJson) => {
  const dataBuffer = Buffer.concat(sseChunks);
  const { data } = parseDataFromResponse({ data: dataBuffer, headers }, disableParsingResponseJson);
  return { data, dataBuffer };
};

const promisifyStream = async (stream, abortController, closeOnFirst) => {
  const chunks = [];

  return new Promise((resolve, reject) => {
    const doResolve = () => {
      const fullBuffer = Buffer.concat(chunks);
      resolve(fullBuffer.buffer.slice(fullBuffer.byteOffset, fullBuffer.byteOffset + fullBuffer.byteLength));
    };

    stream.on('data', (chunk) => {
      chunks.push(chunk);

      if (closeOnFirst) {
        doResolve();

        if (abortController) {
          abortController.abort();
        }
      }
    });

    stream.on('close', doResolve);
    stream.on('error', (err) => reject(err));
  });
};

const configureRequest = async (
  collectionUid,
  collection,
  request,
  envVars,
  runtimeVariables,
  processEnvVars,
  collectionPath,
  globalEnvironmentVariables
) => {
  const hasVariables = request.url.startsWith('{{');
  if (!hasVariables && !hasExplicitScheme(request.url)) {
    request.url = `http://${request.url}`;
  }

  const certsAndProxyConfig = await getCertsAndProxyConfig({
    collectionUid,
    collection,
    request,
    envVars,
    runtimeVariables,
    processEnvVars,
    collectionPath,
    globalEnvironmentVariables
  });

  // Get followRedirects setting, default to true for backward compatibility
  const followRedirects = request.settings?.followRedirects ?? true;

  // Get forwardAuthorizationHeader setting, default to true for backward compatibility
  const forwardAuthorizationHeader = request.settings?.forwardAuthorizationHeader ?? true;

  // Get maxRedirects from request settings, fallback to request.maxRedirects, then default to 5
  let requestMaxRedirects = request.settings?.maxRedirects ?? request.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  // Ensure it's a valid number
  if (typeof requestMaxRedirects !== 'number' || requestMaxRedirects < 0) {
    requestMaxRedirects = DEFAULT_MAX_REDIRECTS;
  }

  // If followRedirects is disabled, set maxRedirects to 0 to disable all redirects
  if (!followRedirects) {
    requestMaxRedirects = 0;
  }

  request.maxRedirects = 0;

  const { promptVariables = {} } = collection;
  let { proxyMode, proxyModeReason, proxyConfig, httpsAgentRequestFields, interpolationOptions } = certsAndProxyConfig;
  const axiosInstance = makeAxiosInstance({
    proxyMode,
    proxyModeReason,
    proxyConfig,
    requestMaxRedirects,
    httpsAgentRequestFields,
    interpolationOptions,
    followRedirects,
    forwardAuthorizationHeader
  });

  if (request.ntlmConfig) {
    const ntlmInstance = NtlmClient(request.ntlmConfig, {});
    axiosInstance.defaults.adapter = (config) => ntlmInstance.request({ ...config, adapter: axios.getAdapter('http') });
    delete request.ntlmConfig;
  }

  if (request.oauth1config) {
    try {
      applyOAuth1ToRequest(request, collectionPath);
    } catch (error) {
      throw new Error(`OAuth1 signing failed: ${error.message}`);
    }
  }

  if (request.oauth2) {
    let requestCopy = cloneDeep(request);
    const { oauth2: { grantType, tokenPlacement, tokenHeaderPrefix, tokenQueryKey, tokenSource, accessTokenUrl, refreshTokenUrl } = {}, collectionVariables, folderVariables, requestVariables } = requestCopy || {};

    // Get cert/proxy configs for token and refresh URLs
    let certsAndProxyConfigForTokenUrl = certsAndProxyConfig;
    let certsAndProxyConfigForRefreshUrl = certsAndProxyConfig;

    if (accessTokenUrl && grantType !== 'implicit') {
      const interpolatedTokenUrl = interpolateString(accessTokenUrl, {
        globalEnvironmentVariables,
        collectionVariables,
        envVars,
        folderVariables,
        requestVariables,
        runtimeVariables,
        processEnvVars,
        promptVariables
      });
      const tokenRequestForConfig = { ...requestCopy, url: interpolatedTokenUrl };
      certsAndProxyConfigForTokenUrl = await getCertsAndProxyConfig({
        collectionUid,
        collection,
        request: tokenRequestForConfig,
        envVars,
        runtimeVariables,
        processEnvVars,
        collectionPath,
        globalEnvironmentVariables
      });
    }

    const tokenUrlForRefresh = refreshTokenUrl || accessTokenUrl;
    if (tokenUrlForRefresh && grantType !== 'implicit') {
      const interpolatedRefreshUrl = interpolateString(tokenUrlForRefresh, {
        globalEnvironmentVariables,
        collectionVariables,
        envVars,
        folderVariables,
        requestVariables,
        runtimeVariables,
        processEnvVars,
        promptVariables
      });
      const refreshRequestForConfig = { ...requestCopy, url: interpolatedRefreshUrl };
      certsAndProxyConfigForRefreshUrl = await getCertsAndProxyConfig({
        collectionUid,
        collection,
        request: refreshRequestForConfig,
        envVars,
        runtimeVariables,
        processEnvVars,
        collectionPath,
        globalEnvironmentVariables
      });
    }

    let credentials, credentialsId, oauth2Url, debugInfo;
    switch (grantType) {
      case 'authorization_code':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars, promptVariables);
        ({ credentials, url: oauth2Url, credentialsId, debugInfo } = await getOAuth2TokenUsingAuthorizationCode({ request: requestCopy, collectionUid, certsAndProxyConfigForTokenUrl, certsAndProxyConfigForRefreshUrl }));
        request.oauth2Credentials = { credentials, url: oauth2Url, collectionUid, credentialsId, debugInfo, folderUid: request.oauth2Credentials?.folderUid };
        {
          const tokenValue = tokenSource === 'id_token' ? credentials?.id_token : credentials?.access_token;
          if (tokenPlacement == 'header' && tokenValue) {
            request.headers['Authorization'] = `${tokenHeaderPrefix} ${tokenValue}`.trim();
          } else if (tokenValue) {
            try {
              const url = new URL(request.url);
              url.searchParams.set(tokenQueryKey, tokenValue);
              request.url = url.toString();
            } catch (error) { }
          }
        }
        break;
      case 'implicit':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars, promptVariables);
        ({ credentials, url: oauth2Url, credentialsId, debugInfo } = await getOAuth2TokenUsingImplicitGrant({ request: requestCopy, collectionUid }));
        request.oauth2Credentials = { credentials, url: oauth2Url, collectionUid, credentialsId, debugInfo, folderUid: request.oauth2Credentials?.folderUid };
        {
          const tokenValue = tokenSource === 'id_token' ? credentials?.id_token : credentials?.access_token;
          if (tokenPlacement == 'header' && tokenValue) {
            request.headers['Authorization'] = `${tokenHeaderPrefix} ${tokenValue}`.trim();
          } else if (tokenValue) {
            try {
              const url = new URL(request.url);
              url.searchParams.set(tokenQueryKey, tokenValue);
              request.url = url.toString();
            } catch (error) { }
          }
        }
        break;
      case 'client_credentials':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars, promptVariables);
        ({ credentials, url: oauth2Url, credentialsId, debugInfo } = await getOAuth2TokenUsingClientCredentials({ request: requestCopy, collectionUid, certsAndProxyConfigForTokenUrl, certsAndProxyConfigForRefreshUrl }));
        request.oauth2Credentials = { credentials, url: oauth2Url, collectionUid, credentialsId, debugInfo, folderUid: request.oauth2Credentials?.folderUid };
        {
          const tokenValue = tokenSource === 'id_token' ? credentials?.id_token : credentials?.access_token;
          if (tokenPlacement == 'header' && tokenValue) {
            request.headers['Authorization'] = `${tokenHeaderPrefix} ${tokenValue}`.trim();
          } else if (tokenValue) {
            try {
              const url = new URL(request.url);
              url.searchParams.set(tokenQueryKey, tokenValue);
              request.url = url.toString();
            } catch (error) { }
          }
        }
        break;
      case 'password':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars, promptVariables);
        ({ credentials, url: oauth2Url, credentialsId, debugInfo } = await getOAuth2TokenUsingPasswordCredentials({ request: requestCopy, collectionUid, certsAndProxyConfigForTokenUrl, certsAndProxyConfigForRefreshUrl }));
        request.oauth2Credentials = { credentials, url: oauth2Url, collectionUid, credentialsId, debugInfo, folderUid: request.oauth2Credentials?.folderUid };
        {
          const tokenValue = tokenSource === 'id_token' ? credentials?.id_token : credentials?.access_token;
          if (tokenPlacement == 'header' && tokenValue) {
            request.headers['Authorization'] = `${tokenHeaderPrefix} ${tokenValue}`.trim();
          } else if (tokenValue) {
            try {
              const url = new URL(request.url);
              url.searchParams.set(tokenQueryKey, tokenValue);
              request.url = url.toString();
            } catch (error) { }
          }
        }
        break;
    }
  }

  if (request.awsv4config) {
    request.awsv4config = await resolveAwsV4Credentials(request);
    addAwsV4Interceptor(axiosInstance, request);
    delete request.awsv4config;
  }

  if (request.digestConfig) {
    addDigestInterceptor(axiosInstance, request);
  }

  if (request.edgeGridConfig) {
    addEdgeGridInterceptor(axiosInstance, request);
    delete request.edgeGridConfig;
  }

  // Get timeout from request settings, fallback to global preference
  const resolvedSettings = resolveInheritedSettings(request.settings || {});
  request.timeout = resolvedSettings.timeout;

  // add cookies to request
  if (preferencesUtil.shouldSendCookies()) {
    const cookieString = getCookieStringForUrl(request.url);
    if (cookieString && typeof cookieString === 'string' && cookieString.length) {
      const existingCookieHeaderName = Object.keys(request.headers).find(
        (name) => name.toLowerCase() === 'cookie'
      );
      const existingCookieString = existingCookieHeaderName ? request.headers[existingCookieHeaderName] : '';

      // Helper function to parse cookies into an object
      const parseCookies = (str) => str.split(';').reduce((cookies, cookie) => {
        const [name, ...rest] = cookie.split('=');
        if (name && name.trim()) {
          cookies[name.trim()] = rest.join('=').trim();
        }
        return cookies;
      }, {});

      const mergedCookies = {
        ...parseCookies(existingCookieString),
        ...parseCookies(cookieString)
      };

      const combinedCookieString = Object.entries(mergedCookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      request.headers[existingCookieHeaderName || 'Cookie'] = combinedCookieString;
    }
  }

  // Add API key to the URL
  if (request.apiKeyAuthValueForQueryParams && request.apiKeyAuthValueForQueryParams.placement === 'queryparams') {
    const urlObj = new URL(request.url);

    // Interpolate key and value as they can be variables before adding to the URL.
    const apiKeyInterpolationOptions = {
      ...interpolationOptions,
      onUnresolved: getUnresolvedVariableCollector(request)
    };
    const key = interpolateString(request.apiKeyAuthValueForQueryParams.key, apiKeyInterpolationOptions);
    const value = interpolateString(request.apiKeyAuthValueForQueryParams.value, apiKeyInterpolationOptions);

    urlObj.searchParams.set(key, value);
    request.url = urlObj.toString();
  }

  return axiosInstance;
};

const fetchGqlSchemaHandler = async (event, endpoint, environment, _request, collection) => {
  try {
    const requestTreePath = getTreePathFromCollectionToItem(collection, _request);
    // Create a clone of the request to avoid mutating the original
    const resolvedRequest = cloneDeep(_request);
    // mergeVars modifies the request in place, but we'll assign it to ensure consistency
    mergeVars(collection, resolvedRequest, requestTreePath);
    const envVars = getEnvVars(environment);

    const globalEnvironmentVars = collection.globalEnvironmentVariables;
    const folderVars = resolvedRequest.folderVariables;
    const requestVariables = resolvedRequest.requestVariables;
    const collectionVariables = resolvedRequest.collectionVariables;
    const runtimeVars = collection.runtimeVariables;

    // Precedence: runtimeVars > requestVariables > folderVars > envVars > collectionVariables > globalEnvironmentVars
    const processEnvVars = getProcessEnvVars(collection.uid);
    const resolvedVars = merge(
      {},
      globalEnvironmentVars,
      collectionVariables,
      envVars,
      folderVars,
      requestVariables,
      runtimeVars,
      {
        process: {
          env: {
            ...processEnvVars
          }
        }
      }
    );

    const collectionRoot = collection?.draft?.root || collection?.root || {};
    const request = prepareGqlIntrospectionRequest(endpoint, resolvedVars, _request, collectionRoot);

    // Get timeout from request settings, resolve inheritance if needed
    const resolvedSettings = resolveInheritedSettings(request.settings || {});
    request.timeout = resolvedSettings.timeout;

    if (!preferencesUtil.shouldVerifyTls()) {
      request.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    const collectionPath = collection.pathname;

    const axiosInstance = await configureRequest(
      collection.uid,
      collection,
      request,
      envVars,
      collection.runtimeVariables,
      processEnvVars,
      collectionPath,
      collection.globalEnvironmentVariables
    );

    const response = await axiosInstance(refreshExplicitHeaderNames(request));

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    };
  } catch (error) {
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data
      };
    }

    return Promise.reject(error);
  }
};

const registerNetworkIpc = (mainWindow) => {
  const onConsoleLog = (type, args) => {
    console[type](...args);
  };

  const notifyScriptExecution = ({
    channel, // 'main:run-request-event'
    basePayload, // request-level identifiers
    scriptType, // 'pre-request' | 'post-response' | 'test'
    error, // optional Error
    collectionPath, // optional path to the application root
    scriptMetadata // optional metadata for line mapping
  }) => {
    const errorContext = error ? formatErrorWithContextV2(error, scriptType, scriptMetadata, collectionPath) : null;

    mainWindow.webContents.send(channel, {
      type: `${scriptType}-script-execution`,
      ...basePayload,
      errorMessage: error ? (error.message || `An error occurred in ${scriptType.replace('-', ' ')} script`) : null,
      errorContext
    });
  };

  const appendScriptErrorResult = (scriptType, scriptResult, error) => {
    if (!error) {
      return scriptResult;
    }

    const descriptionMap = {
      'test': 'Test Script Error',
      'post-response': 'Post-Response Script Error',
      'pre-request': 'Pre-Request Script Error'
    };

    const messageMap = {
      'test': 'An error occurred while executing the test script.',
      'post-response': 'An error occurred while executing the post-response script.',
      'pre-request': 'An error occurred while executing the pre-request script.'
    };

    const results = [
      ...(scriptResult?.results || []),
      {
        status: 'fail',
        description: descriptionMap[scriptType] || 'Script Error',
        error: error.message || messageMap[scriptType] || 'An error occurred while executing the script.',
        isScriptError: true
      }
    ];

    return {
      ...(scriptResult || {}),
      results
    };
  };

  const sendVariableUpdates = (result, { collectionUid, requestUid, collection }) => {
    if (result.runtimeVariables) {
      mainWindow.webContents.send('main:runtime-variables-update', {
        runtimeVariables: result.runtimeVariables,
        requestUid,
        collectionUid
      });
    }

    if (result.envVariables) {
      mainWindow.webContents.send('main:script-environment-update', {
        envVariables: result.envVariables,
        requestUid,
        collectionUid
      });
    }

    if (result.globalEnvironmentVariables) {
      mainWindow.webContents.send('main:global-environment-variables-update', {
        globalEnvironmentVariables: result.globalEnvironmentVariables,
        requestUid,
        collectionUid
      });
      collection.globalEnvironmentVariables = result.globalEnvironmentVariables;
    }

    if (result.collectionVariables) {
      mainWindow.webContents.send('main:collection-variables-update', {
        collectionVariables: result.collectionVariables,
        requestUid,
        collectionUid
      });
      applyCollectionVarsToCollectionRoot(collection, result.collectionVariables);
    }
  };

  const resetOauth2Credentials = ({ oauth2CredentialsToReset, request, collectionUid }) => {
    if (!oauth2CredentialsToReset?.length) return;
    for (const credentialId of oauth2CredentialsToReset) {
      clearOauth2CredentialsByCredentialsId({ collectionUid, credentialsId: credentialId });
      if (request?.oauth2Credentials?.credentialsId === credentialId) {
        request.oauth2Credentials = null;
      }
      const prefix = `$oauth2.${credentialId}.`;
      if (request.oauth2CredentialVariables) {
        for (const key of Object.keys(request.oauth2CredentialVariables)) {
          if (key.startsWith(prefix)) {
            delete request.oauth2CredentialVariables[key];
          }
        }
      }
      mainWindow.webContents.send('main:credentials-clear', { collectionUid, credentialsId: credentialId });
    }
  };

  const runPreRequest = async (
    request,
    requestUid,
    envVars,
    collectionPath,
    collection,
    collectionUid,
    runtimeVariables,
    processEnvVars,
    scriptingConfig,
    runRequestByItemPathname
  ) => {
    // run pre-request script
    let scriptResult;
    const { promptVariables = {}, name: collectionName } = collection;

    const requestScript = get(request, 'script.req');
    if (requestScript?.length) {
      const scriptRuntime = new ScriptRuntime({ runtime: scriptingConfig?.runtime });
      scriptResult = await scriptRuntime.runRequestScript(
        requestScript,
        request,
        envVars,
        runtimeVariables,
        collectionPath,
        onConsoleLog,
        processEnvVars,
        scriptingConfig,
        runRequestByItemPathname,
        collectionName
      );

      sendVariableUpdates(scriptResult, { collectionUid, requestUid, collection });
      resetOauth2Credentials({ oauth2CredentialsToReset: scriptResult.oauth2CredentialsToReset, request, collectionUid });

      const domainsWithCookies = await getDomainsWithCookies();
      mainWindow.webContents.send('main:cookies-update', safeParseJSON(safeStringifyJSON(domainsWithCookies)));
    }

    // interpolate variables inside request
    interpolateVars(request, envVars, runtimeVariables, processEnvVars, promptVariables);

    if (!hasExplicitScheme(request.url)) {
      // The scheme must be present before encoding. Without a `://`, encodeUrl
      // treats a `host:port` authority as a path segment and percent-encodes the
      // port colon (localhost:6000 → localhost%3A6000), which then resolves to a
      // bogus host once configureRequest prepends http://.
      request.url = `http://${request.url}`;
    }

    if (request.settings?.encodeUrl) {
      request.url = encodeUrl(request.url);
    }

    // if this is a graphql request, parse the variables, only after interpolation
    // https://github.com/usebruno/bruno/issues/884
    if (request.mode === 'graphql' && typeof request.data?.variables === 'string') {
      try {
        request.data.variables = JSON.parse(request.data.variables);
      } catch (err) {
        throw new Error(`Failed to parse GraphQL variables: ${err.message}`);
      }
    }

    // stringify the request url encoded params
    const contentTypeHeader = Object.keys(request.headers).find((name) => name.toLowerCase() === 'content-type');

    const contentType = contentTypeHeader ? request.headers[contentTypeHeader] : '';
    const mediaType = getMediaType(contentType);

    if (mediaType === 'application/x-www-form-urlencoded') {
      if (Array.isArray(request.data)) {
        request.data = buildFormUrlEncodedPayload(request.data);
      } else if (typeof request.data !== 'string' && !isBinaryRequestBody(request.data)) {
        request.data = qs.stringify(request.data, { arrayFormat: 'repeat' });
      }
      // string and file (Buffer/stream) bodies are sent as-is (assumed already encoded)
    }

    if (mediaType.startsWith('multipart/')) {
      if (typeof request.data !== 'string' && !isFormData(request.data) && !isBinaryRequestBody(request.data)) {
        request._originalMultipartData = request.data;
        request.collectionPath = collectionPath;
        const existingBoundary = extractBoundaryFromContentType(contentType);
        let form = createFormData(request.data, collectionPath, existingBoundary);
        request.data = form;
        if (contentType !== 'multipart/form-data') {
          // Patch: Axios leverages getHeaders method to get the headers so FormData should be monkey patched
          const formHeaders = form.getHeaders();
          if (existingBoundary) {
            formHeaders['content-type'] = contentType;
          } else {
            formHeaders['content-type'] = `${contentType}; boundary=${form.getBoundary()}`;
          }
          form.getHeaders = function () {
            return formHeaders;
          };
        }

        extend(request.headers, form.getHeaders());
      }
    }
    return scriptResult;
  };

  const runPostResponse = async (
    request,
    response,
    requestUid,
    envVars,
    collectionPath,
    collection,
    collectionUid,
    runtimeVariables,
    processEnvVars,
    scriptingConfig,
    runRequestByItemPathname
  ) => {
    applySentHeadersToRequest(request, response);
    // run post-response vars
    const postResponseVars = get(request, 'vars.res', []);
    if (postResponseVars?.length) {
      const varsRuntime = new VarsRuntime({ runtime: scriptingConfig?.runtime });
      const result = varsRuntime.runPostResponseVars(
        postResponseVars,
        request,
        response,
        envVars,
        runtimeVariables,
        collectionPath,
        processEnvVars
      );

      if (result) {
        sendVariableUpdates(result, { collectionUid, requestUid, collection });
      }

      if (result?.error) {
        mainWindow.webContents.send('main:display-error', result.error);
      }
    }

    // run post-response script
    const responseScript = get(request, 'script.res');
    let scriptResult;
    const collectionName = collection?.name;
    if (responseScript?.length) {
      const scriptRuntime = new ScriptRuntime({ runtime: scriptingConfig?.runtime });
      scriptResult = await scriptRuntime.runResponseScript(
        responseScript,
        request,
        response,
        envVars,
        runtimeVariables,
        collectionPath,
        onConsoleLog,
        processEnvVars,
        scriptingConfig,
        runRequestByItemPathname,
        collectionName
      );

      sendVariableUpdates(scriptResult, { collectionUid, requestUid, collection });
      resetOauth2Credentials({ oauth2CredentialsToReset: scriptResult.oauth2CredentialsToReset, request, collectionUid });

      const domainsWithCookiesPost = await getDomainsWithCookies();
      mainWindow.webContents.send('main:cookies-update', safeParseJSON(safeStringifyJSON(domainsWithCookiesPost)));
    }
    return scriptResult;
  };

  const runRequest = async ({ item, collection, envVars, processEnvVars, runtimeVariables, runInBackground = false, callerBru = null, parentRequestUid = null, parentUnresolvedVariables = null }) => {
    const collectionUid = collection.uid;
    const collectionPath = collection.pathname;
    const cancelTokenUid = uuid();
    // Nested bru.runRequest() invocations have no item.requestUid; inherit the parent's
    // so script-driven variable updates aren't dropped by the renderer's requestUid gate.
    const requestUid = item.requestUid || parentRequestUid || uuid();
    let unresolvedVariables = null;

    const runRequestByItemPathname = async (relativeItemPathname, callerBru) => {
      return new Promise(async (resolve, reject) => {
        const format = getCollectionFormat(collection.pathname);
        let itemPathname = path.join(collection.pathname, relativeItemPathname);
        if (itemPathname && !hasRequestExtension(itemPathname, format)) {
          itemPathname = `${itemPathname}.${format}`;
        }
        const _item = cloneDeep(findItemInCollectionByPathname(collection, itemPathname));
        if (_item) {
          // WS/gRPC items live on separate IPC channels and can't be driven via
          // the HTTP runRequest. Record a Skipped row so the user sees feedback.
          if (_item.type === 'ws-request' || _item.type === 'grpc-request') {
            const protocolLabel = _item.type === 'ws-request' ? 'WebSocket' : 'gRPC';
            const startedAt = Date.now();
            callerBru?._recordScriptedRequest?.({
              source: 'runRequest',
              request: {
                method: (_item.request?.method || 'GET').toString().toUpperCase(),
                url: _item.request?.url,
                headers: {},
                data: null
              },
              response: {
                statusCode: null,
                statusText: 'Skipped',
                headers: {},
                data: null,
                dataBuffer: '',
                size: 0,
                duration: 0
              },
              error: null,
              startedAt,
              completedAt: startedAt
            });
            resolve({
              status: 'skipped',
              statusText: `bru.runRequest does not support ${protocolLabel} requests`,
              headers: {},
              data: null,
              duration: 0,
              size: 0
            });
            return;
          }

          const startedAt = Date.now();
          let res, err;
          try {
            res = await runRequest({ item: _item, collection, envVars, processEnvVars, runtimeVariables, runInBackground: true, callerBru, parentRequestUid: requestUid, parentUnresolvedVariables: unresolvedVariables });
          } catch (e) {
            err = e;
          }
          const completedAt = Date.now();
          const sent = res?.requestSent || {};
          // Cancel/network-error early-returns don't include requestSent; fall back
          const fallbackRequest = _item.request || {};
          callerBru?._recordScriptedRequest?.({
            source: 'runRequest',
            ...buildScriptedEntry({
              request: {
                method: sent.method || fallbackRequest.method,
                url: sent.url || res?.url || fallbackRequest.url,
                headers: sent.headers,
                data: sent.data
              },
              response: res
                ? {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                    data: res.data,
                    dataBuffer: res.dataBuffer,
                    size: res.size,
                    duration: res.duration,
                    timeline: res.timeline
                  }
                : null,
              error: err || (res?.error ? { message: res.error } : null),
              startedAt,
              completedAt
            })
          });
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
          return;
        }
        reject(`bru.runRequest: invalid request path - ${itemPathname}`);
      });
    };

    const emitScriptedRequestEvents = (phase, scriptResult) => {
      const entries = scriptResult?.scriptedRequestEntries || [];
      if (runInBackground) {
        if (callerBru) {
          entries.forEach((entry) => callerBru._recordScriptedRequest?.(entry));
        }
        return;
      }
      entries.forEach((entry) => {
        mainWindow.webContents.send('main:run-request-event', {
          type: 'scripted-request',
          collectionUid,
          itemUid: item.uid,
          requestUid,
          phase,
          source: entry.source,
          scope: entry.scope || null,
          timestamp: entry.startedAt,
          data: { request: entry.request, response: entry.response, error: entry.error }
        });
      });
    };

    !runInBackground && mainWindow.webContents.send('main:run-request-event', {
      type: 'request-queued',
      requestUid,
      collectionUid,
      itemUid: item.uid,
      cancelTokenUid
    });

    const abortController = new AbortController();
    const request = await prepareRequest(item, collection, abortController);
    if (!runInBackground || parentUnresolvedVariables) {
      unresolvedVariables = trackUnresolvedVariables(request, parentUnresolvedVariables);
    }

    let reportedUnresolvedCount = 0;
    const reportUnresolvedVariables = () => {
      if (runInBackground || unresolvedVariables.size === reportedUnresolvedCount) return;

      reportedUnresolvedCount = unresolvedVariables.size;
      mainWindow.webContents.send('main:run-request-event', {
        type: 'unresolved-variables',
        unresolvedVariables: [...unresolvedVariables],
        itemUid: item.uid,
        requestUid,
        collectionUid
      });
    };

    // Every good boy deserves a response.
    if (request.method && request.method.toUpperCase() === 'WOOF') {
      return easterEggResponse(request);
    }

    request.__bruno__executionMode = 'standalone';
    request.responseType = 'stream';
    // flag to see if the stream needs to be handled as an actual stream or
    // is it just a data stream from axios
    let isResponseStream = false;
    let requestSent;
    const brunoConfig = getBrunoConfig(collectionUid, collection);
    const scriptingConfig = get(brunoConfig, 'scripts', {});
    scriptingConfig.runtime = getJsSandboxRuntime(collection);
    scriptingConfig.cacheModules = false;

    try {
      request.signal = abortController.signal;
      saveCancelToken(cancelTokenUid, abortController);

      // Build certsAndProxyConfig for bru.sendRequest
      const certsAndProxyConfig = await buildCertsAndProxyConfig({
        collectionUid,
        collection,
        collectionPath,
        envVars,
        runtimeVariables,
        processEnvVars,
        request
      });

      // Add certsAndProxyConfig to request object for bru.sendRequest
      request.certsAndProxyConfig = certsAndProxyConfig;
      let preRequestScriptResult = null;
      let preRequestError = null;
      try {
        preRequestScriptResult = await runPreRequest(
          request,
          requestUid,
          envVars,
          collectionPath,
          collection,
          collectionUid,
          runtimeVariables,
          processEnvVars,
          scriptingConfig,
          runRequestByItemPathname
        );
      } catch (error) {
        preRequestError = error;
      }

      if (preRequestError?.partialResults) {
        preRequestScriptResult = preRequestError.partialResults;
        // Forward any variable mutations the script made before throwing so the UI
        // and disk stay in sync with the partial test results we're about to render.
        sendVariableUpdates(preRequestScriptResult, { collectionUid, requestUid, collection });
      }

      emitScriptedRequestEvents('pre-request', preRequestScriptResult);

      preRequestScriptResult = appendScriptErrorResult('pre-request', preRequestScriptResult, preRequestError);

      if (preRequestScriptResult?.results) {
        mainWindow.webContents.send('main:run-request-event', {
          type: 'test-results-pre-request',
          results: preRequestScriptResult.results,
          itemUid: item.uid,
          requestUid,
          collectionUid
        });
      }

      !runInBackground && notifyScriptExecution({
        channel: 'main:run-request-event',
        basePayload: { requestUid, collectionUid, itemUid: item.uid },
        scriptType: 'pre-request',
        error: preRequestError,
        collectionPath,
        scriptMetadata: request.script?.reqMetadata
      });

      if (preRequestError) {
        return Promise.reject(preRequestError);
      }

      const axiosInstance = await configureRequest(
        collectionUid,
        collection,
        request,
        envVars,
        runtimeVariables,
        processEnvVars,
        collectionPath,
        collection.globalEnvironmentVariables
      );

      const { data: requestData, dataBuffer: requestDataBuffer } = parseDataFromRequest(request);

      // Remove false Content-Type header (used to stop axios from auto-setting it); no Content-Type was actually set or sent.
      const headersSent = { ...request.headers };
      Object.keys(headersSent).forEach((key) => {
        if (key.toLowerCase() === 'content-type' && headersSent[key] === false) {
          delete headersSent[key];
        }
      });

      requestSent = {
        url: request.url,
        method: request.method,
        headers: headersSent,
        data: requestData,
        dataBuffer: requestDataBuffer,
        timestamp: Date.now()
      };

      !runInBackground && mainWindow.webContents.send('main:run-request-event', {
        type: 'request-sent',
        requestSent,
        collectionUid,
        itemUid: item.uid,
        requestUid,
        cancelTokenUid
      });

      if (request.oauth2Credentials?.credentials && request.oauth2Credentials?.credentialsId) {
        mainWindow.webContents.send('main:credentials-update', {
          credentials: request?.oauth2Credentials?.credentials,
          url: request?.oauth2Credentials?.url,
          collectionUid,
          credentialsId: request?.oauth2Credentials?.credentialsId,
          ...(request?.oauth2Credentials?.folderUid ? { folderUid: request.oauth2Credentials.folderUid } : { itemUid: item.uid }),
          debugInfo: request?.oauth2Credentials?.debugInfo
        });

        const { credentialsId, credentials } = request.oauth2Credentials;
        request.oauth2CredentialVariables = request.oauth2CredentialVariables || {};
        Object.entries(credentials).forEach(([key, value]) => {
          request.oauth2CredentialVariables[`$oauth2.${credentialsId}.${key}`] = value;
        });
      }

      let response, responseTime, axiosDataStream;
      const sseChunks = [];
      reportUnresolvedVariables();
      try {
        /** @type {import('axios').AxiosResponse} */
        response = await axiosInstance(refreshExplicitHeaderNames(request));
        isResponseStream = hasStreamHeaders(response.headers);

        if (!isResponseStream) {
          response.data = await promisifyStream(response.data);
          completeOpenHop(response.config);
        }
        responseTime = measureResponseTime(response.config.metadata);
      } catch (error) {
        deleteCancelToken(cancelTokenUid);

        // if it's a cancel request, don't continue
        if (axios.isCancel(error)) {
          // we are not rejecting the promise here and instead returning a response object with `error` which is handled in the `send-http-request` invocation
          // timeline prop won't be accessible in the usual way in the renderer process if we reject the promise
          return {
            statusText: 'REQUEST_CANCELLED',
            isCancel: true,
            error: 'REQUEST_CANCELLED',
            timeline: error.timeline
          };
        }
        if (error?.response) {
          response = error.response;
          isResponseStream = hasStreamHeaders(response.headers);
          if (!isResponseStream) {
            response.data = await promisifyStream(response.data);
            completeOpenHop(response.config);
          }
          responseTime = measureResponseTime(response.config.metadata);
        } else {
          await executeRequestOnFailHandler(request, error, (onFailScriptResult) => {
            sendVariableUpdates(onFailScriptResult, { collectionUid, requestUid, collection });
          });

          // if it's not a network error, don't continue
          // we are not rejecting the promise here and instead returning a response object with `error` which is handled in the `send-http-request` invocation
          // timeline prop won't be accessible in the usual way in the renderer process if we reject the promise
          return {
            statusText: error.statusText,
            error: error.message || ERROR_OCCURRED_WHILE_EXECUTING_REQUEST,
            timeline: error.timeline
          };
        }
      }

      // Continue with the rest of the request lifecycle - post response vars, script, assertions, tests
      if (isResponseStream) {
        axiosDataStream = response.data;
      }

      const { data, dataBuffer } = isResponseStream
        ? { data: '', dataBuffer: Buffer.alloc(0) }
        : parseDataFromResponse(response, request.__brunoDisableParsingResponseJson);
      response.data = data;
      response.dataBuffer = dataBuffer;

      response.responseTime = responseTime;

      // save cookies
      if (preferencesUtil.shouldStoreCookies()) {
        saveCookies(request.url, response.headers);
      }

      // send domain cookies to renderer
      const domainsWithCookies = await getDomainsWithCookies();

      mainWindow.webContents.send('main:cookies-update', safeParseJSON(safeStringifyJSON(domainsWithCookies)));
      cookiesStore.saveCookieJar();

      const runPostScripts = async () => {
        let postResponseScriptResult = null;
        let postResponseError = null;
        try {
          postResponseScriptResult = await runPostResponse(request,
            response,
            requestUid,
            envVars,
            collectionPath,
            collection,
            collectionUid,
            runtimeVariables,
            processEnvVars,
            scriptingConfig,
            runRequestByItemPathname);
        } catch (error) {
          console.error('Post-response script error:', error);
          postResponseError = error;
        }

        // Extract partial results from error if available
        // This preserves any test() calls that passed before the script errored
        // (e.g., if 2 tests pass then script throws, we still want to show those 2 passing tests)
        if (postResponseError?.partialResults) {
          postResponseScriptResult = postResponseError.partialResults;
          // Forward any variable mutations the script made before throwing.
          sendVariableUpdates(postResponseScriptResult, { collectionUid, requestUid, collection });
        }

        emitScriptedRequestEvents('post-response', postResponseScriptResult);

        postResponseScriptResult = appendScriptErrorResult('post-response', postResponseScriptResult, postResponseError);

        if (postResponseScriptResult?.results) {
          mainWindow.webContents.send('main:run-request-event', {
            type: 'test-results-post-response',
            results: postResponseScriptResult.results,
            itemUid: item.uid,
            requestUid,
            collectionUid
          });
        }

        !runInBackground && notifyScriptExecution({
          channel: 'main:run-request-event',
          basePayload: { requestUid, collectionUid, itemUid: item.uid },
          scriptType: 'post-response',
          error: postResponseError,
          itemPathname: item.pathname,
          collectionPath,
          scriptMetadata: request.script?.resMetadata
        });

        // run assertions
        const assertions = get(request, 'assertions');
        if (assertions) {
          const assertRuntime = new AssertRuntime({ runtime: scriptingConfig?.runtime });
          const results = assertRuntime.runAssertions(assertions,
            request,
            response,
            envVars,
            runtimeVariables,
            processEnvVars);

          !runInBackground && mainWindow.webContents.send('main:run-request-event', {
            type: 'assertion-results',
            results: results,
            itemUid: item.uid,
            requestUid,
            collectionUid
          });
        }

        const testFile = get(request, 'tests');
        const collectionName = collection?.name;
        if (typeof testFile === 'string') {
          const testRuntime = new TestRuntime({ runtime: scriptingConfig?.runtime });
          let testResults = null;
          let testError = null;

          try {
            testResults = await testRuntime.runTests(testFile,
              request,
              response,
              envVars,
              runtimeVariables,
              collectionPath,
              onConsoleLog,
              processEnvVars,
              scriptingConfig,
              runRequestByItemPathname,
              collectionName);
          } catch (error) {
            testError = error;

            if (error.partialResults) {
              testResults = error.partialResults;
            } else {
              testResults = {
                request,
                envVariables: envVars,
                runtimeVariables,
                globalEnvironmentVariables: request?.globalEnvironmentVariables || {},
                results: [],
                nextRequestName: null
              };
            }
          }

          emitScriptedRequestEvents('tests', testResults);

          testResults = appendScriptErrorResult('test', testResults, testError);

          !runInBackground && mainWindow.webContents.send('main:run-request-event', {
            type: 'test-results',
            results: testResults.results,
            itemUid: item.uid,
            requestUid,
            collectionUid
          });

          sendVariableUpdates(testResults, { collectionUid, requestUid, collection });
          resetOauth2Credentials({ oauth2CredentialsToReset: testResults.oauth2CredentialsToReset, request, collectionUid });

          !runInBackground && notifyScriptExecution({
            channel: 'main:run-request-event',
            basePayload: { requestUid, collectionUid, itemUid: item.uid },
            scriptType: 'test',
            error: testError,
            itemPathname: item.pathname,
            collectionPath,
            scriptMetadata: request.testsMetadata
          });

          const domainsWithCookiesTest = await getDomainsWithCookies();
          mainWindow.webContents.send('main:cookies-update', safeParseJSON(safeStringifyJSON(domainsWithCookiesTest)));
          cookiesStore.saveCookieJar();
        }
      };
      if (isResponseStream) {
        axiosDataStream.on('close', () => {
          completeOpenHop(response.config);
          response.responseTime = measureResponseTime(response.config.metadata);
          try {
            const { data, dataBuffer } = buildResponseBodyFromStreamChunks(
              sseChunks,
              response.headers,
              request.__brunoDisableParsingResponseJson
            );
            response.data = data;
            response.dataBuffer = dataBuffer;
          } catch (error) {
            console.error('Error rebuilding response body from SSE chunks:', error);
          }
          runPostScripts()
            .finally(reportUnresolvedVariables)
            .catch((error) => {
              console.error('Error running post-response scripts for SSE stream:', error);
            });
        });
      } else {
        await runPostScripts();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        stream: isResponseStream ? axiosDataStream : null,
        sseChunks: isResponseStream ? sseChunks : null,
        cancelTokenUid: cancelTokenUid,
        dataBuffer: response.dataBuffer.toString('base64'),
        size: Buffer.byteLength(response.dataBuffer),
        duration: responseTime ?? 0,
        url: response.request ? response.request.protocol + '//' + response.request.host + response.request.path : null,
        timeline: response.timeline,
        requestSent
      };
    } catch (error) {
      deleteCancelToken(cancelTokenUid);

      // we are not rejecting the promise here and instead returning a response object with `error` which is handled in the `send-http-request` invocation
      // timeline prop won't be accessible in the usual way in the renderer process if we reject the promise
      return {
        status: error?.status,
        error: error?.message || ERROR_OCCURRED_WHILE_EXECUTING_REQUEST,
        timeline: error?.timeline,
        requestSent
      };
    } finally {
      reportUnresolvedVariables();
    }
  };

  // handler for sending http request
  ipcMain.handle('send-http-request', async (event, item, collection, environment, runtimeVariables) => {
    let seq = 0;
    const collectionUid = collection.uid;
    const envVars = getEnvVars(environment);
    const processEnvVars = getProcessEnvVars(collectionUid);
    const response = await runRequest({ item, collection, envVars, processEnvVars, runtimeVariables, runInBackground: false });
    if (response.stream) {
      const stream = response.stream;
      response.stream = { running: response.status >= 200 && response.status < 300 };

      stream.on('data', (newData) => {
        // Collect the raw chunk so runRequest can rebuild the full body on stream close.
        response.sseChunks?.push(newData);
        seq += 1;

        const parsed = parseDataFromResponse({ data: newData, headers: {} });

        mainWindow.webContents.send('main:http-stream-new-data', {
          collectionUid,
          itemUid: item.uid,
          seq,
          timestamp: Date.now(),
          data: parsed
        });
      });

      stream.on('close', () => {
        if (!cancelTokens[response.cancelTokenUid]) return;

        mainWindow.webContents.send('main:http-stream-end', {
          collectionUid,
          itemUid: item.uid,
          seq: seq + 1,
          timestamp: Date.now()
        });

        deleteCancelToken(response.cancelTokenUid);
      });
    }
    return response;
  });

  ipcMain.handle('clear-oauth2-cache', async (event, uid, url, credentialsId) => {
    return new Promise((resolve, reject) => {
      try {
        const oauth2Store = new Oauth2Store();
        oauth2Store.clearSessionIdOfCollection({ collectionUid: uid, url, credentialsId });
        resolve();
      } catch (err) {
        reject(new Error('Could not clear oauth2 cache'));
      }
    });
  });

  ipcMain.handle('cancel-http-request', async (event, cancelTokenUid) => {
    return new Promise((resolve, reject) => {
      if (cancelTokenUid && cancelTokens[cancelTokenUid]) {
        const abortController = cancelTokens[cancelTokenUid];
        deleteCancelToken(cancelTokenUid);
        abortController.abort();
        resolve();
      } else {
        reject(new Error('cancel token not found'));
      }
    });
  });

  // handler for fetch-gql-schema
  ipcMain.handle('fetch-gql-schema', fetchGqlSchemaHandler);

  // save response to file
  ipcMain.handle('renderer:save-response-to-file', async (event, response, url, pathname) => {
    try {
      const getHeaderValue = (headerName) => {
        const headersArray = typeof response.headers === 'object' ? Object.entries(response.headers) : [];

        if (headersArray.length > 0) {
          const header = headersArray.find((header) => header[0] === headerName);
          if (header && header.length > 1) {
            return header[1];
          }
        }
      };

      const getFileNameFromContentDispositionHeader = () => {
        const contentDisposition = getHeaderValue('content-disposition');
        try {
          const disposition = contentDispositionParser.parse(contentDisposition);
          return disposition && disposition.parameters['filename'];
        } catch (error) { }
      };

      const getFileNameFromUrlPath = () => {
        const lastPathLevel = new URL(url).pathname.split('/').pop();
        if (lastPathLevel && /\..+/.exec(lastPathLevel)) {
          return lastPathLevel;
        }
      };

      const getFileNameBasedOnContentTypeHeader = () => {
        const contentType = getHeaderValue('content-type');
        const extension = (contentType && mime.extension(contentType)) || 'txt';
        return `response.${extension}`;
      };

      const getEncodingFormat = () => {
        const contentType = getHeaderValue('content-type');
        const extension = mime.extension(contentType) || 'txt';
        return ['json', 'xml', 'html', 'yml', 'yaml', 'txt'].includes(extension) ? 'utf-8' : 'base64';
      };

      const determineFileName = () => {
        return (
          getFileNameFromContentDispositionHeader() || getFileNameFromUrlPath() || getFileNameBasedOnContentTypeHeader()
        );
      };

      const dirPath = path.dirname(pathname);
      const fileName = determineFileName();
      const filePath = await chooseFileToSave(mainWindow, path.join(dirPath, fileName));
      if (filePath) {
        const encoding = getEncodingFormat();
        const data = Buffer.from(response.dataBuffer, 'base64');
        if (encoding === 'utf-8') {
          await writeFile(filePath, data);
        } else {
          await writeFile(filePath, data, true);
        }
        return { success: true, filePath };
      }
      return { success: false, cancelled: true };
    } catch (error) {
      return Promise.reject(error);
    }
  });
};

/**
 * Executes the custom error handler if it exists on the request
 * @param {Object} request - The request object that may contain an onFailHandler
 * @param {Error} error - The error that occurred
 * @param {Function} onResult - Callback for handling the script result
 */
const executeRequestOnFailHandler = async (request, error, onResult) => {
  if (!request || typeof request.onFailHandler !== 'function') {
    return;
  }

  try {
    const result = await request.onFailHandler(error);
    if (result && typeof onResult === 'function') {
      onResult(result);
    }
    return result;
  } catch (handlerError) {
    console.error('Error executing onFail handler', handlerError);
    // @TODO: This is a temporary solution to display the error message in the response pane. Revisit and handle properly.
    error.message = `1. Request failed: ${error.message || ERROR_OCCURRED_WHILE_EXECUTING_REQUEST}\n2. Error executing onFail handler: ${handlerError.message || 'Unknown error'}`;
  }
};

const registerAllNetworkIpc = (mainWindow) => {
  registerNetworkIpc(mainWindow);
  registerGrpcEventHandlers(mainWindow);
  registerWsEventHandlers(mainWindow);
};

module.exports = registerAllNetworkIpc;
module.exports.configureRequest = configureRequest;
module.exports.getCertsAndProxyConfig = getCertsAndProxyConfig;
module.exports.fetchGqlSchemaHandler = fetchGqlSchemaHandler;
module.exports.executeRequestOnFailHandler = executeRequestOnFailHandler;
module.exports.buildResponseBodyFromStreamChunks = buildResponseBodyFromStreamChunks;
module.exports.promisifyStream = promisifyStream;
module.exports.hasStreamHeaders = hasStreamHeaders;
