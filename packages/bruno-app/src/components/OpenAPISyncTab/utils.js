const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

/**
 * Count the number of HTTP endpoints in an OpenAPI spec.
 * Returns null if the spec has no paths (e.g. spec is null/undefined).
 */
// The stored `autoCheckInterval` is in minutes and may be fractional (0.5 = 30 sec).
// useOpenAPISyncPolling ticks every 10 sec, so a shorter interval would not be honored.
export const MIN_CHECK_INTERVAL_MINUTES = 10 / 60;

export const formatCheckInterval = (minutes, { long = false } = {}) => {
  const inSeconds = minutes < 1;
  const amount = inSeconds ? Math.round(minutes * 60) : minutes;
  const unit = inSeconds ? ['sec', 'seconds'] : ['min', 'minutes'];
  return `${amount} ${unit[long ? 1 : 0]}`;
};

export const countEndpoints = (spec) => {
  if (!spec?.paths) return null;
  let count = 0;
  for (const path of Object.values(spec.paths)) {
    for (const key of Object.keys(path)) {
      if (HTTP_METHODS.includes(key.toLowerCase())) count++;
    }
  }
  return count;
};
