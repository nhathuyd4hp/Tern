import styled from 'styled-components';
import { paneIn } from '../paneIn';

const StyledWrapper = styled.button`
  display: flex;
  flex: 0 0 28px;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border: none;
  border-right: 1px solid ${(props) => props.theme.input.border};
  background: transparent;
  color: ${(props) => props.theme.colors.text.muted};
  cursor: pointer;
  ${paneIn}

  &:hover {
    background: ${(props) => props.theme.background.mantle};
    color: ${(props) => props.theme.text};
  }

  .rail-label {
    writing-mode: vertical-rl;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
  }
`;

export default StyledWrapper;
