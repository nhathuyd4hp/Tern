import styled from 'styled-components';

const StyledWrapper = styled.div`
  .response-summary {
    margin-bottom: 0.375rem;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
  }

  .response-headers {
    margin-bottom: 0.375rem;
    font-size: ${(props) => props.theme.font.size.sm};

    summary {
      cursor: pointer;
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .response-header {
    display: flex;
    gap: 0.5rem;
    padding: 0.125rem 0;
    font-family: monospace;
    font-size: 11px;
  }

  .response-header-name {
    flex: 0 0 9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .response-header-value {
    min-width: 0;
    word-break: break-all;
  }

  .response-body {
    max-height: 18rem;
    margin: 0;
    padding: 0.5rem;
    overflow: auto;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.input.bg};
    font-family: monospace;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export default StyledWrapper;
