const { getCookieStringForUrl } = require('../../utils/cookies');
const { preferencesUtil } = require('../../store/preferences');

const parseCookies = (text) => text.split(';').reduce((cookies, cookie) => {
  const [name, ...rest] = cookie.split('=');
  if (name && name.trim()) {
    cookies[name.trim()] = rest.join('=').trim();
  }
  return cookies;
}, {});

/**
 * Puts the cookies of the cookie jar on the upgrade request of a WebSocket, as is done for an HTTP request, so a
 * session started by an earlier request (a login) is also the one of the socket. A cookie set on the request itself
 * is kept unless the jar has one of the same name. The jar is asked about the http(s) form of the url, as it knows no ws(s).
 */
const addCookiesToWsRequest = (wsRequest) => {
  if (!preferencesUtil.shouldSendCookies()) return wsRequest;

  const cookieString = getCookieStringForUrl(String(wsRequest.url).replace(/^ws(s?):/i, 'http$1:'));
  if (!cookieString || typeof cookieString !== 'string') return wsRequest;

  const existingName = Object.keys(wsRequest.headers).find((name) => name.toLowerCase() === 'cookie');
  const merged = { ...parseCookies(existingName ? wsRequest.headers[existingName] : ''), ...parseCookies(cookieString) };
  wsRequest.headers[existingName || 'Cookie'] = Object.entries(merged).map(([name, value]) => `${name}=${value}`).join('; ');
  return wsRequest;
};

module.exports = { addCookiesToWsRequest };
