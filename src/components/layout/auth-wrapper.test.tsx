import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AuthWrapper Tests
 *
 * Verifies that AuthWrapper preserves the original requested URL as a
 * `callbackUrl` query param when redirecting unauthenticated users to
 * /signin. Without this, users always land on the tool index after
 * login, losing the tool + params they originally asked for.
 */

const { mockGetSession, mockRedirect, mockHeaders } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    // redirect() throws in real Next.js to abort rendering; mirror that
    // so code after it doesn't execute in tests.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  mockHeaders: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

import { AuthWrapper } from './auth-wrapper';

function setHeaders(entries: Record<string, string>) {
  const h = new Headers(entries);
  mockHeaders.mockResolvedValueOnce(h);
}

describe('AuthWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when unauthenticated', () => {
    it('redirects to /signin with callbackUrl from x-pathname header', async () => {
      setHeaders({ 'x-pathname': '/tools/addresslabels?s=123&pageID=456' });
      mockGetSession.mockResolvedValueOnce(null);

      await expect(
        AuthWrapper({ children: 'content' } as never)
      ).rejects.toThrow(/NEXT_REDIRECT/);

      expect(mockRedirect).toHaveBeenCalledTimes(1);
      const target = mockRedirect.mock.calls[0][0] as string;
      expect(target.startsWith('/signin?')).toBe(true);

      const search = new URL(target, 'http://x').searchParams;
      expect(search.get('callbackUrl')).toBe(
        '/tools/addresslabels?s=123&pageID=456'
      );
    });

    it('falls back to / when x-pathname header is missing', async () => {
      setHeaders({});
      mockGetSession.mockResolvedValueOnce(null);

      await expect(
        AuthWrapper({ children: 'content' } as never)
      ).rejects.toThrow(/NEXT_REDIRECT/);

      const target = mockRedirect.mock.calls[0][0] as string;
      const search = new URL(target, 'http://x').searchParams;
      expect(search.get('callbackUrl')).toBe('/');
    });

    it('URL-encodes query parameters in callbackUrl so they survive the redirect', async () => {
      setHeaders({ 'x-pathname': '/tools/template?q=a b&x=1' });
      mockGetSession.mockResolvedValueOnce(null);

      await expect(
        AuthWrapper({ children: 'content' } as never)
      ).rejects.toThrow(/NEXT_REDIRECT/);

      const target = mockRedirect.mock.calls[0][0] as string;
      expect(target).toContain('callbackUrl=');
      const search = new URL(target, 'http://x').searchParams;
      expect(search.get('callbackUrl')).toBe('/tools/template?q=a b&x=1');
    });
  });

  describe('when the session is missing userGuid', () => {
    // A session that exists but has no userGuid is unusable: every MP lookup
    // keys off userGuid, so the header avatar/menu — and the sign-out control —
    // never render. AuthWrapper routes these to /session-error, which can still
    // sign the user out. This guards the better-auth 1.6 regression.
    it('redirects to /session-error when userGuid is absent', async () => {
      setHeaders({ 'x-pathname': '/tools/template' });
      mockGetSession.mockResolvedValueOnce({
        user: { id: 'ba-id', name: 'No Guid' },
        session: {},
      });

      await expect(
        AuthWrapper({ children: 'content' } as never)
      ).rejects.toThrow('NEXT_REDIRECT:/session-error');

      expect(mockRedirect).toHaveBeenCalledWith('/session-error');
    });

    it('redirects to /session-error when userGuid is null', async () => {
      setHeaders({ 'x-pathname': '/tools/template' });
      mockGetSession.mockResolvedValueOnce({
        user: { id: 'ba-id', userGuid: null },
        session: {},
      });

      await expect(
        AuthWrapper({ children: 'content' } as never)
      ).rejects.toThrow('NEXT_REDIRECT:/session-error');

      expect(mockRedirect).toHaveBeenCalledWith('/session-error');
    });
  });

  describe('when authenticated', () => {
    it('does not redirect and returns children', async () => {
      setHeaders({ 'x-pathname': '/tools/template' });
      mockGetSession.mockResolvedValueOnce({
        user: { id: '1', userGuid: 'guid-1' },
        session: {},
      });

      const result = await AuthWrapper({ children: 'content' } as never);

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });
});
