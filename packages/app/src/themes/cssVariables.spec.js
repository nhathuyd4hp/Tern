import light from './light/cyberdream-light';
import dark from './dark/cyberdream-dark';
import { cssTheme, lightVars, darkVars } from './cssVariables';

const resolve = (node, vars) => {
  if (typeof node === 'string') {
    const match = node.match(/^var\((--[^)]+)\)$/);
    return match ? vars[match[1]] : node;
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolve(value, vars)]));
  }
  return node;
};

describe('theme css variables', () => {
  it('resolves back to the light theme', () => {
    expect(resolve(cssTheme, lightVars)).toEqual({ ...light, mode: 'light' });
  });

  it('resolves back to the dark theme', () => {
    expect(resolve(cssTheme, darkVars)).toEqual({ ...dark, mode: 'light' });
  });

  it('defines every variable in both modes', () => {
    expect(Object.keys(lightVars)).toEqual(Object.keys(darkVars));
  });
});
