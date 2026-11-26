import { isPlainObject } from 'lodash';
import { isHttpUrl } from 'utils/url/index';
import { isOpenApiSpec } from 'utils/importers/openapi-collection';

const INVALID_SPEC_ERROR = 'The selected spec is not a valid OpenAPI 3.x specification';

// Also applies the 3.x version and paths rules of isValidOpenApiSpec in electron/src/ipc/openapi-sync.js.
export const getOpenApiSpecError = (spec) => {
  if (!isOpenApiSpec(spec)) {
    return INVALID_SPEC_ERROR;
  }
  if (spec.swagger) {
    return 'Swagger 2.0 is not supported. Please convert your spec to OpenAPI 3.x.';
  }
  return spec.openapi.startsWith('3.') && isPlainObject(spec.paths) ? null : INVALID_SPEC_ERROR;
};

export const isSpecSourceReady = (mode, value) => {
  const source = (value || '').trim();
  if (mode === 'url') {
    return isHttpUrl(source);
  }
  return Boolean(source);
};
