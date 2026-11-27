import StyledWrapper from './StyledWrapper';

const MAX_BODY_CHARS = 20000;

const headerEntries = (headers) => {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers.map((header) => (Array.isArray(header) ? header : [header.name, header.value]));
  return Object.entries(headers);
};

const formatBody = (data) => {
  if (data === undefined || data === null || data === '') return '';
  let text;
  if (typeof data === 'string') {
    try {
      text = JSON.stringify(JSON.parse(data), null, 2);
    } catch {
      text = data;
    }
  } else {
    text = JSON.stringify(data, null, 2);
  }
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}\n… (shortened)` : text;
};

const formatSize = (bytes) => (typeof bytes === 'number' ? (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`) : null);

// The answer a request of the flow got in the last run: status, headers and body.
const ResponseView = ({ response }) => {
  const headers = headerEntries(response.headers);
  const body = formatBody(response.data);
  const summary = [response.status && `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`, response.duration != null && `${response.duration} ms`, formatSize(response.size)].filter(Boolean).join(' · ');

  return (
    <StyledWrapper data-testid="node-response">
      <div className="response-summary">{summary}</div>
      {headers.length > 0 && (
        <details className="response-headers">
          <summary>Headers ({headers.length})</summary>
          {headers.map(([name, value]) => (
            <div className="response-header" key={name}>
              <span className="response-header-name">{name}</span>
              <span className="response-header-value">{String(value)}</span>
            </div>
          ))}
        </details>
      )}
      <pre className="response-body" aria-label="Response body">{body || 'No body'}</pre>
    </StyledWrapper>
  );
};

export default ResponseView;
