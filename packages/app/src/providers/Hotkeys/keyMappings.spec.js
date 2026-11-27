const {
  getKeyBindingDisplayTextByOS,
  getKeyBindingForActionByOS
} = require('./keyMappings');

describe('keyMappings display helpers', () => {
  it('formats default shortcuts for display', () => {
    expect(getKeyBindingDisplayTextByOS('sendRequest', undefined, 'windows')).toBe('Ctrl + Enter');
    expect(getKeyBindingDisplayTextByOS('sendRequest', undefined, 'mac')).toBe('⌘ + ↩');
  });

  it('uses F2 to rename and Ctrl+F4 to close a tab on Windows', () => {
    expect(getKeyBindingDisplayTextByOS('renameItem', undefined, 'windows')).toBe('F2');
    expect(getKeyBindingDisplayTextByOS('closeTab', undefined, 'windows')).toBe('Ctrl + F4');
  });

  it('uses user keybinding overrides before formatting shortcuts', () => {
    const userKeyBindings = {
      sendRequest: {
        windows: 'ctrl+bind+shift+bind+r',
        mac: 'command+bind+shift+bind+r'
      }
    };

    expect(getKeyBindingForActionByOS('sendRequest', userKeyBindings, 'windows')).toBe('ctrl+bind+shift+bind+r');
    expect(getKeyBindingDisplayTextByOS('sendRequest', userKeyBindings, 'windows')).toBe('Ctrl + Shift + R');
    expect(getKeyBindingDisplayTextByOS('sendRequest', userKeyBindings, 'mac')).toBe('⇧ + ⌘ + R');
  });
});
