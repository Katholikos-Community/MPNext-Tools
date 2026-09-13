"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// If the OAuth redirect hasn't navigated away within this window, flip to
// an error state so the user sees a retry path instead of an infinite spinner.
const REDIRECT_TIMEOUT_MS = 10_000;

/**
 * Clamps `?callbackUrl=` to a path on this origin.
 *
 * Without this, `/signin?callbackUrl=https://evil.example` bounces the user
 * off-site from a URL that looks exactly like this app's own login page — a
 * credible phishing hop.
 *
 * Sanitizing happens once, HERE AT THE SOURCE, rather than at each sink,
 * because the value feeds two different consumers: the `window.location.href`
 * assignment (where no server is involved at all) and the `callbackURL` handed
 * to `signIn.oauth2`. Cleaning it once means a future third use cannot miss it.
 *
 * `//` is protocol-relative (`//evil.example` → `https://evil.example`), and
 * browsers normalize `/\` to `//`, so both are rejected.
 */
export function sanitizeCallbackUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

function describeOAuthError(code: string): string {
  switch (code) {
    case "access_denied":
      return "Sign-in was cancelled. Click retry to try again.";
    case "invalid_request":
    case "invalid_client":
    case "invalid_grant":
    case "unauthorized_client":
    case "unsupported_response_type":
    case "invalid_scope":
      return "The sign-in request was rejected by the provider. Please retry; if the problem persists, contact support.";
    case "server_error":
    case "temporarily_unavailable":
      return "The sign-in provider is temporarily unavailable. Please retry in a moment.";
    default:
      return `Sign-in failed (${code}). Please retry; if the problem persists, contact support.`;
  }
}

export function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams?.get("callbackUrl"));
  const errorParam = searchParams?.get("error") || null;

  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam ? describeOAuthError(errorParam) : null
  );

  // Track redirect-timeout so we can clear it if the page unmounts (or
  // navigation actually happens) before the timeout fires.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Guards against starting two concurrent OAuth flows.
   *
   * This MUST be a ref, not the `isRedirecting` state. React StrictMode
   * double-invokes effects in development, and a state flag read inside an
   * async callback cannot close that window: both runs reach the callback
   * before `setState` lands, both captured `false` in their closure, and both
   * fire. Each call then mints its own `state` and `nonce` and overwrites the
   * single `oauth_state` cookie (`storeStateStrategy: "cookie"`), so the two
   * flows race and the loser's callback fails verification.
   *
   * A ref is checked and set synchronously before the first await, and it
   * survives StrictMode's mount/unmount/remount because the component instance
   * is the same.
   */
  const oauthStartedRef = useRef(false);

  const clearRedirectTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startOAuth = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    (force = false) => {
      // Checked and set synchronously — before any await — so a second
      // StrictMode effect run cannot slip past.
      if (!force && oauthStartedRef.current) return;
      oauthStartedRef.current = true;

      setIsRedirecting(true);
      setErrorMessage(null);

      // Arm a safety timeout: if OAuth never navigates away, surface an error.
      clearRedirectTimeout();
      timeoutRef.current = setTimeout(() => {
        console.error(
          "SignIn: OAuth redirect did not navigate within %dms — surfacing error state",
          REDIRECT_TIMEOUT_MS
        );
        oauthStartedRef.current = false;
        setIsRedirecting(false);
        setErrorMessage(
          "Sign-in is taking longer than expected. Please retry; if the problem persists, check your network or contact support."
        );
      }, REDIRECT_TIMEOUT_MS);

      try {
        // Better Auth 1.7 removed `signIn.oauth2` along with the
        // genericOAuthClient plugin: genericOAuth providers are now registered
        // as first-class social providers and go through core `signIn.social`.
        // Note the field is `provider`, not the old `providerId`.
        const result = authClient.signIn.social({
          provider: "ministry-platform",
          callbackURL: callbackUrl,
        });
        // signIn.social() may return a Promise — attach a catch so
        // provider-level failures aren't swallowed.
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((err) => {
            console.error("SignIn: authClient.signIn.social rejected:", err);
            clearRedirectTimeout();
            oauthStartedRef.current = false;
            setIsRedirecting(false);
            setErrorMessage(
              "Failed to start sign-in. Please retry; if the problem persists, contact support."
            );
          });
        }
      } catch (err) {
        console.error("SignIn: authClient.signIn.social threw:", err);
        clearRedirectTimeout();
        oauthStartedRef.current = false;
        setIsRedirecting(false);
        setErrorMessage(
          "Failed to start sign-in. Please retry; if the problem persists, contact support."
        );
      }
    },
    [callbackUrl, clearRedirectTimeout]
  );

  const handleRetry = useCallback(() => {
    // An explicit retry deliberately bypasses the once-only guard.
    startOAuth(true);
  }, [startOAuth]);

  useEffect(() => {
    // If the URL arrived with ?error=..., don't auto-start OAuth — the user
    // just came back from a failed attempt and should see the retry UI.
    if (errorParam) {
      console.error("SignIn: OAuth provider returned error=%s", errorParam);
      return;
    }

    let cancelled = false;

    authClient
      .getSession()
      .then(({ data: session }) => {
        if (cancelled) return;
        if (session) {
          // Already signed in. `callbackUrl` was sanitized at the source above,
          // so this can only ever be a path on this origin.
          window.location.href = callbackUrl;
        } else if (!isRedirecting) {
          startOAuth();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("SignIn: Failed to check session:", err);
        // Proceed with sign-in redirect since the user needs to authenticate anyway
        if (!isRedirecting) {
          startOAuth();
        }
      });

    return () => {
      cancelled = true;
      clearRedirectTimeout();
    };
    // We intentionally exclude isRedirecting/startOAuth/clearRedirectTimeout
    // from deps so the effect only runs when callbackUrl/errorParam change —
    // otherwise flipping isRedirecting would re-trigger getSession.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackUrl, errorParam]);

  if (errorMessage) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full" role="alert" aria-live="assertive">
          <CardHeader>
            <CardTitle>Sign-in error</CardTitle>
            <CardDescription>We couldn&apos;t complete sign-in.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleRetry} type="button">
              Retry sign-in
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Redirecting to sign in...</h2>
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
      </div>
    </div>
  );
}

export function SignInFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Loading...</h2>
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
      </div>
    </div>
  );
}
