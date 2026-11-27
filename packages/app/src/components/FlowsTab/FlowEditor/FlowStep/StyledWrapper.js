import styled from 'styled-components';

const StyledWrapper = styled.div`
  padding: 0.75rem;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};

  &.failed {
    border-color: ${(props) => props.theme.colors.text.danger};
  }

  &.passed {
    border-color: ${(props) => props.theme.colors.text.green};
  }

  &.skipped {
    opacity: 0.6;
  }

  &.dragging {
    opacity: 0.4;
  }

  &.drop-target {
    border-color: ${(props) => props.theme.accents.primary};
    box-shadow: 0 -2px 0 ${(props) => props.theme.accents.primary};
  }

  .step-grip {
    display: inline-flex;
    flex-shrink: 0;
    margin-right: -0.5rem;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: grab;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  }

  .extraction-picker {
    flex: 1;
    min-width: 0;
  }

  .step-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .step-number {
    flex-shrink: 0;
    width: 1.25rem;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .step-request {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};

    &.missing {
      color: ${(props) => props.theme.colors.text.danger};
    }
  }

  .result {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: ${(props) => props.theme.font.size.sm};

    &.passed {
      color: ${(props) => props.theme.colors.text.green};
    }

    &.failed {
      color: ${(props) => props.theme.colors.text.danger};
    }

    &.running,
    &.skipped {
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .step-actions {
    display: flex;
    gap: 0.125rem;
  }

  .step-error {
    margin: 0.5rem 0 0 2rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.danger};
  }

  .step-extractions {
    margin: 0.5rem 0 0 2rem;
  }

  .extraction-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .extraction-name,
  .extraction-expression {
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

  .extraction-name {
    width: 9rem;
  }

  .extraction-expression {
    flex: 1;
    min-width: 0;
  }

  .extraction-equals,
  .extraction-value {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .extraction-value {
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
`;

export default StyledWrapper;
