import React, { useState } from 'react';
import MenuDropdown from 'ui/MenuDropdown';
import StyledWrapper from './StyledWrapper';

const AppMenu = () => {
  const [openMenuId, setOpenMenuId] = useState(null);
  const { ipcRenderer } = window;

  const menuItems = [
    {
      id: 'file',
      label: 'File',
      submenu: [
        {
          id: 'open-collection',
          label: 'Open Collection',
          onClick: () => ipcRenderer?.send('renderer:open-collection')
        },
        { type: 'divider', id: 'file-div-1' },
        {
          id: 'preferences',
          label: 'Preferences',
          rightSection: <span className="shortcut">Ctrl+,</span>,
          onClick: () => ipcRenderer?.invoke('renderer:open-preferences')
        },
        { type: 'divider', id: 'file-div-2' },
        {
          id: 'quit',
          label: 'Quit',
          rightSection: <span className="shortcut">Alt+F4</span>,
          onClick: () => ipcRenderer?.send('renderer:window-close')
        }
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      submenu: [
        {
          id: 'undo',
          label: 'Undo',
          rightSection: <span className="shortcut">Ctrl+Z</span>,
          onClick: () => document.execCommand('undo')
        },
        {
          id: 'redo',
          label: 'Redo',
          rightSection: <span className="shortcut">Ctrl+Y</span>,
          onClick: () => document.execCommand('redo')
        },
        { type: 'divider', id: 'edit-div-1' },
        {
          id: 'cut',
          label: 'Cut',
          rightSection: <span className="shortcut">Ctrl+X</span>,
          onClick: () => document.execCommand('cut')
        },
        {
          id: 'copy',
          label: 'Copy',
          rightSection: <span className="shortcut">Ctrl+C</span>,
          onClick: () => document.execCommand('copy')
        },
        {
          id: 'paste',
          label: 'Paste',
          rightSection: <span className="shortcut">Ctrl+V</span>,
          onClick: () => document.execCommand('paste')
        },
        { type: 'divider', id: 'edit-div-2' },
        {
          id: 'select-all',
          label: 'Select All',
          rightSection: <span className="shortcut">Ctrl+A</span>,
          onClick: () => document.execCommand('selectAll')
        }
      ]
    },
    {
      id: 'view',
      label: 'View',
      submenu: [
        {
          id: 'toggle-devtools',
          label: 'Developer Tools',
          rightSection: <span className="shortcut">Ctrl+Shift+I</span>,
          onClick: () => ipcRenderer?.invoke('renderer:toggle-devtools')
        },
        { type: 'divider', id: 'view-div-1' },
        {
          id: 'reset-zoom',
          label: 'Reset Zoom',
          rightSection: <span className="shortcut">Ctrl+0</span>,
          onClick: () => ipcRenderer?.invoke('renderer:reset-zoom')
        },
        {
          id: 'zoom-in',
          label: 'Zoom In',
          rightSection: <span className="shortcut">Ctrl++</span>,
          onClick: () => ipcRenderer?.invoke('renderer:zoom-in')
        },
        {
          id: 'zoom-out',
          label: 'Zoom Out',
          rightSection: <span className="shortcut">Ctrl+-</span>,
          onClick: () => ipcRenderer?.invoke('renderer:zoom-out')
        },
        { type: 'divider', id: 'view-div-2' },
        {
          id: 'toggle-fullscreen',
          label: 'Full Screen',
          rightSection: <span className="shortcut">F11</span>,
          onClick: () => ipcRenderer?.invoke('renderer:toggle-fullscreen')
        }
      ]
    }
  ];

  const handleOpenChange = (menuId) => (opened) => {
    setOpenMenuId((current) => (opened ? menuId : current === menuId ? null : current));
  };

  return (
    <StyledWrapper role="menubar" data-testid="app-menu-bar">
      {menuItems.map((menu) => (
        <MenuDropdown
          key={menu.id}
          opened={openMenuId === menu.id}
          onChange={handleOpenChange(menu.id)}
          placement="bottom-start"
          showTickMark={false}
          items={menu.submenu}
        >
          <button
            type="button"
            className="menu-bar-item"
            data-testid={`app-menu-${menu.id}`}
            // While one menu is open, hovering another switches to it, as in a desktop menu bar.
            onMouseEnter={() => openMenuId && setOpenMenuId(menu.id)}
          >
            {menu.label}
          </button>
        </MenuDropdown>
      ))}
    </StyledWrapper>
  );
};

export default AppMenu;
