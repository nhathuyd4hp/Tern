import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  flex: 1;
  overflow-y: auto;

  .collections-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    text-align: center;
  }

  .empty-icon {
    color: ${(props) => props.theme.colors.text.muted};
    margin-bottom: 12px;
  }

  .empty-title {
    font-size: ${(props) => props.theme.font.size.md};
    font-weight: 500;
    color: ${(props) => props.theme.text};
    margin-bottom: 6px;
  }

  .empty-description {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .collection-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 8px;
    background: ${(props) => props.theme.background.default};
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;

    &:hover {
      border-color: ${(props) => props.theme.brand};
      background: ${(props) => rgba(props.theme.brand, 0.04)};
    }
  }

  .applications-table {
    width: 100%;
    border-collapse: collapse;
    font-size: ${(props) => props.theme.font.size.sm};

    th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 500;
      color: ${(props) => props.theme.colors.text.muted};
      border-bottom: 1px solid ${(props) => props.theme.border.border1};
    }

    td {
      padding: 10px 12px;
      vertical-align: middle;
      color: ${(props) => props.theme.text};
      border-bottom: 1px solid ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }

    tbody tr {
      cursor: pointer;

      &:hover {
        background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      }
    }

    .stat-chip {
      margin-right: 6px;
    }

    .menu-cell {
      width: 1%;
      text-align: right;
    }
  }

  .application-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .stat-chip {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.subtext0};
    background: ${(props) => props.theme.sidebar.collection.item.hoverBg};

    &.protocol {
      color: ${(props) => props.theme.text};
    }

    &.synced {
      color: ${(props) => props.theme.colors.text.green};
      background: ${(props) => rgba(props.theme.colors.text.green, 0.1)};
    }
  }

  .collection-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .collection-info {
    flex: 1;
    min-width: 0;
  }

  .collection-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 1px;
  }

  .collection-name {
    font-size: ${(props) => props.theme.font.size.base};
    color: ${(props) => props.theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .collection-path {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .collection-menu {
    flex-shrink: 0;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;

    &:hover {
      color: ${(props) => props.theme.text};
    }
  }

  .collection-dropdown {
    min-width: 120px;
  }
`;

export default StyledWrapper;
