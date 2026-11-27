import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem 0.5rem;
  border-bottom: 1px solid ${(props) => props.theme.input.border};
  font-size: 11px;
  color: ${(props) => props.theme.colors.text.muted};

  .condition {
    width: 100%;
  }

  /* field, comparison, value and the remove button on one line, the value getting the most room */
  .condition-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr) auto;
    align-items: center;
    gap: 0.5rem;

    > * {
      min-width: 0;
    }
  }

  .condition-row input {
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

  .condition-error {
    margin-top: 0.25rem;
    color: ${(props) => props.theme.colors.text.danger};
  }
`;

export default StyledWrapper;
