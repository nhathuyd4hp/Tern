import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`


  .icon-box {
    &.location {
      background-color: ${(props) => rgba(props.theme.textLink, 0.08)};
      border: 1px solid ${(props) => rgba(props.theme.textLink, 0.09)};

      svg {
        color: ${(props) => props.theme.textLink};
      }
    }

    &.environments {
      background-color: ${(props) => rgba(props.theme.colors.text.green, 0.08)};
      border: 1px solid ${(props) => rgba(props.theme.colors.text.green, 0.09)};

      svg {
        color: ${(props) => props.theme.colors.text.green};
      }
    }

    &.requests {
      background-color: ${(props) => rgba(props.theme.colors.text.purple, 0.08)};
      border: 1px solid ${(props) => rgba(props.theme.colors.text.purple, 0.09)};

      svg {
        color: ${(props) => props.theme.colors.text.purple};
      }
    }


  }
`;

export default StyledWrapper;
