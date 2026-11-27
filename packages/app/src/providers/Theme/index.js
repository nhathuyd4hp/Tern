import React from 'react';
import { Validator } from 'jsonschema';
import toast from 'react-hot-toast';
import { parseToRgb } from 'polished';
import themes, { themeRegistry, DEFAULT_THEME_VARIANTS } from 'themes/index';
import themeSchema from 'themes/schema';
import useLocalStorage from 'hooks/useLocalStorage/index';

import { createContext, useContext, useEffect, useState, useMemo, useCallback, startTransition } from 'react';
import { ThemeProvider as SCThemeProvider } from 'styled-components';

const validator = new Validator();

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
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

export const ThemeContext = createContext();
export const ThemeProvider = (props) => {
  const [storedTheme, setStoredThemeNow] = useLocalStorage('bruno.theme', 'system');
  // Re-theming re-renders every styled component; as a transition it never blocks the click that triggered it.
  const setStoredTheme = useCallback((next) => startTransition(() => setStoredThemeNow(next)), []);
  const [systemTheme, setSystemTheme] = useState(() => getEffectiveTheme('system'));
  const displayedTheme = storedTheme === 'system' ? systemTheme : storedTheme;
  // A stored variant that is no longer offered (removed themes) falls back to the default of its mode.
  const [storedVariantLight, setThemeVariantLight] = useLocalStorage('bruno.themeVariantLight', DEFAULT_THEME_VARIANTS.light);
  const [storedVariantDark, setThemeVariantDark] = useLocalStorage('bruno.themeVariantDark', DEFAULT_THEME_VARIANTS.dark);
  const themeVariantLight = themeRegistry[storedVariantLight] ? storedVariantLight : DEFAULT_THEME_VARIANTS.light;
  const themeVariantDark = themeRegistry[storedVariantDark] ? storedVariantDark : DEFAULT_THEME_VARIANTS.dark;

  // Track the OS theme; it only affects what is displayed in 'system' mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => setSystemTheme(e.matches ? 'light' : 'dark');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to the root element and the native window
  useEffect(() => {
    const effectiveTheme = displayedTheme;
    applyThemeToRoot(effectiveTheme);

    if (window.ipcRenderer) {
      const isLight = effectiveTheme === 'light';
      const variantName = isLight ? themeVariantLight : themeVariantDark;
      const rawBg = themes[variantName]?.bg || (isLight ? '#ffffff' : '#1e1e1e');
      // Convert to hex — Electron's backgroundColor only accepts hex colors
      const { red, green, blue } = parseToRgb(rawBg);
      const themeBg = `#${[red, green, blue].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      window.ipcRenderer.send('renderer:theme-change', storedTheme, themeBg);
    }
  }, [displayedTheme, storedTheme, themeVariantLight, themeVariantDark]);

  // storedTheme can have 3 values: 'light', 'dark', 'system'
  // displayedTheme can have 2 values: 'light', 'dark'

  const theme = useMemo(() => {
    const isLightMode = displayedTheme === 'light';
    const variantName = isLightMode ? themeVariantLight : themeVariantDark;
    const fallbackTheme = isLightMode ? themes.light : themes.dark;
    const fallbackName = isLightMode ? 'light' : 'dark';

    // Check if the variant exists in themes
    const selectedTheme = themes[variantName];
    if (!selectedTheme) {
      // Only show toast if using a non-default variant that doesn't exist
      if (variantName !== fallbackName) {
        toast.error(`Theme "${variantName}" not found. Using default ${fallbackName} theme.`, {
          duration: 4000,
          id: `theme-not-found-${variantName}` // Prevent duplicate toasts
        });
      }
      return fallbackTheme;
    }

    // Validate the theme against the schema
    const validationResult = validator.validate(selectedTheme, themeSchema);
    if (!validationResult.valid) {
      const errors = validationResult.errors?.map((e) => e.stack).join(', ') || 'Unknown validation error';
      console.error(`Theme "${variantName}" validation failed:`, errors);
      toast.error(`Invalid theme "${variantName}". Using default ${fallbackName} theme.`, {
        duration: 4000,
        id: `theme-invalid-${variantName}` // Prevent duplicate toasts
      });
      return fallbackTheme;
    }

    return selectedTheme;
  }, [displayedTheme, themeVariantLight, themeVariantDark]);

  const value = useMemo(() => ({
    theme,
    storedTheme,
    displayedTheme,
    setStoredTheme,
    themeVariantLight,
    setThemeVariantLight,
    themeVariantDark,
    setThemeVariantDark
  }), [theme, storedTheme, displayedTheme, setStoredTheme, themeVariantLight, setThemeVariantLight, themeVariantDark, setThemeVariantDark]);

  return (
    <ThemeContext.Provider value={value}>
      <SCThemeProvider theme={theme} {...props} />
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
