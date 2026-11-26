import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;

  .menu-bar-item {
    height: 26px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.subtext0};
    cursor: pointer;

    &:hover,
    &[aria-expanded="true"] {
      background: ${(props) => props.theme.background.mantle};
      color: ${(props) => props.theme.text};
    }
  }

  .shortcut {
    font-size: 11px;
    color: ${(props) => props.theme.dropdown.mutedText};
  }
`;

export default StyledWrapper;
