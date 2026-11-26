import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-block;

  .response-status-input {
    min-width: 160px;
    max-width: 250px;
    font-weight: 500;

    &.text-ok .select-trigger-label {
      color: ${(props) => props.theme.colors.success};
    }

    &.text-warning .select-trigger-label {
      color: ${(props) => props.theme.colors.warning};
    }

    &.text-error .select-trigger-label {
      color: ${(props) => props.theme.colors.error};
    }
  }
`;

export default StyledWrapper;
