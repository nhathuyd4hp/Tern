import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`
  .theme-mode-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .theme-mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: ${(props) => props.theme.border.radius.md};
    border: 1.5px solid ${(props) => props.theme.border.border1};
    background: transparent;
    color: ${(props) => props.theme.colors.text.subtext1};
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    transition: all 0.15s ease;

    &:hover {
      border-color: ${(props) => props.theme.border.border2};
      color: ${(props) => props.theme.text};
    }

    &.active {
      border-color: ${(props) => props.theme.primary.solid};
      background: ${(props) => rgba(props.theme.primary.solid, 0.07)};
      color: ${(props) => props.theme.text};
    }
  }
`;

export default StyledWrapper;
