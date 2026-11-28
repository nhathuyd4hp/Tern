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

  .response-messages {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-bottom: 0.5rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
  }

  .messages-title {
    font-size: 11px;
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .message-line {
    display: flex;
    gap: 0.5rem;
    font-family: monospace;
    font-size: 11px;

    .message-arrow {
      flex: 0 0 auto;
      font-weight: 700;
    }

    .message-time {
      flex: 0 0 auto;
      color: ${(props) => props.theme.colors.text.muted};
    }

    .message-text {
      min-width: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }

    &.sent .message-arrow {
      color: ${(props) => props.theme.accents.primary};
    }

    &.received .message-arrow {
      color: ${(props) => props.theme.colors.text.green};
    }
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
