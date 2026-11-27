import React from 'react';
import { rgba } from 'utils/color';
import { useTheme } from 'providers/Theme';
import themes from 'themes/index';
import { IconBrightnessUp, IconMoon, IconDeviceDesktop } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const themeModes = [
  { key: 'light', label: 'Light', icon: IconBrightnessUp },
  { key: 'dark', label: 'Dark', icon: IconMoon },
  { key: 'system', label: 'System', icon: IconDeviceDesktop }
];

const modeThemes = {
  light: { name: 'Cyberdream Light', label: 'Light Theme' },
  dark: { name: 'Cyberdream Dark', label: 'Dark Theme' }
};

// A preview paints its own fixed theme, so it shows real colors rather than the active theme's variables.
const ThemePreview = ({ theme }) => {
  const lineColor = rgba(theme.brand, 0.5);

  return (
    <div className="theme-preview" style={{ background: theme.background.base, border: `1px solid ${lineColor}` }}>
      <div className="theme-preview-sidebar" style={{ background: theme.sidebar.bg }} />
      <div className="theme-preview-main">
        <div className="theme-preview-line" style={{ background: lineColor }} />
        <div className="theme-preview-line" style={{ background: lineColor, width: '60%' }} />
        <div className="theme-preview-line" style={{ background: lineColor, width: '70%' }} />
      </div>
    </div>
  );
};

const ThemeSection = ({ mode }) => (
  <div className="theme-variant-section">
    <div className="theme-variant-label">{modeThemes[mode].label}</div>
    <div className="theme-variants">
      <div className="theme-variant-card selected">
        <ThemePreview theme={themes[mode]} />
        <span className="theme-variant-name">{modeThemes[mode].name}</span>
      </div>
    </div>
  </div>
);

const Themes = () => {
  const { storedTheme, setStoredTheme } = useTheme();

  return (
    <StyledWrapper>
      <div className="flex flex-col gap-4 w-full appearance-container">
        <div>
          <div className="section-header">Appearance</div>
        </div>

        <div className="flex gap-3 theme-mode-selector justify-start">
          {themeModes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = storedTheme === mode.key;

            return (
              <button
                key={mode.key}
                onClick={() => setStoredTheme(mode.key)}
                className={`theme-mode-option relative ${isSelected ? 'selected' : ''}`}
              >
                <div className="flex items-center justify-start gap-2">
                  <Icon size={16} strokeWidth={1.5} />
                  <span>{mode.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="section-divider" />

        {storedTheme !== 'dark' && <ThemeSection mode="light" />}
        {storedTheme === 'system' && <div className="section-divider" />}
        {storedTheme !== 'light' && <ThemeSection mode="dark" />}
      </div>
    </StyledWrapper>
  );
};

export default Themes;
