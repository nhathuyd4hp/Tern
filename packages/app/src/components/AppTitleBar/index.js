import { IconHome, IconMinus, IconSquare, IconX, IconCopy } from '@tabler/icons';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { toggleSidebarCollapse } from 'providers/ReduxStore/slices/app';
import { setLocalStorageValue, SIDEBAR_COLLAPSED_KEY } from 'utils/common/localStorage';
import { focusTab } from 'providers/ReduxStore/slices/tabs';

import Bruno from 'components/Bruno';
import ActionIcon from 'ui/ActionIcon';
import IconSidebarToggle from 'components/Icons/IconSidebarToggle';

import AppMenu from './AppMenu';
import StyledWrapper from './StyledWrapper';
import ResponseLayoutToggle from 'components/ResponsePane/ResponseLayoutToggle';
import { isMacOS, isWindowsOS, isLinuxOS } from 'utils/common/platform';

const getOsClass = () => {
  if (isMacOS()) return 'os-mac';
  if (isWindowsOS()) return 'os-windows';
  if (isLinuxOS()) return 'os-linux';
  return 'os-other';
};

const AppTitleBar = () => {
  const dispatch = useDispatch();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const osClass = getOsClass();
  const isWindows = osClass === 'os-windows';
  const isLinux = osClass === 'os-linux';
  const showWindowControls = isWindows || isLinux;

  // Listen for fullscreen changes
  useEffect(() => {
    const { ipcRenderer } = window;
    if (!ipcRenderer) return;

    ipcRenderer.invoke('renderer:window-is-fullscreen')
      .then((fullscreen) => {
        setIsFullScreen(fullscreen);
      })
      .catch((error) => {
        console.error('Error getting initial fullscreen state:', error);
      });

    const removeEnterFullScreenListener = ipcRenderer.on('main:enter-full-screen', () => {
      setIsFullScreen(true);
    });

    const removeLeaveFullScreenListener = ipcRenderer.on('main:leave-full-screen', () => {
      setIsFullScreen(false);
    });

    return () => {
      removeEnterFullScreenListener();
      removeLeaveFullScreenListener();
    };
  }, []);

  useEffect(() => {
    if (!showWindowControls) return;
    const { ipcRenderer } = window;
    if (!ipcRenderer) return;

    ipcRenderer.invoke('renderer:window-is-maximized')
      .then((maximized) => {
        setIsMaximized(maximized);
      })
      .catch((error) => {
        console.error('Error getting initial maximized state:', error);
      });

    const removeMaximizedListener = ipcRenderer.on('main:window-maximized', () => {
      setIsMaximized(true);
    });

    const removeUnmaximizedListener = ipcRenderer.on('main:window-unmaximized', () => {
      setIsMaximized(false);
    });

    return () => {
      removeMaximizedListener();
      removeUnmaximizedListener();
    };
  }, [showWindowControls]);

  const handleMinimize = useCallback(() => {
    window.ipcRenderer?.send('renderer:window-minimize');
  }, []);

  const handleMaximize = useCallback(() => {
    window.ipcRenderer?.send('renderer:window-maximize');
    // State will be updated via IPC events from main process (main:window-maximized/main:window-unmaximized)
  }, []);

  const handleClose = useCallback(() => {
    window.ipcRenderer?.send('renderer:window-close');
  }, []);

  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const sidebarCollapsed = useSelector((state) => state.app.sidebarCollapsed);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);

  const handleHomeClick = () => {
    const scratchCollectionUid = activeWorkspace?.scratchCollectionUid;
    if (scratchCollectionUid) {
      dispatch(focusTab({ uid: `${scratchCollectionUid}-overview` }));
    }
  };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebarCollapse());
    setLocalStorageValue(SIDEBAR_COLLAPSED_KEY, !sidebarCollapsed);
  };

  return (
    <StyledWrapper data-testid="app-titlebar" className={`app-titlebar ${osClass} ${isFullScreen ? 'fullscreen' : ''}`}>
      <div className="titlebar-content">
        <div className="titlebar-left">
          <ActionIcon onClick={handleHomeClick} label="Home" size="lg" className="home-button">
            <IconHome size={16} stroke={1.5} />
          </ActionIcon>

          {showWindowControls && <AppMenu />}
        </div>

        {/* Center section: Bruno logo + text */}
        <div className="titlebar-center">
          <Bruno width={18} />
          <span className="bruno-text">Kevin</span>
        </div>

        {/* Right section: Action buttons */}
        <div className="titlebar-right">
          <div className="titlebar-actions">
            {/* Toggle sidebar */}
            <ActionIcon
              onClick={handleToggleSidebar}
              label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              size="lg"
              data-testid="toggle-sidebar-button"
            >
              <IconSidebarToggle collapsed={sidebarCollapsed} size={16} strokeWidth={1.5} />
            </ActionIcon>

            <ResponseLayoutToggle />
          </div>

          {showWindowControls && (
            <div className="window-controls">
              <button
                className="window-control-btn minimize"
                onClick={handleMinimize}
                aria-label="Minimize"
              >
                <IconMinus size={16} stroke={1} />
              </button>
              <button
                className="window-control-btn maximize"
                onClick={handleMaximize}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <IconCopy size={14} stroke={1} /> : <IconSquare size={14} stroke={1} />}
              </button>
              <button
                className="window-control-btn close"
                onClick={handleClose}
                aria-label="Close"
              >
                <IconX size={16} stroke={1} />
              </button>
            </div>
          )}
        </div>
      </div>
    </StyledWrapper>
  );
};

export default AppTitleBar;
