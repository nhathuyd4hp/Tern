import React from 'react';
import { IconBrightnessUp, IconMoon, IconDeviceDesktop } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const themeModes = [
  { key: 'light', label: 'Light', icon: IconBrightnessUp },
  { key: 'dark', label: 'Dark', icon: IconMoon },
  { key: 'system', label: 'System', icon: IconDeviceDesktop }
];

const ThemeStep = ({ storedTheme, setStoredTheme }) => (
  <StyledWrapper className="step-body">
    <div className="step-label">Appearance</div>
    <div className="step-title">Choose your theme</div>
    <div className="step-description">
      Pick a look that feels right. You can always change this later in Preferences.
    </div>

    <div className="theme-mode-buttons">
      {themeModes.map((mode) => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.key}
            className={`theme-mode-btn ${storedTheme === mode.key ? 'active' : ''}`}
            onClick={() => setStoredTheme(mode.key)}
          >
            <Icon size={16} stroke={1.5} />
            {mode.label}
          </button>
        );
      })}
    </div>
  </StyledWrapper>
);

export default ThemeStep;
