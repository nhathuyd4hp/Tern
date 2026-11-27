import styled from 'styled-components';
import { rgba } from 'utils/color';

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

  .panel-error {
    margin-bottom: 0.375rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.danger};
    word-break: break-word;
  }

  .share-table {
    margin-bottom: 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
  }

  .share-row {
    display: grid;
    grid-template-columns: minmax(5.5rem, 1fr) minmax(7rem, 1.6fr) minmax(5rem, 1fr);
    align-items: center;
    column-gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .share-head {
    background: ${(props) => props.theme.background.mantle};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .share-row.readonly {
    background: ${(props) => rgba(props.theme.colors.text.muted, 0.06)};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .share-name {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    font-family: monospace;
    font-weight: 600;
  }

  .share-value,
  .share-from {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: 11px;
  }

  .share-from.own {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    font-family: inherit;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .share-last {
    padding: 0 0.5rem 0.25rem;
    font-family: monospace;
    font-size: 10px;
    color: ${(props) => props.theme.colors.text.muted};
    border-bottom: 1px solid ${(props) => props.theme.input.border};
  }

  .panel-subtitle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.375rem;

    .panel-subtitle {
      margin-bottom: 0;
    }
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
    width: 100%;
    min-width: 0;
  }

  .extraction-expression,
  .extraction-picker {
    width: 100%;
    min-width: 0;
  }

  .extraction-row {
    flex-wrap: wrap;
  }

  .extraction-name.invalid {
    border-color: ${(props) => props.theme.colors.text.danger};
  }

  .extraction-error {
    margin: 0.25rem 0 0.5rem;
    padding: 0 0.5rem;
    font-size: 11px;
    color: ${(props) => props.theme.colors.text.danger};
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
