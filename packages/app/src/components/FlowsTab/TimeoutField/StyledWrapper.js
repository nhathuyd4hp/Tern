import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-flex;
  align-items: stretch;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.sm};
  background: ${(props) => props.theme.input.bg};
  overflow: hidden;

  &:focus-within {
    border-color: ${(props) => props.theme.input.focusBorder};
  }

  input {
    width: 3.5rem;
    padding: 0.25rem 0;
    border: none;
    background: transparent;
    color: ${(props) => props.theme.text};
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
    text-align: center;

    &:focus {
      outline: none;
    }
  }

  button {
    display: inline-flex;
    align-items: center;
    padding: 0 0.375rem;
    border: none;
    background: transparent;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;

    &:hover:not(:disabled) {
      background: ${(props) => props.theme.background.mantle};
      color: ${(props) => props.theme.text};
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
`;

export default StyledWrapper;
