import light from './light/cyberdream-light';
import dark from './dark/cyberdream-dark';

// Switching themes must not re-render styled-components. So the theme handed to styled-components is
// constant and every value that differs between light and dark is a `var(--...)` reference; the
// variables themselves are defined per mode on <html>, and switching mode is just a class change.

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const variableName = (path) => `--t-${path.join('-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;

const NON_VARIABLE_KEYS = new Set(['mode']);

const collect = (lightNode, darkNode, path, cssTheme, lightVars, darkVars) => {
  Object.keys({ ...lightNode, ...darkNode }).forEach((key) => {
    const lightValue = lightNode?.[key];
    const darkValue = darkNode?.[key];
    const childPath = [...path, key];

    if (isPlainObject(lightValue) || isPlainObject(darkValue)) {
      cssTheme[key] = {};
      collect(lightValue, darkValue, childPath, cssTheme[key], lightVars, darkVars);
      return;
    }

    const sameInBothModes = JSON.stringify(lightValue) === JSON.stringify(darkValue);
    if (sameInBothModes || NON_VARIABLE_KEYS.has(key) || !['string', 'number'].includes(typeof (lightValue ?? darkValue))) {
      cssTheme[key] = lightValue ?? darkValue;
      return;
    }

    const name = variableName(childPath);
    cssTheme[key] = `var(${name})`;
    lightVars[name] = lightValue ?? darkValue;
    darkVars[name] = darkValue ?? lightValue;
  });
};

const build = () => {
  const cssTheme = {};
  const lightVars = {};
  const darkVars = {};
  collect(light, dark, [], cssTheme, lightVars, darkVars);

  const block = (selector, vars) => `${selector}{${Object.entries(vars).map(([name, value]) => `${name}:${value};`).join('')}}`;
  const css = `${block('html.light', lightVars)}${block('html.dark', darkVars)}`;

  return { cssTheme, css, lightVars, darkVars };
};

export const { cssTheme, css: themeVariablesCss, lightVars, darkVars } = build();
