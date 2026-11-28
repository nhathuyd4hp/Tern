import styled from 'styled-components';
import { rgba } from 'utils/color';

const kindColor = (theme, kind) => ({
  ok: theme.colors.text.green,
  redirect: theme.colors.text.warning,
  error: theme.colors.text.danger,
  other: theme.colors.text.muted
}[kind]);

const StyledWrapper = styled.div`
  min-width: 170px;
  max-width: 220px;
  padding: 0.25rem 0;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};
  background: ${(props) => props.theme.background.base};
  color: ${(props) => props.theme.text};

  &.passed {
    border-color: ${(props) => props.theme.colors.text.green};
    background: ${(props) => rgba(props.theme.colors.text.green, 0.14)};
  }

  &.failed {
    border-color: ${(props) => props.theme.colors.text.danger};
    background: ${(props) => rgba(props.theme.colors.text.danger, 0.14)};
  }

  &.running {
    border-style: dashed;
    border-color: ${(props) => props.theme.colors.text.muted};
  }

  &.selected {
    box-shadow: 0 0 0 2px ${(props) => props.theme.accents.primary};
  }

  .node-head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0 0.5rem;
  }

  .node-method {
    flex-shrink: 0;
  }

  .node-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};

    &.missing {
      color: ${(props) => props.theme.colors.text.danger};
    }
  }

  .node-result {
    padding: 0.125rem 0.5rem 0;
    font-family: monospace;
    font-size: 10px;
    color: ${(props) => props.theme.colors.text.muted};
  }

  &.passed .node-result {
    color: ${(props) => props.theme.colors.text.green};
  }

  &.failed .node-result {
    color: ${(props) => props.theme.colors.text.danger};
  }

  .node-statuses {
    margin-top: 0.25rem;
    border-top: 1px solid ${(props) => props.theme.input.border};
  }

  .node-status {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    padding: 0.1875rem 1rem 0.1875rem 0.5rem;
    border-left: 3px solid transparent;
    font-size: ${(props) => props.theme.font.size.sm};

    .status-code {
      font-weight: 600;
    }

    .status-phrase {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10px;
      color: ${(props) => props.theme.colors.text.muted};
    }

    &.ok { border-left-color: ${(props) => kindColor(props.theme, 'ok')}; background: ${(props) => rgba(kindColor(props.theme, 'ok'), 0.1)}; }
    &.redirect { border-left-color: ${(props) => kindColor(props.theme, 'redirect')}; background: ${(props) => rgba(kindColor(props.theme, 'redirect'), 0.1)}; }
    &.error { border-left-color: ${(props) => kindColor(props.theme, 'error')}; background: ${(props) => rgba(kindColor(props.theme, 'error'), 0.1)}; }
    &.other { border-left-color: ${(props) => kindColor(props.theme, 'other')}; }

    &.ok .status-code { color: ${(props) => kindColor(props.theme, 'ok')}; }
    &.redirect .status-code { color: ${(props) => kindColor(props.theme, 'redirect')}; }
    &.error .status-code { color: ${(props) => kindColor(props.theme, 'error')}; }
    &.other .status-code { color: ${(props) => kindColor(props.theme, 'other')}; }
  }

  .react-flow__handle {
    width: 14px;
    height: 14px;
    cursor: crosshair;
  }

  .react-flow__handle-left:hover {
    transform: translate(-50%, -50%) scale(1.3);
  }

  .react-flow__handle-right:hover {
    transform: translate(50%, -50%) scale(1.3);
  }

  .status-handle {
    border: 2px solid ${(props) => props.theme.background.base};

    &.ok { background: ${(props) => kindColor(props.theme, 'ok')}; }
    &.redirect { background: ${(props) => kindColor(props.theme, 'redirect')}; }
    &.error { background: ${(props) => kindColor(props.theme, 'error')}; }
    &.other { background: ${(props) => kindColor(props.theme, 'other')}; }
  }
`;

export default StyledWrapper;
