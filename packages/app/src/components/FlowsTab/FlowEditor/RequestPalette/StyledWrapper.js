import styled from 'styled-components';

const StyledWrapper = styled.div`
  min-width: 140px;
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};

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
    gap: 0.125rem;
    max-height: 60vh;
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

  .palette-details {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    font-size: 11px;

    .details-name {
      font-size: ${(props) => props.theme.font.size.sm};
      font-weight: 600;
    }

    dl {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.125rem 0.5rem;
      margin: 0;
      width: 100%;
    }

    dt {
      color: ${(props) => props.theme.colors.text.muted};
    }

    dd {
      margin: 0;
      word-break: break-all;
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
