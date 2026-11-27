import styled from 'styled-components';

const StyledWrapper = styled.div`
  .summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    margin-bottom: 0.75rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};

    .summary-count {
      margin-right: 0.25rem;
      font-size: ${(props) => props.theme.font.size.lg};
      font-weight: 600;
      color: ${(props) => props.theme.text};
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
    grid-template-columns: minmax(0, 1fr) 5rem 6rem;
    align-items: center;
    column-gap: 1rem;
    width: 100%;
    padding: 0.5rem 1rem;
    text-align: left;
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
