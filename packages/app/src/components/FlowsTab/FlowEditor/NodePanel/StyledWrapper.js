import styled from 'styled-components';

const StyledWrapper = styled.div`
  flex: 0 1 340px;
  min-width: 260px;
  max-height: 100%;
  padding: 0.75rem;
  overflow-y: auto;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};

  .panel-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .panel-request {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .panel-hint {
    margin: 0.5rem 0;
    font-size: ${(props) => props.theme.font.size.sm};
    line-height: 1.5;
    color: ${(props) => props.theme.colors.text.muted};

    code {
      font-family: monospace;
    }
  }

  .panel-section {
    margin-top: 0.75rem;
  }

  .panel-subtitle {
    margin-bottom: 0.375rem;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
  }

  .input-row,
  .extraction-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .input-name {
    flex: 0 0 7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .input-row input,
  .extraction-name,
  .extraction-expression,
  .body-input {
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

  .input-row input {
    flex: 1;
    min-width: 0;
  }

  .body-input {
    width: 100%;
    resize: vertical;
  }

  .extraction-name {
    width: 6rem;
  }

  .extraction-expression,
  .extraction-picker {
    flex: 1;
    min-width: 0;
  }

  .extraction-row {
    flex-wrap: wrap;
  }

  .extraction-equals,
  .extraction-value {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .extraction-value {
    flex-basis: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
`;

export default StyledWrapper;
