import Link from "next/link";

/**
 * Landing page for OAuth callback failures.
 *
 * Better Auth redirects here via `onAPIError.errorURL` (see `src/lib/auth.ts`)
 * with the failure code in `?error=`. It lives outside the `(web)` route group
 * so it is not wrapped by AuthWrapper, and it is allowlisted as public in
 * `src/proxy.ts` — otherwise an unauthenticated visitor would bounce to
 * `/signin`, which auto-starts OAuth again, looping forever.
 *
 * There is deliberately NO auto-redirect: a failing OAuth loop has to land
 * somewhere stable that the user can read.
 */

/**
 * Codes Better Auth actually emits on this redirect, read off the INSTALLED
 * version (1.7.4) rather than guessed:
 *
 *  - `OAUTH_CALLBACK_ERROR_CODES` in `dist/oauth2/errors.mjs`
 *  - state failures from `dist/oauth2/state.mjs`
 *  - `handleOAuthUserInfo` result strings, which `dist/api/routes/callback.mjs`
 *    converts with `result.error.split(" ").join("_")` — so "account not
 *    linked" arrives as `account_not_linked`.
 *
 * These changed substantially in 1.7 (for example `oAuth_code_missing` became
 * `no_code`, and `email_doesn't_match` became `email_does_not_match`), so
 * re-check this list on every Better Auth upgrade. An unrecognized code simply
 * falls back, so a stale entry degrades quietly rather than breaking the page.
 *
 * `error_description` is NEVER rendered: it is attacker-influencable text
 * arriving on a redirect.
 */
const ERROR_MESSAGES = new Map<string, string>(Object.entries({
  // The authorization code never arrived, or failed verification.
  no_code:
    "The sign-in response from Ministry Platform was incomplete. Please try signing in again.",
  /*
   * Better Auth maps a rejected token exchange (`invalid_grant` from MP) onto
   * this code, so it is NOT only an expiry. It also covers a code MP refused
   * outright — which is what an unsupported PKCE verifier looks like from the
   * browser. Keep the wording broad enough not to send someone hunting for a
   * timeout that never happened.
   */
  invalid_code:
    "Ministry Platform didn't accept the sign-in attempt. This is usually because it was left open too long — please try signing in again. If it happens every time, contact your administrator.",
  no_callback_url:
    "The sign-in request was missing its return address. Please start again from the sign-in page.",

  // Cross-site request forgery protection tripped.
  state_mismatch:
    "The sign-in request couldn't be verified. Please close any other sign-in tabs and try again.",
  state_security_mismatch:
    "The sign-in request couldn't be verified — this usually means it was left open too long, cookies are blocked, or another sign-in tab is open. Close other tabs and try again.",

  /*
   * Emitted when Better Auth sent a `nonce` and the id_token did not echo it.
   * MP never echoes it, so seeing this means `disableIdTokenNonceBinding` has
   * regressed in `src/lib/auth.ts` — it is a configuration bug, not a user
   * problem, and it affects EVERY user.
   */
  nonce_binding_missing:
    "Sign-in isn't configured correctly for Ministry Platform. Please contact your administrator.",

  // The id_token didn't match the provider's discovery document.
  issuer_missing:
    "Ministry Platform returned a sign-in token this app can't trust. Please contact your administrator.",
  issuer_mismatch:
    "Ministry Platform returned a sign-in token this app can't trust. Please contact your administrator.",
  oauth_provider_not_found:
    "Ministry Platform sign-in isn't available right now. This can happen if the app couldn't reach Ministry Platform when it started — please contact your administrator.",

  // The userinfo endpoint gave us nothing usable. Includes the case where MP
  // returned no `sub` (see `auth.userinfo.invalid_sub` in src/lib/auth.ts).
  unable_to_get_user_info:
    "We signed you in with Ministry Platform, but couldn't read your user profile back from it. This usually clears up on a retry.",
  email_not_found:
    "Ministry Platform didn't return enough profile information to complete sign-in. Please contact your administrator.",
  email_not_verified:
    "Ministry Platform hasn't verified the email address on this account. Please contact your administrator.",

  // Account-linking refusals. Implicit linking is disabled deliberately — see
  // the synthetic-email note in src/lib/auth.ts.
  account_not_linked:
    "This Ministry Platform login couldn't be matched to an existing account. Please contact your administrator.",
  account_already_linked_to_different_user:
    "This Ministry Platform login is already associated with a different account. Please contact your administrator.",
  unable_to_link_account:
    "We couldn't link your Ministry Platform login to an account. Please contact your administrator.",
  unable_to_update_account:
    "We couldn't update your account after sign-in. Please try again.",
  email_does_not_match:
    "The email address on this Ministry Platform login doesn't match the account being linked.",

  // Record creation failed on our side.
  unable_to_create_user:
    "We couldn't set up your account after sign-in. Please retry; if it persists, contact your administrator.",
  unable_to_create_session:
    "Sign-in completed but the session couldn't be created. Please try again.",
  signup_disabled:
    "New accounts can't be created through this app. Please contact your administrator.",

  internal_server_error:
    "Something went wrong on our side while completing sign-in. Please try again in a moment.",
}));

const FALLBACK_MESSAGE =
  "We couldn't complete sign-in. Please try again; if the problem persists, contact your administrator.";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.error;
  const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  // A Map, NOT an object literal: the key here is an arbitrary query-string
  // value, and `?error=constructor` (or `toString`, `__proto__`, …) against a
  // plain object returns an inherited Object.prototype member — which would be
  // rendered as a React child and blow up the page.
  //
  // `error_description` is never read at all: it is attacker-influencable text
  // arriving on a redirect.
  const message = (code && ERROR_MESSAGES.get(code)) || FALLBACK_MESSAGE;

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-3">Sign-in didn&apos;t complete</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <Link
          href="/signin"
          className="inline-flex items-center justify-center rounded-md bg-[#344767] px-5 py-2.5 text-white font-medium hover:bg-[#2d3a5f] focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          Try signing in again
        </Link>
        {code ? (
          <p className="mt-6 text-xs text-gray-400">
            Reference code: <span className="font-mono">{sanitizeCode(code)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Renders the raw code for support purposes, clamped to a conservative charset
 * and length so an arbitrary query value can't be used to paint text on the page.
 */
function sanitizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "unknown";
}
