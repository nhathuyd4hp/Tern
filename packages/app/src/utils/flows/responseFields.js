// The fields a request answers with, read from the success example of the request (an example comes with the
// OpenAPI spec the application was made from), so a value can be picked instead of an expression being typed.

const MAX_FIELDS = 80;
const MAX_DEPTH = 5;
const SAMPLE_LENGTH = 30;

const isIdentifier = (key) => /^[A-Za-z_$][\w$]*$/.test(key);

const sampleOf = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > SAMPLE_LENGTH ? `${text.slice(0, SAMPLE_LENGTH)}…` : text;
};

// 'token' for res.body.data.token, 'id' for res.body.items[0].id; always a usable variable name.
export const suggestVariableName = (segments) => {
  const last = [...segments].reverse().find((segment) => typeof segment === 'string') || 'value';
  const name = last.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(name) ? `_${name}` : name;
};

const successExample = (item) => (item?.examples || []).find((example) => {
  const status = Number(example?.response?.status);
  return status >= 200 && status < 300;
});

/** [{ expression: 'res.body.data.token', label: 'data.token', sample: 'abc…', name: 'token' }] */
export const getResponseFields = (item) => {
  const body = successExample(item)?.response?.body;
  if (body?.type !== 'json' || typeof body.content !== 'string') return [];

  let parsed;
  try {
    parsed = JSON.parse(body.content);
  } catch {
    return [];
  }

  const fields = [];
  const walk = (value, segments) => {
    if (fields.length >= MAX_FIELDS) return;
    if (value !== null && typeof value === 'object' && segments.length < MAX_DEPTH) {
      if (Array.isArray(value)) {
        if (value.length) walk(value[0], [...segments, 0]);
      } else {
        Object.entries(value).forEach(([key, inner]) => walk(inner, [...segments, key]));
      }
      return;
    }
    if (!segments.length || (value !== null && typeof value === 'object')) return;

    const path = segments.map((segment) => (typeof segment === 'number' ? `[${segment}]` : isIdentifier(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`)).join('');
    fields.push({
      expression: `res.body${path}`,
      label: path.replace(/^\./, ''),
      sample: sampleOf(value),
      name: suggestVariableName(segments)
    });
  };

  walk(parsed, []);
  return fields;
};
