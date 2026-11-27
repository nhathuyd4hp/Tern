import { BrunoError } from 'utils/common/error';
import { openApiToBruno } from '@tern/converters';

export const convertOpenapiToBruno = (data, options = {}) => {
  try {
    return openApiToBruno(data, options);
  } catch (err) {
    console.error('Error converting OpenAPI to Tern:', err);
    throw new BrunoError('Import application failed: ' + err.message);
  }
};

export const isOpenApiSpec = (data) => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (typeof data.info !== 'object' || data.info === null) {
    return false;
  }

  if (typeof data.openapi === 'string' && data.openapi.trim().length) {
    return true;
  }

  if (typeof data.swagger === 'string' && data.swagger.trim().length) {
    return true;
  }

  return false;
};

export const isSwagger2Spec = (spec) => Boolean(spec?.swagger) && String(spec.swagger).startsWith('2');

export const buildOpenApiSyncBrunoConfig = (collection, { sourceUrl, groupBy, authPlacement, requestNameSource }) => ({
  version: collection.version || '1',
  name: collection.name || 'Untitled Application',
  type: 'collection',
  ignore: ['node_modules', '.git'],
  ...collection.brunoConfig,
  openapi: [{ sourceUrl, groupBy, authPlacement, requestNameSource, autoCheck: true, autoCheckInterval: 5 }]
});
