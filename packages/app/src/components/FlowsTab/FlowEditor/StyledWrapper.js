import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .flow-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .flow-name {
    flex: 1;
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

  .flow-body {
    display: flex;
    flex: 1;
    gap: 0.75rem;
    min-height: 420px;
  }
`;

export default StyledWrapper;
