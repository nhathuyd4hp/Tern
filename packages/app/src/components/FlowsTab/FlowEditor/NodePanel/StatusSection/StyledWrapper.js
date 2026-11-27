import styled from 'styled-components';
import { rgba } from 'utils/color';

const kindColor = (theme, kind) => ({
  ok: theme.colors.text.green,
  redirect: theme.colors.text.warning,
  error: theme.colors.text.danger,
  other: theme.colors.text.muted
}[kind]);

const StyledWrapper = styled.div`
  .status-hint {
    margin: 0 0 0.5rem;
    font-size: ${(props) => props.theme.font.size.sm};
    line-height: 1.4;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .status-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0 0 0.75rem;
    padding: 0;
    list-style: none;
  }

  .status-row {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 0.5rem;
    min-height: 28px;
    padding: 0.25rem 0.5rem;
    border-left: 3px solid transparent;
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.sm};

    .status-code {
      font-family: monospace;
      font-weight: 600;
    }

    .status-phrase {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${(props) => props.theme.colors.text.muted};
    }

    .status-origin {
      font-size: 10px;
      color: ${(props) => props.theme.colors.text.muted};
    }

    ${(props) => ['ok', 'redirect', 'error', 'other'].map((kind) => `
      &.${kind} {
        border-left-color: ${kindColor(props.theme, kind)};
        ${kind === 'other' ? '' : `background: ${rgba(kindColor(props.theme, kind), 0.1)};`}
      }
      &.${kind} .status-code {
        color: ${kindColor(props.theme, kind)};
      }
    `).join('')}
  }

  .status-remove {
    display: inline-flex;
    padding: 2px;
    border: none;
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: transparent;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;

    &:hover:not(:disabled) {
      color: ${(props) => props.theme.colors.text.danger};
      background: ${(props) => rgba(props.theme.colors.text.danger, 0.1)};
    }
  }

  .status-add {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-add-label {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
  }

  .status-quick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .status-quick-item {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem 0.5rem;
    border: 1px dashed ${(props) => props.theme.input.border};
    border-radius: 999px;
    background: transparent;
    font-family: monospace;
    font-size: 11px;
    color: ${(props) => props.theme.colors.text.subtext0};
    cursor: pointer;

    &:hover:not(:disabled) {
      border-style: solid;
    }

    ${(props) => ['ok', 'redirect', 'error'].map((kind) => `
      &.${kind}:hover:not(:disabled) {
        border-color: ${kindColor(props.theme, kind)};
        color: ${kindColor(props.theme, kind)};
      }
    `).join('')}

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .status-custom {
    display: flex;
    gap: 0.5rem;
  }

  .status-input {
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.input.bg};
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
      outline: none;
    }
  }

  .status-custom-add {
    flex: 0 0 auto;
    padding: 0.375rem 0.875rem;
    border: 1px solid ${(props) => props.theme.accents.primary};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => rgba(props.theme.accents.primary, 0.1)};
    color: ${(props) => props.theme.accents.primary};
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    cursor: pointer;

    &:disabled {
      border-color: ${(props) => props.theme.input.border};
      background: transparent;
      color: ${(props) => props.theme.colors.text.muted};
      cursor: not-allowed;
    }
  }
`;

export default StyledWrapper;
