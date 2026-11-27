import styled from 'styled-components';

const StyledWrapper = styled.div`
  .url-bar-container {
    border: 1px solid ${(props) => props.theme.examples.urlBar.border};
  }

  .url-prefix {
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
