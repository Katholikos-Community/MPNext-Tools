/**
 * Content Security Policy construction.
 *
 * WHY: the Better Auth session cookie is the only credential this app holds,
 * and every page renders strings that came out of Ministry Platform. A script
 * injection anywhere is therefore an immediate session-theft path. This is the
 * defence-in-depth layer underneath the authorization and endpoint work.
 *
 * WHY HERE AND NOT `next.config.ts`: the nonce must be fresh per request. A
 * build-time value is a constant an attacker can read off any page, which
 * defeats the point. The request-independent headers (X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS) DO live in
 * `next.config.ts`, because that also covers `/api` and the static paths the
 * proxy matcher skips.
 */

/**
 * Returns the response header name to use.
 *
 * ENFORCES BY DEFAULT. Only the exact string "false" drops to report-only, so a
 * typo or a missing variable fails LOUD (a too-strict header) rather than
 * SILENT (no policy at all). Report-only is the unusual state you switch on to
 * diagnose a violation, not a state a deploy can drift into by forgetting to
 * set something.
 */
export function cspHeaderName(
  enforce: boolean = process.env.CSP_ENFORCE !== "false",
): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return enforce
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

/** Reduces a configured URL to a bare scheme+host origin, or null. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export interface CspOptions {
  nonce: string;
  isDev?: boolean;
  /** When true, omit `upgrade-insecure-requests` (see below). */
  reportOnly?: boolean;
  mpBaseUrl?: string;
  mpFileUrl?: string;
}

/**
 * Builds the CSP header value.
 *
 * Three directives are deliberately looser than they look like they should be.
 * Do NOT "tighten" them back into an outage:
 *
 * 1. `style-src 'unsafe-inline'`, WITH NO NONCE. Radix's dialog pulls in
 *    react-remove-scroll, which locks body scroll by INJECTING A `<style>`
 *    ELEMENT at runtime. That is an element, not an attribute, so
 *    `style-src-attr` never applies and it falls through to `style-src` — where
 *    a nonce cannot help, because the element is created by script long after
 *    the server chose the nonce. A hash does not work either: the content
 *    embeds the computed scrollbar width, so it varies by platform and zoom.
 *    Critically, the nonce MUST stay out of this directive — CSP3 browsers
 *    ignore `'unsafe-inline'` whenever a nonce sits beside it, which is exactly
 *    the trap that produces a policy that looks correct and breaks every
 *    dialog. The cost is bounded: inline STYLE injection permits limited
 *    selector-based exfiltration, not script execution. `script-src` keeps its
 *    nonce and `strict-dynamic`, which is the control that actually matters.
 *
 * 2. `form-action` includes the MP origin. Sign-out is a form-driven server
 *    action that ends in a redirect to MP's endsession endpoint, and browsers
 *    apply `form-action` to the WHOLE REDIRECT CHAIN, not just its first hop.
 *
 * 3. `img-src` includes the MP file origin, for contact photos served straight
 *    from Ministry Platform.
 *
 * `upgrade-insecure-requests` is omitted in dev AND whenever the policy is
 * report-only: browsers refuse to honour it in a report-only policy and log an
 * error saying so on every page, which buries the reports that report-only
 * exists to surface.
 */
export function buildCsp({
  nonce,
  isDev = false,
  reportOnly = false,
  mpBaseUrl = process.env.MINISTRY_PLATFORM_BASE_URL,
  mpFileUrl = process.env.NEXT_PUBLIC_MINISTRY_PLATFORM_FILE_URL,
}: CspOptions): string {
  const mpOrigin = originOf(mpBaseUrl);
  const fileOrigin = originOf(mpFileUrl);

  const imgSources = ["'self'", "data:", "blob:", mpOrigin, fileOrigin].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i,
  );

  const formActions = ["'self'", mpOrigin].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i,
  );

  const directives: string[] = [
    `default-src 'self'`,
    // 'strict-dynamic' lets a nonced script load its own chunks (Next does this
    // constantly) without whitelisting origins.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSources.join(" ")}`,
    `font-src 'self'`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `base-uri 'self'`,
    `form-action ${formActions.join(" ")}`,
    `frame-ancestors 'none'`,
  ];

  if (!isDev && !reportOnly) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/**
 * Generates a fresh per-request nonce.
 *
 * Base64 of 16 random bytes — matches the charset Next's
 * `getScriptNonceFromHeader` accepts (`[A-Za-z0-9+/_-]+={0,2}`).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
