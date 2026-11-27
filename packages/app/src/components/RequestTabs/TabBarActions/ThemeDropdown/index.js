import React, { useState, useRef, useCallback, useEffect } from 'react';
import Tippy from '@tippyjs/react';
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons';
import ToolHint from 'components/ToolHint';
import { useTheme } from 'providers/Theme';
import StyledWrapper from './StyledWrapper';

const MODE_BUTTONS = [
  { mode: 'light', icon: IconSun, title: 'Light' },
  { mode: 'dark', icon: IconMoon, title: 'Dark' },
  { mode: 'system', icon: IconDeviceDesktop, title: 'System' }
];

const ThemeDropdown = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipEnabled, setTooltipEnabled] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);

  const modeButtonRefs = useRef([]);
  const { storedTheme, setStoredTheme } = useTheme();

  const handleOpen = () => {
    setTooltipEnabled(false);
    setIsOpen(true);
    setFocusedIndex(MODE_BUTTONS.findIndex((btn) => btn.mode === storedTheme));
    setIsKeyboardNav(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setTooltipEnabled(true), 100);
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => modeButtonRefs.current[focusedIndex]?.focus(), 0);
    return () => clearTimeout(timer);
  }, [isOpen, focusedIndex]);

  const handleKeyDown = useCallback((e) => {
    const handlers = {
      'Escape': handleClose,
      'Tab': handleClose,
      'ArrowLeft': () => setFocusedIndex((i) => Math.max(i - 1, 0)),
      'ArrowRight': () => setFocusedIndex((i) => Math.min(i + 1, MODE_BUTTONS.length - 1)),
      'Enter': () => setStoredTheme(MODE_BUTTONS[focusedIndex].mode),
      ' ': () => setStoredTheme(MODE_BUTTONS[focusedIndex].mode)
    };
    if (!handlers[e.key]) return;
    e.preventDefault();
    setIsKeyboardNav(true);
    handlers[e.key]();
  }, [focusedIndex, setStoredTheme]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const menuContent = (
    <StyledWrapper>
      <div className="theme-menu" role="dialog" aria-label="Theme selector">
        <div className="mode-section">
          <div className="mode-label" id="mode-label">Appearance</div>
          <div className="mode-buttons" role="radiogroup" aria-labelledby="mode-label">
            {MODE_BUTTONS.map((btn, index) => {
              const Icon = btn.icon;
              const isActive = storedTheme === btn.mode;
              const focusedClass = isKeyboardNav && focusedIndex === index ? 'focused' : '';
              return (
                <button
                  key={btn.mode}
                  ref={(el) => (modeButtonRefs.current[index] = el)}
                  className={`mode-button ${isActive ? 'active' : ''} ${focusedClass}`}
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={-1}
                  onClick={() => setStoredTheme(btn.mode)}
                  onMouseEnter={() => {
                    setIsKeyboardNav(false);
                    setFocusedIndex(index);
                  }}
                  title={btn.title}
                >
                  <Icon size={18} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </StyledWrapper>
  );

  return (
    <ToolHint text="Theme" toolhintId="ThemeDropdown" place="bottom" offset={10} hidden={!tooltipEnabled}>
      <Tippy
        content={menuContent}
        placement="bottom-end"
        interactive
        arrow={false}
        animation={false}
        visible={isOpen}
        onClickOutside={handleClose}
        appendTo="parent"
      >
        <div onClick={() => (isOpen ? handleClose() : handleOpen())}>
          {children}
        </div>
      </Tippy>
    </ToolHint>
  );
};

export default ThemeDropdown;
