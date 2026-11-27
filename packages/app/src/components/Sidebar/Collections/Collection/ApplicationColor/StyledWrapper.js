import styled from 'styled-components';

const StyledWrapper = styled.div`
  .description {
    margin: 0 0 1rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
`;

export default StyledWrapper;
