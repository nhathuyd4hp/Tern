import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  margin-bottom: 0.75rem;

  .ws-title {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
  }

  .ws-message {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    width: 100%;
  }

  input,
  textarea {
    padding: 0.25rem 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.input.bg};
    color: ${(props) => props.theme.text};
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
      outline: none;
    }
  }

  textarea {
    resize: vertical;
  }

  > div:last-child {
    width: 100%;
  }
`;

export default StyledWrapper;
