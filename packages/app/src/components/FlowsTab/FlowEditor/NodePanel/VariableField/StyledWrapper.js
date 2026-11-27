import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;

  input,
  textarea {
    width: 100%;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 20;
    min-width: 14rem;
    max-width: 100%;
    max-height: 10rem;
    margin: 2px 0 0;
    padding: 0.25rem;
    overflow-y: auto;
    list-style: none;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.base};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.sm};
    cursor: pointer;

    &.active,
    &:hover {
      background: ${(props) => rgba(props.theme.accents.primary, 0.12)};
    }
  }

  .suggestion-name {
    flex-shrink: 0;
    font-family: monospace;
    font-weight: 600;
  }

  .suggestion-source,
  .suggestion-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: 11px;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .suggestion-value {
    margin-left: auto;
  }
`;

export default StyledWrapper;
