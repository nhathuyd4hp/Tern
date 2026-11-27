import styled from 'styled-components';

const StyledWrapper = styled.div`
  .collection-switcher {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-actions {
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    > * {
      flex-shrink: 0;
    }
  }

  .switcher-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: ${(props) => props.theme.text};
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.15s ease;

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }

    .switcher-name {
      white-space: nowrap;

      &.scratch-collection {
        font-weight: 600;
        font-size: 15px;
      }
    }

    .tab-count {
      font-size: 11px;
      font-weight: 500;
      padding: 1px 6px;
      border-radius: 10px;
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      min-width: 18px;
      text-align: center;
    }

    .chevron {
      opacity: 0.6;
      flex-shrink: 0;
    }
  }

  .display-icon{
    padding: 4px;
    box-sizing: content-box;
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      border-radius: ${(props) => props.theme.border.radius.sm}
    }
  }
`;

export default StyledWrapper;
