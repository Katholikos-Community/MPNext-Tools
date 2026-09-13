import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Deny-by-default allowlist for the Better Auth catch-all.
 *
 * `toNextJsHandler(auth)` mounts every endpoint Better Auth defines — roughly
 * thirty of them, including `/get-access-token`, `/refresh-token`,
 * `/list-accounts`, `/link-social`, `/unlink-account`, `/account-info`,
 * `/list-sessions`, `/revoke-*`, `/sign-up/email`, `/sign-in/email`,
 * `/update-user`, `/update-session` and `/ok` — plus anything a future
 * Better Auth release adds. This app's browser client calls exactly three.
 *
 * These paths were read off the installed version, not assumed — and they
 * CHANGED in Better Auth 1.7. The genericOAuth plugin no longer mounts
 * endpoints of its own; it now registers its providers as first-class SOCIAL
 * providers, so sign-in goes through the CORE `POST /sign-in/social` and
 * `GET /callback/:id` endpoints. On 1.6 these were `POST /sign-in/oauth2` and
 * `GET /oauth2/callback/:providerId`, and `/oauth2/link` existed as the
 * plugin's account-linking endpoint; none of those exist any more.
 *
 * Re-enumerate this list against the installed version on every Better Auth
 * upgrade. A stale entry fails CLOSED — sign-in 404s loudly — which is the
 * behaviour to want, but it is still an outage.
 *
 * `/sign-out` is deliberately absent too: sign-out runs server-side through
 * `auth.api.signOut` in `src/components/user-menu/actions.ts`, which calls the
 * handler directly and never crosses this HTTP boundary. If a future change
 * moves sign-out to `authClient.signOut()` in the browser, it will 404 here —
 * loudly, which is the point.
 */
export const allowedAuthRoutes = {
  GET: ["/get-session", "/callback/ministryplatform"],
  POST: ["/sign-in/social"],
} as const;

const AUTH_PREFIX = "/api/auth";

/**
 * Normalizes a request URL to a path relative to `/api/auth`, for exact
 * comparison against the allowlist.
 *
 * Exported for testing. Exact string matching only — no regex, no prefix
 * matching — so that a path cannot be widened by a crafted suffix.
 */
export function authRoutePath(url: string): string {
  const { pathname } = new URL(url);
  const relative = pathname.startsWith(AUTH_PREFIX)
    ? pathname.slice(AUTH_PREFIX.length)
    : pathname;
  // Collapse trailing slashes so "/get-session/" cannot slip past the match.
  const trimmed = relative.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function isAllowedAuthRoute(
  method: keyof typeof allowedAuthRoutes,
  url: string,
): boolean {
  const path = authRoutePath(url);
  return (allowedAuthRoutes[method] as readonly string[]).includes(path);
}

const handlers = toNextJsHandler(auth);

function guard(
  method: keyof typeof allowedAuthRoutes,
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    if (!isAllowedAuthRoute(method, request.url)) {
      // Plain 404 — never reaches Better Auth, so a disallowed endpoint is
      // indistinguishable from one that does not exist.
      return new Response(null, { status: 404 });
    }
    return handler(request);
  };
}

export const GET = guard("GET", handlers.GET);
export const POST = guard("POST", handlers.POST);
