import styled from 'styled-components';
import { paneIn } from '../../paneIn';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 140px;
  overflow: hidden;
  padding: 0.75rem;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};
  ${paneIn}

  .palette-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
  }

  .palette-filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .palette-collection {
    margin-bottom: 0.5rem;
  }

  .palette-search {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.input.bg};
    color: ${(props) => props.theme.colors.text.muted};

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      color: ${(props) => props.theme.text};
      font-size: ${(props) => props.theme.font.size.sm};

      &:focus {
        outline: none;
      }
    }
  }

  .palette-list {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 0.125rem;
    min-height: 6rem;
    overflow-y: auto;
  }

  .palette-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: ${(props) => props.theme.border.radius.sm};
    cursor: grab;

    &.selected {
      background: ${(props) => props.theme.background.mantle};
    }

    &.dragging {
      opacity: 0.4;
    }
  }

  .palette-add {
    display: inline-flex;
    flex-shrink: 0;
    padding: 0.25rem;
    border: none;
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: transparent;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;

    &:hover:not(:disabled) {
      color: ${(props) => props.theme.accents.primary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  /* opens under the row that was clicked: name, kind, method with url, and a wide button to add it */
  .palette-details {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.125rem 0 0.5rem 0.75rem;
    padding: 0.625rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.mantle};

    /* the kind of request sits on the row of the name, so every kind takes the same number of rows */
    .details-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .details-name {
      min-width: 0;
      font-size: ${(props) => props.theme.font.size.sm};
      font-weight: 600;
      word-break: break-word;
    }

    .details-type {
      flex-shrink: 0;
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${(props) => props.theme.colors.text.muted};
    }

    .details-url {
      display: flex;
      align-items: baseline;
      gap: 0.375rem;
      margin: 0.125rem 0 0.375rem;
      font-family: monospace;
      font-size: 11px;

      span {
        min-width: 0;
        word-break: break-all;
      }
    }

    button {
      width: 100%;
      justify-content: center;
    }
  }

  .palette-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    padding: 0.3rem 0.375rem;
    border: none;
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: transparent;
    color: ${(props) => props.theme.text};
    text-align: left;
    cursor: inherit;

    &:hover:not(:disabled) {
      background: ${(props) => props.theme.background.mantle};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &.dragging {
      opacity: 0.4;
    }
  }

  .palette-path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .palette-empty {
    padding: 0.5rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
