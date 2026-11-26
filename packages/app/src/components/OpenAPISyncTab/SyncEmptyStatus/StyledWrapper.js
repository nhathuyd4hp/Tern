import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px 16px;
  border: 1px solid ${(props) => rgba(props.theme.colors.text.green, 0.25)};
  border-radius: 8px;
  background: ${(props) => rgba(props.theme.colors.text.green, 0.06)};

  .status-icon {
    flex-shrink: 0;
    color: ${(props) => props.theme.colors.text.green};
  }

  .status-text {
    flex: 1;
    min-width: 0;
  }

  .status-title {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    color: ${(props) => props.theme.text};
  }

  .status-description {
    margin-top: 2px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.subtext0};
  }
`;

export default StyledWrapper;
