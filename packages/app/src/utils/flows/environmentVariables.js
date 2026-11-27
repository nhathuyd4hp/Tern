import {
  getEnvironmentVariables,
  getEnvironmentVariablesMasked,
  getGlobalEnvironmentVariables,
  getGlobalEnvironmentVariablesMasked
} from 'utils/collections';

/**
 * The variables of the selected environments, as the suggestions {{ offers: [{ key, name, source, value }].
 * The application environment wins over the global one when both have the name; a secret shows no value.
 */
export const getEnvironmentSuggestions = (application, { globalEnvironments, activeGlobalEnvironmentUid }) => {
  const global = { globalEnvironments, activeGlobalEnvironmentUid };
  const secrets = new Set([...getEnvironmentVariablesMasked(application), ...getGlobalEnvironmentVariablesMasked(global)]);
  const suggestionsOf = (variables, source) => Object.entries(variables).map(([name, value]) => ({
    key: `${source}|${name}`,
    name,
    source,
    value: secrets.has(name) ? undefined : value
  }));

  const own = suggestionsOf(getEnvironmentVariables(application), 'Application environment');
  const ownNames = new Set(own.map((suggestion) => suggestion.name));
  return [...own, ...suggestionsOf(getGlobalEnvironmentVariables(global), 'Global environment').filter((suggestion) => !ownNames.has(suggestion.name))];
};
