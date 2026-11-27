import { getApplicationColor } from './index';

describe('getApplicationColor', () => {
  it('gives the same color to the same application', () => {
    expect(getApplicationColor({ pathname: 'C:\\Apps\\Plombery' })).toBe(getApplicationColor({ pathname: 'c:/apps/plombery' }));
  });

  it('gives different applications different colors', () => {
    const colors = ['PetStore', 'Plombery', 'Billing', 'Auth', 'Gateway'].map((name) => getApplicationColor({ pathname: `/apps/${name}` }));
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  it('falls back to a color without a path', () => {
    expect(getApplicationColor({})).toMatch(/^#/);
  });
});
