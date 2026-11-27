import styled from 'styled-components';

const StyledWrapper = styled.div`
  min-width: 140px;
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};

  .palette-title {
    margin-bottom: 0.5rem;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
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

  .palette-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.3rem 0.375rem;
    border: none;
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: transparent;
    color: ${(props) => props.theme.text};
    text-align: left;
    cursor: grab;

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
