import styled from 'styled-components';

const StyledWrapper = styled.div`
  flex: 1 1 0%;
  min-height: 0;

  .overview-layout {
    display: flex;
    height: 100%;
  }

  .overview-main {
    flex: 1;
    padding: 20px 16px 16px;
    overflow-y: auto;
  }

  .home-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .home-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: ${(props) => props.theme.text};
  }

  .home-summary {
    margin-top: 4px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .home-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .view-toggle {
    display: flex;
    margin-right: 4px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 6px;
    overflow: hidden;

    button {
      display: flex;
      align-items: center;
      padding: 5px 8px;
      border: none;
      background: transparent;
      color: ${(props) => props.theme.colors.text.muted};
      cursor: pointer;

      &:hover {
        color: ${(props) => props.theme.text};
      }

      &.active {
        background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
        color: ${(props) => props.theme.text};
      }
    }
  }

  .collections-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
`;

export default StyledWrapper;
