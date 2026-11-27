import vscodeLight from './light/vscode';
import cyberdreamLight from './light/cyberdream-light';
import vscodeDark from './dark/vscode';
import nord from './dark/nord';
import cyberdreamDark from './dark/cyberdream-dark';

// Only themes whose accent matches the blue/cyan of the app logo are kept.
const themes = {
  // `light` and `dark` are the defaults; they point at the closest match to the logo blue.
  'light': vscodeLight,
  'dark': vscodeDark,
  'vscode-light': vscodeLight,
  'vscode-dark': vscodeDark,
  'cyberdream-light': cyberdreamLight,
  'cyberdream-dark': cyberdreamDark,
  nord
};

export const DEFAULT_THEME_VARIANTS = { light: 'vscode-light', dark: 'vscode-dark' };

// Theme metadata for UI display
export const themeRegistry = {
  'vscode-light': {
    id: 'vscode-light',
    name: 'VS Code Light',
    mode: 'light'
  },
  'cyberdream-light': {
    id: 'cyberdream-light',
    name: 'Cyberdream Light',
    mode: 'light'
  },
  'vscode-dark': {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    mode: 'dark'
  },
  'nord': {
    id: 'nord',
    name: 'Nord',
    mode: 'dark'
  },
  'cyberdream-dark': {
    id: 'cyberdream-dark',
    name: 'Cyberdream Dark',
    mode: 'dark'
  }
};

export const getLightThemes = () => Object.values(themeRegistry).filter((t) => t.mode === 'light');
export const getDarkThemes = () => Object.values(themeRegistry).filter((t) => t.mode === 'dark');

export default themes;
