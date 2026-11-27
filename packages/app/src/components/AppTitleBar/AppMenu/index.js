import { useState } from 'react';
import Cookies from 'components/Cookies';
import Portal from 'components/Portal';
import { useApp } from 'providers/App';
import StyledWrapper from './StyledWrapper';

const MENU_ITEMS = [
  { id: 'preferences', label: 'Preferences', channel: 'renderer:open-preferences' },
  { id: 'devtools', label: 'Developer Tools', channel: 'renderer:toggle-devtools' },
  { id: 'cookies', label: 'Cookies' }
];

// Each entry of the menu bar does its job when clicked; there are no submenus.
const AppMenu = () => {
  const [cookiesOpen, setCookiesOpen] = useState(false);
  const { version } = useApp();

  const run = ({ id, channel }) => {
    if (id === 'cookies') {
      setCookiesOpen(true);
      return;
    }
    window.ipcRenderer?.invoke(channel);
  };

  return (
    <StyledWrapper role="menubar" data-testid="app-menu-bar">
      {cookiesOpen && (
        <Portal>
          <Cookies
            onClose={() => setCookiesOpen(false)}
            aria-modal="true"
            role="dialog"
            aria-labelledby="cookies-title"
            aria-describedby="cookies-description"
          />
        </Portal>
      )}
      {MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="menu-bar-item"
          data-testid={`app-menu-${item.id}`}
          onClick={() => run(item)}
        >
          {item.label}
        </button>
      ))}
      {version && <span className="menu-bar-version" data-testid="app-version">v{version}</span>}
    </StyledWrapper>
  );
};

export default AppMenu;
