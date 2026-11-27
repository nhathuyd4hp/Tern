import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`
  /* Main container */
  .theme-menu {
    display: flex;
    flex-direction: column;
    padding: 8px;
    background: ${(props) => props.theme.dropdown.bg};
    border: 1px solid ${(props) => props.theme.dropdown.border};
    border-radius: 6px;
    box-shadow: ${(props) => props.theme.dropdown.shadow};
    outline: none;
  }

  /* Mode section */
  .mode-section {
    padding: 0 4px;
  }

  .mode-label {
    font-size: 12px;
    color: ${(props) => props.theme.dropdown.mutedText};
    margin-bottom: 8px;
  }

  .mode-buttons {
    display: flex;
    gap: 10px;
  }

  .mode-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 8px 4px;
    border: 1px solid ${(props) => props.theme.dropdown.separator};
    border-radius: 4px;
    background: transparent;
    color: ${(props) => props.theme.dropdown.mutedText};
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: ${(props) => props.theme.dropdown.hoverBg};
      color: ${(props) => props.theme.dropdown.color};
    }

    &.focused {
      background: ${(props) => props.theme.dropdown.hoverBg};
      color: ${(props) => props.theme.dropdown.color};
      outline: none;
    }

    &.active {
      background: ${(props) => rgba(props.theme.dropdown.selectedColor, 0.08)};
      border-color: ${(props) => props.theme.dropdown.selectedColor};
      color: ${(props) => props.theme.dropdown.selectedColor};

      &.focused {
        background: ${(props) => rgba(props.theme.dropdown.selectedColor, 0.15)};
        outline: none;
      }
    }
  }
`;

export default StyledWrapper;
