import { rgba, transparentize, darken, lighten, mix } from './index';

describe('color helpers', () => {
  it('keeps using polished for concrete colors', () => {
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    expect(darken(0.1, '#ff0000')).toBe('#c00');
  });

  it('emits color-mix for css variables', () => {
    expect(rgba('var(--t-brand)', 0.12)).toBe('color-mix(in srgb, var(--t-brand) 12%, transparent)');
    expect(transparentize(0.25, 'var(--t-brand)')).toBe('color-mix(in srgb, var(--t-brand) 75%, transparent)');
    expect(darken(0.1, 'var(--t-brand)')).toBe('color-mix(in srgb, var(--t-brand) 90%, black)');
    expect(lighten(0.1, 'var(--t-brand)')).toBe('color-mix(in srgb, var(--t-brand) 90%, white)');
    expect(mix(0.3, 'var(--t-a)', '#ffffff')).toBe('color-mix(in srgb, var(--t-a) 30%, #ffffff)');
  });

  it('composes with an earlier color-mix result', () => {
    expect(rgba(darken(0.1, 'var(--t-brand)'), 0.5)).toContain('color-mix(in srgb, color-mix(');
  });
});
