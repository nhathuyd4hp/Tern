import styled from 'styled-components';

const StyledWrapper = styled.div`
  flex: 0 0 6px;
  align-self: stretch;
  margin: 0 -3px;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
  transition: background 0.15s;
  z-index: 1;

  &:hover,
  &:active {
    background: ${(props) => props.theme.accents.primary};
    opacity: 0.5;
  }
`;

export default StyledWrapper;
