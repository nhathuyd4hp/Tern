import styled from 'styled-components';

const StyledWrapper = styled.div`
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: ${(props) => props.theme.modal.bg};
    gap: 12px;
    flex-shrink: 0;
  }

  .left-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .select-wrapper {
    min-width: 140px;
  }

  .library-options {
    display: flex;
    gap: 6px;
  }

  .lib-btn {
    height: 32px;
    padding: 0 12px;
    background: ${(props) => props.theme.requestTabPanel.url.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 3px;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;

    &:hover {
      background: ${(props) => props.theme.dropdown.hoverBg};
      border-color: ${(props) => props.theme.input.focusBorder};
    }

    &.active {
      background: ${(props) => props.theme.button.secondary.bg};
      border-color: ${(props) => props.theme.button.secondary.border};
      color: ${(props) => props.theme.button.secondary.color};
    }
  }

  .right-controls {
    .interpolate-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: ${(props) => props.theme.font.size.base};
      color: ${(props) => props.theme.text};

      input[type="checkbox"] {
        cursor: pointer;
        margin: 0;
      }

      &:hover {
        opacity: 0.8;
      }
    }
  }
`;

export default StyledWrapper;
