import React from 'react';
import { parseToRgb } from 'utils/color';
import themes from 'themes/index';
import { cssTheme, themeVariablesCss } from 'themes/cssVariables';
import useLocalStorage from 'hooks/useLocalStorage/index';

import { createContext, useContext, useEffect, useLayoutEffect, useState, useMemo, useCallback, startTransition } from 'react';
import { ThemeProvider as SCThemeProvider } from 'styled-components';

// Every color reaches styled-components as a CSS variable (see themes/cssVariables), so the variables are
// defined once here and switching light/dark is only a class change on <html>.
const themeVariablesStyle = document.createElement('style');
themeVariablesStyle.textContent = themeVariablesCss;
document.head.appendChild(themeVariablesStyle);

// Helper: Get effective theme ('light' or 'dark') based on storedTheme
const getEffectiveTheme = (storedTheme) => {
  if (storedTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return storedTheme;
};

// Helper: Apply theme class to root element
const applyThemeToRoot = (theme) => {
  const root = window.document.documentElement;
  root.classList.add('theme-switching');
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  // Two frames: the first paints the new colors, the second is when transitions may resume.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
};

export const ThemeContext = createContext();
export const ThemeProvider = (props) => {
  const [storedTheme, setStoredThemeNow] = useLocalStorage('bruno.theme', 'system');
  // Re-theming re-renders every styled component; as a transition it never blocks the click that triggered it.
  const setStoredTheme = useCallback((next) => startTransition(() => setStoredThemeNow(next)), []);
  const [systemTheme, setSystemTheme] = useState(() => getEffectiveTheme('system'));
  const displayedTheme = storedTheme === 'system' ? systemTheme : storedTheme;

  // Track the OS theme; it only affects what is displayed in 'system' mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => setSystemTheme(e.matches ? 'light' : 'dark');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Before paint, so the variables for the mode exist on the first frame
  useLayoutEffect(() => applyThemeToRoot(displayedTheme), [displayedTheme]);

  // Apply theme to the native window
  useEffect(() => {
    const effectiveTheme = displayedTheme;

    if (window.ipcRenderer) {
      const rawBg = themes[effectiveTheme].bg;
      // Convert to hex — Electron's backgroundColor only accepts hex colors
      const { red, green, blue } = parseToRgb(rawBg);
      const themeBg = `#${[red, green, blue].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      window.ipcRenderer.send('renderer:theme-change', storedTheme, themeBg);
    }
  }, [displayedTheme, storedTheme]);

  // storedTheme can have 3 values: 'light', 'dark', 'system'
  // displayedTheme can have 2 values: 'light', 'dark'

  const theme = themes[displayedTheme];

  const value = useMemo(() => ({
    theme,
    storedTheme,
    displayedTheme,
    setStoredTheme
  }), [theme, storedTheme, displayedTheme, setStoredTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <SCThemeProvider theme={cssTheme} {...props} />
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error(`useTheme must be used within a ThemeProvider`);
  }

  return context;
};

export default ThemeProvider;
