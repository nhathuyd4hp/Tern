import { parseRequest, stringifyRequest } from './index';
import { DEFAULT_MAX_REDIRECTS } from '@tern/common/utils';

const requestWithMaxRedirects = (maxRedirects: number) => ({
  uid: 'req-uid',
  name: 'Get Users',
  type: 'http-request',
  seq: 1,
  request: {
    url: 'https://restcountries.com/v2/alpha/in',
    method: 'GET',
    headers: [],
    params: [],
    body: { mode: 'none' },
    auth: { mode: 'none' },
    script: {},
    vars: {},
    assertions: [],
    tests: ''
  },
  settings: { maxRedirects }
});

// Serializes with Bruno's own writer and reads back, covering the write side too.
const roundTripRequest = (maxRedirects: number) =>
  parseRequest(stringifyRequest(requestWithMaxRedirects(maxRedirects) as any))
    .settings.maxRedirects;

const handEditedDocument = (rawValue: string) => `info:
  name: Get Users
  type: http
  seq: 1

http:
  method: GET
  url: https://restcountries.com/v2/alpha/in

settings:
  maxRedirects: ${rawValue}
`;

// Parses a document stated byte-for-byte, for values Bruno's writer would never produce
// (.inf, blank, quoted). Returns what the parser stored, so assertions can distinguish a
// dropped value from one the parser replaced with the default.
const parseHandEditedValue = (rawValue: string) =>
  parseRequest(handEditedDocument(rawValue)).settings.maxRedirects;

describe('maxRedirects on-disk round trip', () => {
  // An unusable value is stored as the default.
  const storedWhenUnusable = DEFAULT_MAX_REDIRECTS;

  it.each([0, 5, 50, 51, 1000, Number.MAX_SAFE_INTEGER])(
    'preserves a maxRedirects of %p',
    (maxRedirects) => {
      expect(roundTripRequest(maxRedirects)).toBe(maxRedirects);
    }
  );

  // parseInt stops at the exponent, so a ceiling Bruno writes as 1e+31 reads back as 1.
  it.each([1e21, 1e31, 9.999999999998865e21])(
    'preserves an exponentially serialized maxRedirects of %p',
    (maxRedirects) => {
      expect(roundTripRequest(maxRedirects)).toBe(maxRedirects);
    }
  );

  // Files written before any change to the writer's number formatting keep these exact bytes,
  // so the literal exponent form must parse regardless of what the writer emits today.
  it.each([
    ['1e+21', 1e21],
    ['9.999999999998865e+21', 9.999999999998865e21]
  ])('reads an on-disk exponent literal %s in full', (rawValue, expected) => {
    expect(parseHandEditedValue(rawValue)).toBe(expected);
  });

  it.each(['1e309', '-1e309', '1' + '0'.repeat(400)])(
    'does not store an on-disk %s that overflows to a non-finite number',
    (rawValue) => {
      expect(parseHandEditedValue(rawValue)).toBe(storedWhenUnusable);
    }
  );

  it('clamps an on-disk value beyond MAX_SAFE_INTEGER to the nearest representable integer', () => {
    expect(parseHandEditedValue('9007199254740993')).toBe(9007199254740992);
  });

  it.each(['', ' ', '   '])('does not store a blank on-disk value %p', (rawValue) => {
    expect(parseHandEditedValue(rawValue)).toBe(storedWhenUnusable);
  });

  it.each(['-1', '-3', '-0.5'])('does not store a negative on-disk value of %s', (rawValue) => {
    expect(parseHandEditedValue(rawValue)).toBe(storedWhenUnusable);
  });

  it('stores the default for an unparseable value', () => {
    expect(parseHandEditedValue('abc')).toBe(DEFAULT_MAX_REDIRECTS);
  });

  it('truncates a fractional maxRedirects', () => {
    expect(roundTripRequest(3.5)).toBe(3);
  });

  it.each(['.inf', '-.inf', '.nan'])('replaces a hand-edited maxRedirects of %s with the default', (rawValue) => {
    expect(parseHandEditedValue(rawValue)).toBe(DEFAULT_MAX_REDIRECTS);
  });

  it('does not honour a quoted count, but reads a plain count', () => {
    expect(parseHandEditedValue('"10"')).toBe(DEFAULT_MAX_REDIRECTS);
    expect(parseHandEditedValue('10')).toBe(10);
  });
});
