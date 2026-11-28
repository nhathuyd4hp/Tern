import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .flow-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
  }

  /* the name on the left; on the right what is done with the flow: its time limit, delete, and run */
  .flow-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .flow-timeout {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .flow-history {
    width: 11rem;
  }

  .flow-divider {
    align-self: stretch;
    width: 1px;
    margin: 0.125rem 0.25rem;
    background: ${(props) => props.theme.input.border};
  }

  .flow-name {
    flex: 1 1 12rem;
    min-width: 0;
    padding: 0.25rem 0.5rem;
    border: 1px solid transparent;
    border-radius: ${(props) => props.theme.border.radius.md};
    background: transparent;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.lg};
    font-weight: 600;

    &:hover,
    &:focus {
      border-color: ${(props) => props.theme.input.border};
      outline: none;
    }
  }

  .flow-hint {
    margin: 0.5rem 0 0.75rem;
    font-size: ${(props) => props.theme.font.size.sm};
    line-height: 1.5;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .flow-summary {
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: ${(props) => props.theme.border.radius.md};
    font-size: ${(props) => props.theme.font.size.sm};

    &.passed {
      color: ${(props) => props.theme.colors.text.green};
      background: ${(props) => rgba(props.theme.colors.text.green, 0.1)};
    }

    &.failed {
      color: ${(props) => props.theme.colors.text.danger};
      background: ${(props) => rgba(props.theme.colors.text.danger, 0.1)};
    }

    &.stopped {
      color: ${(props) => props.theme.colors.text.muted};
      background: ${(props) => rgba(props.theme.colors.text.muted, 0.1)};
    }
  }

  /* one row of fixed height: the lists scroll inside their own column instead of making the page longer (a wrapping row would grow with its tallest list) */
  .flow-body {
    display: flex;
    gap: 0.75rem;
    height: max(420px, calc(100vh - 240px));

    > * {
      min-height: 0;
    }
  }
`;

export default StyledWrapper;
