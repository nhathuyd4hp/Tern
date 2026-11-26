const CODE_FONT_CANDIDATES = [
  'Cascadia Code',
  'Cascadia Mono',
  'Consolas',
  'Courier New',
  'DejaVu Sans Mono',
  'Droid Sans Mono',
  'Fira Code',
  'Hack',
  'IBM Plex Mono',
  'Inconsolata',
  'JetBrains Mono',
  'Liberation Mono',
  'Lucida Console',
  'Menlo',
  'Monaco',
  'Noto Sans Mono',
  'Roboto Mono',
  'SF Mono',
  'Source Code Pro',
  'Ubuntu Mono'
];

const FALLBACK_FAMILIES = ['monospace', 'serif', 'sans-serif'];
const PROBE_TEXT = 'mmmmmmmmmmlli';

// A font that is not installed silently falls back, so it only measures differently
// from a bare fallback when the browser really found it.
const isFontInstalled = (context, fontName) => FALLBACK_FAMILIES.some((fallback) => {
  context.font = `72px ${fallback}`;
  const fallbackWidth = context.measureText(PROBE_TEXT).width;
  context.font = `72px "${fontName}", ${fallback}`;
  return context.measureText(PROBE_TEXT).width !== fallbackWidth;
});

export const getInstalledCodeFonts = () => {
  const context = document.createElement('canvas').getContext('2d');
  return context ? CODE_FONT_CANDIDATES.filter((fontName) => isFontInstalled(context, fontName)) : [];
};
