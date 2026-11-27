import { getDefaultItemConditions, getResponseFields, suggestVariableName } from './responseFields';

const requestWith = (examples) => ({ examples });
const json = (status, content) => ({ response: { status, body: { type: 'json', content: JSON.stringify(content) } } });

describe('getResponseFields', () => {
  it('lists every key of the success example, an object before what is inside it, with the expression to take each one', () => {
    const fields = getResponseFields(requestWith([
      json(422, { detail: 'bad' }),
      json(200, { success: true, data: { token: 'abcdef', user: { 'id': 7, 'display-name': 'A' } }, items: [{ id: 1 }] })
    ]));

    expect(fields.map((field) => field.label)).toEqual([
      'success',
      'data',
      'data.token',
      'data.user',
      'data.user.id',
      'data.user["display-name"]',
      'items',
      'items[]',
      'items[].id'
    ]);
    expect(fields.map((field) => field.expression)).toContain('res.body.data.user["display-name"]');
    expect(fields.find((field) => field.label === 'data.token')).toMatchObject({ expression: 'res.body.data.token', sample: 'abcdef', name: 'token' });
    expect(fields.find((field) => field.label === 'data')).toMatchObject({ expression: 'res.body.data', name: 'data' });
  });

  it('shortens a long sample and ignores what it cannot read', () => {
    expect(getResponseFields(requestWith([json(200, { text: 'x'.repeat(100) })]))[0].sample.endsWith('…')).toBe(true);
    expect(getResponseFields(requestWith([json(422, { a: 1 })]))).toEqual([]);
    expect(getResponseFields(requestWith([{ response: { status: 200, body: { type: 'json', content: '{not json' } } }]))).toEqual([]);
    expect(getResponseFields(requestWith([{ response: { status: 200, body: { type: 'text', content: 'ok' } } }]))).toEqual([]);
    expect(getResponseFields({})).toEqual([]);
  });

  it('stops at a sensible number of fields', () => {
    const wide = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`f${index}`, index]));
    expect(getResponseFields(requestWith([json(200, wide)]))).toHaveLength(80);
  });
});

describe('suggestVariableName', () => {
  it('gives a usable variable name', () => {
    expect(suggestVariableName(['data', 'token'])).toBe('token');
    expect(suggestVariableName(['items', 0, 'id'])).toBe('id');
    expect(suggestVariableName(['items', 0])).toBe('items');
    expect(suggestVariableName(['display-name'])).toBe('display_name');
    expect(suggestVariableName(['1st'])).toBe('_1st');
    expect(suggestVariableName([])).toBe('value');
  });
});

describe('getDefaultItemConditions', () => {
  const fields = getResponseFields(requestWith([json(200, { data: [{ active: true, name: 'A', id: 1 }], total: 1 })]));

  it('starts a value inside a list with a condition on the name of the item, else its id, else its first field', () => {
    expect(getDefaultItemConditions(fields, 'res.body.data[0].active')).toEqual([{ field: 'name', value: '' }]);
    expect(getDefaultItemConditions(getResponseFields(requestWith([json(200, { data: [{ active: true, id: 1 }] })])), 'res.body.data[0].active')).toEqual([{ field: 'id', value: '' }]);
    expect(getDefaultItemConditions(getResponseFields(requestWith([json(200, { data: [{ active: true }] })])), 'res.body.data[0].active')).toEqual([{ field: 'active', value: '' }]);
  });

  it('leaves the whole list and values outside a list without one', () => {
    expect(getDefaultItemConditions(fields, 'res.body.data')).toBeUndefined();
    expect(getDefaultItemConditions(fields, 'res.body.total')).toBeUndefined();
  });
});
