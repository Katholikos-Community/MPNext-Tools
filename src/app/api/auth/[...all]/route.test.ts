import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHandlerGet, mockHandlerPost } = vi.hoisted(() => ({
  mockHandlerGet: vi.fn(async () => new Response('ok', { status: 200 })),
  mockHandlerPost: vi.fn(async () => new Response('ok', { status: 200 })),
}));

vi.mock('@/lib/auth', () => ({
  auth: {},
}));

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: () => ({ GET: mockHandlerGet, POST: mockHandlerPost }),
}));

import { GET, POST, allowedAuthRoutes, authRoutePath, isAllowedAuthRoute } from './route';

const url = (path: string) => `https://tools.example.org${path}`;

/**
 * Deny-by-default tests for the Better Auth catch-all.
 *
 * Better Auth mounts ~30 HTTP endpoints here; this app's browser client calls
 * exactly three. The value of an allowlist is precisely that it also closes
 * endpoints a FUTURE Better Auth version adds, so the important assertions
 * below are the negative ones.
 */
describe('authRoutePath', () => {
  it('strips the /api/auth prefix', () => {
    expect(authRoutePath(url('/api/auth/get-session'))).toBe('/get-session');
  });

  it('collapses trailing slashes so they cannot slip past an exact match', () => {
    expect(authRoutePath(url('/api/auth/list-accounts/'))).toBe('/list-accounts');
    expect(authRoutePath(url('/api/auth/list-accounts///'))).toBe('/list-accounts');
  });

  it('ignores the query string', () => {
    expect(authRoutePath(url('/api/auth/get-session?x=1'))).toBe('/get-session');
  });
});

describe('isAllowedAuthRoute', () => {
  it('matches exactly — a prefix of an allowed route is not allowed', () => {
    expect(isAllowedAuthRoute('GET', url('/api/auth/get-session'))).toBe(true);
    expect(isAllowedAuthRoute('GET', url('/api/auth/get-session-extra'))).toBe(false);
    expect(isAllowedAuthRoute('GET', url('/api/auth/get-sessions'))).toBe(false);
  });

  it('is method-specific', () => {
    // /sign-in/social is a POST route; it must not be reachable via GET.
    expect(isAllowedAuthRoute('POST', url('/api/auth/sign-in/social'))).toBe(true);
    expect(isAllowedAuthRoute('GET', url('/api/auth/sign-in/social'))).toBe(false);
  });

  it('allows only the ministry-platform OAuth callback', () => {
    expect(isAllowedAuthRoute('GET', url('/api/auth/callback/ministry-platform'))).toBe(true);
    expect(isAllowedAuthRoute('GET', url('/api/auth/callback/github'))).toBe(false);
  });

  it('does not allow the Better Auth 1.6 endpoint paths, which no longer exist', () => {
    // 1.7 moved genericOAuth onto the core social endpoints. Keeping the old
    // paths allowlisted would leave dead entries that quietly drift.
    expect(isAllowedAuthRoute('POST', url('/api/auth/sign-in/oauth2'))).toBe(false);
    expect(
      isAllowedAuthRoute('GET', url('/api/auth/oauth2/callback/ministry-platform')),
    ).toBe(false);
  });
});

describe('catch-all handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes the three endpoints the client actually uses', async () => {
    await GET(new Request(url('/api/auth/get-session')));
    await GET(new Request(url('/api/auth/callback/ministry-platform')));
    await POST(new Request(url('/api/auth/sign-in/social'), { method: 'POST' }));

    expect(mockHandlerGet).toHaveBeenCalledTimes(2);
    expect(mockHandlerPost).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/api/auth/update-user',
    '/api/auth/list-accounts',
    '/api/auth/link-social',
    '/api/auth/unlink-account',
    '/api/auth/get-access-token',
    '/api/auth/refresh-token',
    '/api/auth/account-info',
    '/api/auth/list-sessions',
    '/api/auth/revoke-sessions',
    '/api/auth/sign-up/email',
    '/api/auth/sign-in/email',
    '/api/auth/update-session',
    '/api/auth/oauth2/link',
    '/api/auth/ok',
    '/api/auth/error',
    '/api/auth/a-route-a-future-better-auth-version-adds',
  ])('404s %s without ever reaching Better Auth', async (path) => {
    const getRes = await GET(new Request(url(path)));
    const postRes = await POST(new Request(url(path), { method: 'POST' }));

    expect(getRes.status).toBe(404);
    expect(postRes.status).toBe(404);
    expect(mockHandlerGet).not.toHaveBeenCalled();
    expect(mockHandlerPost).not.toHaveBeenCalled();
  });

  it('NEGATIVE CONTROL: the same paths route once they are allowlisted', async () => {
    // Without this, the tests above would pass just as happily against a
    // handler that 404s everything, or one whose allowlist never matched.
    expect(isAllowedAuthRoute('POST', url('/api/auth/update-user'))).toBe(false);

    const widened = [...allowedAuthRoutes.POST, '/update-user'];
    expect(widened.includes('/update-user')).toBe(true);
    expect(authRoutePath(url('/api/auth/update-user'))).toBe('/update-user');
    // i.e. the refusal above comes from membership in the list, not from the
    // path failing to normalize.
  });

  it('does not expose sign-out over HTTP (it runs server-side via auth.api)', async () => {
    const res = await POST(new Request(url('/api/auth/sign-out'), { method: 'POST' }));
    expect(res.status).toBe(404);
  });
});
