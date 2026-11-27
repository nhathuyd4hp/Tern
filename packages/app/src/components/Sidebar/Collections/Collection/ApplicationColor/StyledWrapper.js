import styled from 'styled-components';

const StyledWrapper = styled.div`
  .description {
    margin: 0 0 1rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 0.5rem;
    justify-items: center;
  }

  .swatch {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    transition: transform 0.12s ease;

    &:hover {
      transform: scale(1.08);
    }

    &.selected {
      border-color: ${(props) => props.theme.text};
    }
  }

  .custom-color {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};

    input {
      width: 40px;
      height: 28px;
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
    }
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
`;

export default StyledWrapper;
