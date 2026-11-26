import styled from 'styled-components';

const Wrapper = styled.div`
  height: 36px;
  display: flex;
  align-items: center;
  background: ${(props) => props.theme.sidebar.bg};
  -webkit-app-region: drag;
  user-select: none;

  .titlebar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 0 12px;
    padding-left: 70px; /* Space for macOS window controls */
    transition: padding-left 0.15s ease;
  }

  /* When in full screen, no traffic lights so reduce padding */
  &.fullscreen .titlebar-content {
    padding-left: 6px;
  }

  /* Remove drag region from interactive elements */
  .home-button,
  button {
    -webkit-app-region: no-drag;
  }

  /* Left section */
  .titlebar-left {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: 10px;
    -webkit-app-region: no-drag;
  }

  /* When in full screen, no traffic lights so remove margin-left */
  &.fullscreen .titlebar-left {
    margin-left: 0px;
  }

  /* Center section - Bruno branding */
  .titlebar-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;

    .bruno-text {
      font-size: 13px;
      font-weight: 600;
      color: ${(props) => props.theme.text};
      letter-spacing: 0.5px;
    }
  }

  /* Right section */
  .titlebar-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
  }

  /* App action buttons container */
  .titlebar-actions {
    display: flex;
    align-items: center;
  }

  /* Adjust for non-macOS platforms */
  &:not(.os-mac) .titlebar-content {
    padding-left: 12px;
  }

  /* Windows-specific styles */
  &.os-windows .titlebar-content {
    padding-right: 0px;
    padding-left: 0px;
  }

  &.os-windows .titlebar-left {
    margin-left: 6px;
  }

  &.os-linux .titlebar-content {
    padding-right: 0px;
    padding-left: 0px;
  }

  &.os-linux .titlebar-left {
    margin-left: 6px;
  }

  .app-menu {
    margin-left: 8px;
  }

  /* Custom window control buttons for Windows - always interactive, above modal overlay */
  .window-controls {
    display: flex;
    align-items: stretch;
    height: 36px;
    margin-left: 8px;
    position: relative;
    z-index: 1000;
  }

  .window-control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: ${(props) => props.theme.text};
    cursor: pointer;
    transition: background-color 0.1s ease;
    -webkit-app-region: no-drag;

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }

    &:active {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }

    &.close:hover {
      background: #e81123;
      color: white;
    }
  }
`;

export default Wrapper;
