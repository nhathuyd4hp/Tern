import styled from 'styled-components';

const StyledWrapper = styled.div`
  .lead {
    margin: 0 0 0.75rem;
    font-size: ${(props) => props.theme.font.size.sm};
    line-height: 1.5;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .choice {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: transparent;
    color: ${(props) => props.theme.text};
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
      background: ${(props) => props.theme.background.mantle};
    }

    .choice-title {
      font-size: ${(props) => props.theme.font.size.base};
      font-weight: 600;
    }

    .choice-detail {
      font-size: ${(props) => props.theme.font.size.sm};
      color: ${(props) => props.theme.colors.text.muted};
    }
  }
`;

export default StyledWrapper;
