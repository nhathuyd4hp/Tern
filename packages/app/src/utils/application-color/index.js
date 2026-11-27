import { useSyncExternalStore } from 'react';

// Application icons are told apart by color. Unless one was chosen, the color comes from the application's
// path, so it is stable across restarts. Chosen colors are per machine and live in browser storage.
const AUTOMATIC_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// What the color dialog offers: the automatic ones plus more, and any color through the custom picker.
export const APPLICATION_COLOR_CHOICES = [
  ...AUTOMATIC_COLORS,
  '#1d4ed8', '#047857', '#b45309', '#b91c1c', '#6d28d9', '#be185d', '#0e7490', '#4d7c0f',
  '#64748b', '#78716c', '#f97316', '#14b8a6', '#a855f7', '#f43f5e', '#eab308', '#0ea5e9'
];

export const isValidApplicationColor = (color) => /^#[0-9a-f]{6}$/i.test(color);

const STORAGE_KEY = 'tern.applicationColors';

const keyOf = (application) => String(application?.pathname || application?.name || '').toLowerCase().replaceAll('\\', '/').replace(/\/+$/, '');

export const getAutomaticApplicationColor = (application) => {
  const key = keyOf(application);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AUTOMATIC_COLORS[hash % AUTOMATIC_COLORS.length];
};

const readChosenColors = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

let chosenColors = readChosenColors();
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Pass a color to choose it, or nothing to go back to the automatic one. */
export const setApplicationColor = (application, color) => {
  if (color && !isValidApplicationColor(color)) return;
  const next = { ...chosenColors };
  if (color) next[keyOf(application)] = color;
  else delete next[keyOf(application)];
  chosenColors = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage can be blocked; the choice then only lasts until the app closes
  }
  listeners.forEach((listener) => listener());
};

export const useApplicationColor = (application) => {
  const colors = useSyncExternalStore(subscribe, () => chosenColors);
  const chosen = colors[keyOf(application)];
  return isValidApplicationColor(chosen) ? chosen : getAutomaticApplicationColor(application);
};
