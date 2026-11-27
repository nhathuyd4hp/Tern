import styled from 'styled-components';

const StyledWrapper = styled.div`
  .location-browse {
    display: flex;
    flex-shrink: 0;

    button {
      height: 100%;
      padding: 0 1rem;
    }
  }

  .application-source {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface0};
  }

  .report-issue-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.textLink};
    cursor: pointer;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    svg {
      flex-shrink: 0;
    }
  }
`;

export default StyledWrapper;
