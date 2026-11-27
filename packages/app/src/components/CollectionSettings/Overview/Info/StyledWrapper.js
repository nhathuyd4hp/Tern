import styled from 'styled-components';

// Looks like the table of collections under it: a bordered box, a small uppercase head, rows split by thin lines.
const StyledWrapper = styled.div`
  .info-box {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    overflow: hidden;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};

    th,
    td {
      padding: 0.5rem 1rem;
      text-align: left;
      vertical-align: top;
    }

    thead th {
      background: ${(props) => props.theme.background.mantle};
      border-bottom: 1px solid ${(props) => props.theme.input.border};
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: ${(props) => props.theme.colors.text.muted};
    }

    tbody tr {
      border-bottom: 1px solid ${(props) => props.theme.input.border};

      &:last-child {
        border-bottom: none;
      }
    }

    tbody th {
      font-weight: 400;
      color: ${(props) => props.theme.colors.text.muted};
    }

    /* the first column is as wide as the first of the three columns of the collection table above, gap included */
    th:first-child,
    td:first-child {
      width: calc((100% - 1.5rem) / 3 + 0.75rem);
    }
  }

  .info-link {
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: ${(props) => props.theme.textLink};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .info-separator {
    margin: 0 0.5rem;
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
