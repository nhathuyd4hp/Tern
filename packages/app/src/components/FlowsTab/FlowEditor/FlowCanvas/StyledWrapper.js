import styled from 'styled-components';

const StyledWrapper = styled.div`
  flex: 1 1 360px;
  min-width: 280px;
  min-height: 420px;
  height: 100%;
  border: 1px solid ${(props) => props.theme.input.border};
  border-radius: ${(props) => props.theme.border.radius.md};
  overflow: hidden;

  .react-flow {
    --xy-background-color: ${(props) => props.theme.background.mantle};
    --xy-background-pattern-color: ${(props) => props.theme.input.border};
    --xy-edge-stroke: ${(props) => props.theme.colors.text.muted};
    --xy-edge-stroke-selected: ${(props) => props.theme.accents.primary};
    --xy-controls-button-background-color: ${(props) => props.theme.background.base};
    --xy-controls-button-background-color-hover: ${(props) => props.theme.background.surface0};
    --xy-controls-button-color: ${(props) => props.theme.text};
    --xy-controls-button-border-color: ${(props) => props.theme.input.border};
    --xy-attribution-background-color: transparent;
  }
`;

export default StyledWrapper;
