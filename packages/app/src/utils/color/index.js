import * as polished from 'polished';

export * from 'polished';

// Theme colors are CSS `var(--...)` references, which polished cannot parse. For those the helpers
// below emit an equivalent CSS `color-mix()` so the browser resolves them per theme; any other
// color is handed to polished untouched.
const isCssColor = (color) => typeof color === 'string' && /var\(|color-mix\(/.test(color);
const percent = (fraction) => `${Math.round(fraction * 1000) / 10}%`;

export const rgba = (color, alpha, ...rest) => (
  isCssColor(color) && rest.length === 0
    ? `color-mix(in srgb, ${color} ${percent(alpha)}, transparent)`
    : polished.rgba(color, alpha, ...rest)
);

export const transparentize = (amount, color) => (
  isCssColor(color)
    ? `color-mix(in srgb, ${color} ${percent(1 - amount)}, transparent)`
    : polished.transparentize(amount, color)
);

export const darken = (amount, color) => (
  isCssColor(color)
    ? `color-mix(in srgb, ${color} ${percent(1 - amount)}, black)`
    : polished.darken(amount, color)
);

export const lighten = (amount, color) => (
  isCssColor(color)
    ? `color-mix(in srgb, ${color} ${percent(1 - amount)}, white)`
    : polished.lighten(amount, color)
);

export const mix = (weight, color, otherColor) => (
  isCssColor(color) || isCssColor(otherColor)
    ? `color-mix(in srgb, ${color} ${percent(weight)}, ${otherColor})`
    : polished.mix(weight, color, otherColor)
);
