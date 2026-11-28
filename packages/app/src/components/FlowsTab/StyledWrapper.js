import styled from 'styled-components';
import { rgba } from 'utils/color';
import { paneIn } from './paneIn';

const StyledWrapper = styled.div`
  .flow-list {
    flex: 0 0 240px;
    padding: 0.75rem;
    border-right: 1px solid ${(props) => props.theme.input.border};
    overflow-y: auto;
    ${paneIn}
  }

  .flow-list-header {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .flow-list-title {
    margin-right: auto;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
  }

  .flow-list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: none;
    border-radius: ${(props) => props.theme.border.radius.md};
    background: transparent;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    text-align: left;
    cursor: pointer;

    &:hover {
      background: ${(props) => props.theme.background.mantle};
    }

    &.selected {
      background: ${(props) => rgba(props.theme.accents.primary, 0.1)};
    }
  }

  .flow-list-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flow-list-count {
    color: ${(props) => props.theme.colors.text.muted};
  }

  .flow-detail {
    flex: 1;
    min-width: 0;
    padding: 1rem 1.25rem;
    overflow-y: auto;
  }

  .flow-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    max-width: 420px;
    margin: 4rem auto 0;
    text-align: center;
    color: ${(props) => props.theme.colors.text.muted};

    h4 {
      margin: 0;
      color: ${(props) => props.theme.text};
    }

    p {
      margin: 0 0 0.75rem;
      font-size: ${(props) => props.theme.font.size.sm};
      line-height: 1.5;
    }
  }
`;

export default StyledWrapper;
