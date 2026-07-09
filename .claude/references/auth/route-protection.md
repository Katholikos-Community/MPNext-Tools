---
title: Route Protection (proxy + AuthWrapper)
domain: auth
type: reference
applies_to: [src/proxy.ts, src/components/layout/auth-wrapper.tsx, src/app/(web)/layout.tsx]
symbols: [proxy, config, AuthWrapper]
related: [sessions.md, oauth-flow.md]
last_verified: 2026-07-09
---

## Purpose
Dual-layer route protection: edge-level cookie presence check in `src/proxy.ts` (Next.js 16 proxy, formerly middleware), plus a server-component `AuthWrapper` that verifies the decoded session and preserves the original URL as `callbackUrl` through the OAuth round-trip.

## Files
- `src/proxy.ts` — proxy function (exported as `proxy`, not `middleware`) + matcher
- `src/proxy.test.ts` — proxy route-protection tests
- `src/components/layout/auth-wrapper.tsx` — server-component guard used by `(web)` layout
- `src/components/layout/auth-wrapper.test.tsx` — `AuthWrapper` redirect/callbackUrl tests
- `src/app/(web)/layout.tsx` — mounts `<AuthWrapper>` around authenticated pages
- `src/app/session-error/page.tsx` — recovery page for broken (no-`userGuid`) sessions; **outside** `(web)`

## Key concepts
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** and `middleware()` → `proxy()`. The matcher is still exported as `config`.
- **Layer 1 (proxy):** `getSessionCookie()` from `better-auth/cookies` — **cookie-presence check only**, no JWT decode, no DB (there's no DB). Fast path gate at the edge.
- **Layer 2 (`AuthWrapper`):** `auth.api.getSession({ headers })` in a server component — decodes the cookie, validates session, redirects to `/signin` with `callbackUrl` if invalid/missing. It **also** redirects a session that exists but has no `userGuid` to `/session-error` (see "Broken-session recovery" below).
- **`x-pathname` forwarding:** proxy copies `pathname + search` into a request header. `AuthWrapper` reads it via `headers()` to build an accurate `callbackUrl` even when the proxy itself lets the request through (valid cookie, decoded session invalid).
- **Public paths (proxy bypass):** `/api/*` (Better Auth endpoints) and `/signin`. Static (`_next/static`, `_next/image`, `favicon.ico`, `assets/`) are excluded via the matcher.

## Proxy function (verbatim, `src/proxy.ts`)

```typescript
// src/proxy.ts:4-42
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const fullPath = pathname + request.nextUrl.search;

  // Forward the original URL (pathname + search) to downstream server
  // components via a request header, so AuthWrapper (and anything else
  // that needs to redirect to /signin) can build a correct callbackUrl
  // even when the proxy itself lets the request through.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-pathname', fullPath);
  const passThrough = () =>
    NextResponse.next({ request: { headers: forwardedHeaders } });

  // Early returns for public paths
  if (pathname.startsWith('/api') || pathname === '/signin') {
    console.log(`Proxy: Allowing public path ${pathname}`);
    return passThrough();
  }

  try {
    const sessionCookie = getSessionCookie(request);

    if (!sessionCookie) {
      console.log("Proxy: Redirecting to signin - no session cookie");
      const signinUrl = new URL('/signin', request.url);
      signinUrl.searchParams.set('callbackUrl', fullPath);
      return NextResponse.redirect(signinUrl);
    }

    console.log(`Proxy: Allowing request to ${pathname}`);
    return passThrough();

  } catch (error) {
    console.error('Proxy: Error checking session:', error);
    const signinUrl = new URL('/signin', request.url);
    signinUrl.searchParams.set('callbackUrl', fullPath);
    return NextResponse.redirect(signinUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
```

## AuthWrapper (verbatim, `src/components/layout/auth-wrapper.tsx`)

```typescript
// src/components/layout/auth-wrapper.tsx
export async function AuthWrapper({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });

  if (!session) {
    // Preserve the originally requested URL (pathname + search) so the
    // user lands back on the exact tool + params they asked for after
    // completing OAuth. The proxy forwards this via x-pathname.
    const originalPath = hdrs.get("x-pathname") || "/";
    const signinUrl = new URL("/signin", "http://placeholder");
    signinUrl.searchParams.set("callbackUrl", originalPath);
    redirect(`${signinUrl.pathname}${signinUrl.search}`);
  }

  // A session without a userGuid is unusable: every MP lookup keys off userGuid,
  // and without it the header avatar/menu never renders — leaving the user with
  // no way to sign out. Route these broken sessions to a recovery page instead.
  const userGuid = (session.user as { userGuid?: string | null }).userGuid;
  if (!userGuid) {
    redirect("/session-error");
  }

  return <>{children}</>;
}
```

Mounted via:

```typescript
// src/app/(web)/layout.tsx:34-42
<AuthWrapper>
  <Providers>
    <div className={...}>
      <main className="flex-1">
        {children}
      </main>
    </div>
  </Providers>
</AuthWrapper>
```

## Path matrix

| Path pattern | Proxy behavior | AuthWrapper behavior |
|---|---|---|
| `/api/*` | pass through (public) | not mounted (no `(web)` layout) |
| `/signin` | pass through (public) | not mounted |
| `/session-error` | pass through if cookie present; else → `/signin` | not mounted (outside `(web)`) — no redirect loop |
| `/_next/static/*`, `/_next/image/*`, `/favicon.ico`, `/assets/*` | excluded by matcher | not mounted |
| `/tools/...`, `/home`, etc. | redirect to `/signin?callbackUrl=<path>` if no cookie | `/signin` if session missing; `/session-error` if session present but no `userGuid` |

## `callbackUrl` preservation end-to-end

1. User hits `/tools/addresslabels?s=123&pageID=456`.
2. Proxy: no cookie → 302 to `/signin?callbackUrl=/tools/addresslabels?s=123&pageID=456`.
3. `/signin` page reads `callbackUrl` from `searchParams`, calls `authClient.signIn.oauth2({ providerId: "ministry-platform", callbackURL })`.
4. After OIDC round-trip → `/api/auth/oauth2/callback/ministry-platform` → Better Auth redirects browser to `callbackURL`.
5. Request for `/tools/addresslabels?s=123&pageID=456` now has a session cookie; proxy passes through with `x-pathname` set.
6. `AuthWrapper` confirms decoded session — if ever absent, falls back to `/signin?callbackUrl=<x-pathname value or "/">`.

Tested:
- `src/proxy.test.ts:98-107` — proxy attaches `callbackUrl` with query string preserved
- `src/components/layout/auth-wrapper.test.tsx:51-94` — `AuthWrapper` reads `x-pathname` and falls back to `/`

## Broken-session recovery (`/session-error`)

A session can be authenticated (cookie present, `getSession()` returns a user)
yet have **no `userGuid`** — e.g. after a better-auth upgrade drops the field
(see `user-identity.md`), or a user row created before the field existed. Such a
session is a trap: every MP lookup keys off `userGuid`, so the header
avatar/menu never render — and the normal sign-out control lives *in* that menu,
so the user is stuck with no way out.

`AuthWrapper` defends against this independent of root cause: a session with no
`userGuid` → `redirect("/session-error")`. The page (`src/app/session-error/page.tsx`)
renders a recovery screen with a `handleSignOut` form button, giving the user an
unconditional exit.

Why this placement:
- **Not the proxy:** it does a cookie-*presence* check and never decodes the
  JWT, so it can't cheaply see `userGuid`.
- **Not cookie deletion in the wrapper:** Next.js forbids cookie mutation during
  a Server Component render (only actions/route handlers) — which is exactly why
  recovery uses a server-action form button, not an auto-clear.
- **`/session-error` is outside the `(web)` route group,** so it is not wrapped
  by `AuthWrapper` and cannot redirect-loop. The proxy lets it through whenever a
  (broken but present) session cookie exists.

Tested: `src/components/layout/auth-wrapper.test.tsx` — no session → `/signin`,
session without `userGuid` → `/session-error`, `userGuid: null` → `/session-error`,
healthy session → renders children.

## Gotchas
- **Next.js 16 rename:** anything that refers to `middleware.ts` or `middleware()` is stale. This project uses `proxy.ts` / `proxy()`.
- **Proxy is a cookie-presence check only.** A forged/expired/invalid cookie will pass the proxy and only be caught by `AuthWrapper`. This is by design (edge speed), but it means route guards **must** rely on `AuthWrapper` (or equivalent `auth.api.getSession()` check) for correctness — never the proxy alone.
- **`/api/auth/*` is public at the proxy layer.** Better Auth's handler validates its own auth; protected app APIs should check `auth.api.getSession()` in the route handler.
- **`x-pathname` forwarding:** proxy only forwards it via `NextResponse.next({ request: { headers: forwardedHeaders } })`. When the proxy redirects, the header is not used — `AuthWrapper` only sees it on pass-through requests (`src/proxy.test.ts:178-186`).
- **Trailing-slash fallback:** if `x-pathname` is missing (e.g., request didn't route through the proxy), `AuthWrapper` falls back to `"/"` (`src/components/layout/auth-wrapper.tsx:13`).

## Related docs
- `sessions.md` — what the cookie contains and how `getSession` decodes it
- `oauth-flow.md` — `callbackURL` handling on the OIDC round-trip
- `../routing/README.md` — Next.js 16 `proxy.ts` convention
