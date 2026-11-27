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

/** The fields an item of a list has ('name', 'id'...), from the fields of the response; `list` is 'res.body.data'. */
export const getItemKeys = (fields, list) => fields
  .map((field) => (field.expression.startsWith(`${list}[0].`) ? field.expression.slice(list.length + 4) : ''))
  .filter(isIdentifier);

/** The list an expression goes into ('res.body.data' for 'res.body.data[0].id'), or undefined when it is not inside a list. */
export const getListOf = (expression) => /^(.*?)\[0\]/.exec(expression)?.[1];

/** The conditions a value inside a list starts with: an item is told by a field, 'name' or 'id' when it has one. */
export const getDefaultItemConditions = (fields, expression) => {
  const list = getListOf(expression);
  if (list === undefined) return undefined;
  const keys = getItemKeys(fields, list);
  const field = ['name', 'id'].find((key) => keys.includes(key)) || keys[0];
  return field ? [{ field, value: '' }] : undefined;
};

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
  // every key is offered, an object as well as what is inside it: 'data', then 'data.user', then 'data.user.id'
  const walk = (value, segments) => {
    if (fields.length >= MAX_FIELDS) return;
    if (segments.length) {
      const path = segments.map((segment) => (typeof segment === 'number' ? `[${segment}]` : isIdentifier(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`)).join('');
      fields.push({
        expression: `res.body${path}`,
        // a list is shown as [], its item is chosen by a condition, never by position
        label: path.replace(/^\./, '').replaceAll('[0]', '[]'),
        sample: sampleOf(value),
        name: suggestVariableName(segments)
      });
    }
    if (value === null || typeof value !== 'object' || segments.length >= MAX_DEPTH) return;
    if (Array.isArray(value)) {
      if (value.length) walk(value[0], [...segments, 0]);
    } else {
      Object.entries(value).forEach(([key, inner]) => walk(inner, [...segments, key]));
    }
  };

  walk(parsed, []);
  return fields;
};
