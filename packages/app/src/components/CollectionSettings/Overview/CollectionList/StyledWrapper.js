import styled from 'styled-components';

const StyledWrapper = styled.div`
  .summary-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};

    .summary-item {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      padding: 0.75rem 1rem;
      border: 1px solid ${(props) => props.theme.input.border};
      border-radius: ${(props) => props.theme.border.radius.md};
    }

    .summary-item svg {
      align-self: center;
      flex-shrink: 0;
      margin-right: 0.25rem;
    }

    .icon-requests {
      color: ${(props) => props.theme.accents.primary};
    }

    .icon-flows {
      color: ${(props) => props.theme.colors.text.green};
    }

    .summary-count {
      font-size: ${(props) => props.theme.font.size.lg};
      font-weight: 600;
      color: ${(props) => props.theme.text};
    }
  }

  .summary-row .summary-link {
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  .collection-table {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    overflow: hidden;
  }

  .collection-head,
  .collection-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    column-gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0;
    text-align: left;

    > * {
      padding: 0 1rem;
    }
  }

  .collection-head {
    background: ${(props) => props.theme.background.mantle};
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .collection-row {
    background: transparent;
    border: none;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    cursor: pointer;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: ${(props) => props.theme.background.mantle};
    }

    .collection-name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .collection-icon {
      flex-shrink: 0;
    }

    .name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sync-cell {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: ${(props) => props.theme.colors.text.green};
    }
  }

  .empty {
    padding: 1rem;
    border: 1px dashed ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
