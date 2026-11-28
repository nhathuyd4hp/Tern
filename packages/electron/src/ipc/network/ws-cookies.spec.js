const mockShouldSendCookies = jest.fn();
const mockGetCookieStringForUrl = jest.fn();

jest.mock('../../store/preferences', () => ({ preferencesUtil: { shouldSendCookies: () => mockShouldSendCookies() } }));
jest.mock('../../utils/cookies', () => ({ getCookieStringForUrl: (...args) => mockGetCookieStringForUrl(...args) }));

const { addCookiesToWsRequest } = require('./ws-cookies');

describe('addCookiesToWsRequest', () => {
  beforeEach(() => {
    mockShouldSendCookies.mockReturnValue(true);
    mockGetCookieStringForUrl.mockReturnValue('session=abc; theme=dark');
  });

  it('puts the cookies of the jar on the request, asking the jar about the https form of a wss url', () => {
    const request = addCookiesToWsRequest({ url: 'wss://api.example.com/ws', headers: {} });

    expect(request.headers.Cookie).toBe('session=abc; theme=dark');
    expect(mockGetCookieStringForUrl).toHaveBeenCalledWith('https://api.example.com/ws');
  });

  it('asks the jar about http for a ws url', () => {
    addCookiesToWsRequest({ url: 'ws://localhost:8000/ws', headers: {} });

    expect(mockGetCookieStringForUrl).toHaveBeenCalledWith('http://localhost:8000/ws');
  });

  it('keeps a cookie set on the request, the jar winning when both have the name', () => {
    const request = addCookiesToWsRequest({ url: 'wss://a.com/ws', headers: { cookie: 'session=old; extra=1' } });

    expect(request.headers.cookie).toBe('session=abc; extra=1; theme=dark');
    expect(request.headers.Cookie).toBeUndefined();
  });

  it('sends nothing when the app is set not to send cookies, or the jar has none', () => {
    mockShouldSendCookies.mockReturnValue(false);
    expect(addCookiesToWsRequest({ url: 'wss://a.com/ws', headers: {} }).headers).toEqual({});

    mockShouldSendCookies.mockReturnValue(true);
    mockGetCookieStringForUrl.mockReturnValue('');
    expect(addCookiesToWsRequest({ url: 'wss://a.com/ws', headers: {} }).headers).toEqual({});
  });
});
