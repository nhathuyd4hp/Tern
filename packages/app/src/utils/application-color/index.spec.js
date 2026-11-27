import { renderHook, act } from '@testing-library/react';
import { getAutomaticApplicationColor, setApplicationColor, useApplicationColor, APPLICATION_COLOR_CHOICES } from './index';

describe('application color', () => {
  it('gives the same automatic color to the same application', () => {
    expect(getAutomaticApplicationColor({ pathname: 'C:\\Apps\\Plombery' })).toBe(getAutomaticApplicationColor({ pathname: 'c:/apps/plombery' }));
  });

  it('gives different applications different automatic colors', () => {
    const colors = ['PetStore', 'Plombery', 'Billing', 'Auth', 'Gateway'].map((name) => getAutomaticApplicationColor({ pathname: `/apps/${name}` }));
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  it('falls back to a color without a path', () => {
    expect(getAutomaticApplicationColor({})).toMatch(/^#/);
  });

  it('uses a chosen color, shared by every user of the hook, until it is reset', () => {
    const application = { pathname: '/apps/Chosen' };
    const first = renderHook(() => useApplicationColor(application));
    const second = renderHook(() => useApplicationColor({ pathname: '/APPS/chosen/' }));
    const automatic = first.result.current;
    const chosen = APPLICATION_COLOR_CHOICES.find((color) => color !== automatic);

    act(() => setApplicationColor(application, chosen));
    expect(first.result.current).toBe(chosen);
    expect(second.result.current).toBe(chosen);
    expect(JSON.parse(localStorage.getItem('tern.applicationColors'))['/apps/chosen']).toBe(chosen);

    act(() => setApplicationColor(application));
    expect(first.result.current).toBe(automatic);
  });

  it('accepts any hex color and ignores anything else', () => {
    const application = { pathname: '/apps/Custom' };
    const { result } = renderHook(() => useApplicationColor(application));
    const automatic = result.current;

    act(() => setApplicationColor(application, 'red; background: url(x)'));
    expect(result.current).toBe(automatic);

    act(() => setApplicationColor(application, '#123abc'));
    expect(result.current).toBe('#123abc');
  });
});
