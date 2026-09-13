"use client";

import { useEffect } from "react";

/**
 * Error boundary for routes OUTSIDE the `(web)` route group — `/signin`,
 * `/session-error`, `/auth-error`. Those routes have no app shell.
 *
 * This is deliberately SEPARATE from `src/app/(web)/error.tsx`: `error.tsx`
 * never wraps the layout of its own segment, so one boundary cannot do both
 * jobs. If this were the only boundary, any error inside `(web)` would replace
 * the whole shell — taking the header and the user's sign-out control with it,
 * which is the exact trap `/session-error` exists to avoid.
 *
 * Logs IDENTIFIERS ONLY. Unlike a controlled catch around an HTTP call, a
 * render error's message is not guaranteed to be content-free — these
 * boundaries sit above components that render MP names and addresses. `digest`
 * is the join key to the un-redacted server-side log.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("ui.render.error", {
      boundary: "root",
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h2 className="text-2xl font-semibold text-red-600">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-600">
          An unexpected error occurred. You can try again, or sign in from the
          start.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={retry}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <a
            href="/signin"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Go to sign in
          </a>
        </div>
        {error.digest ? (
          <p className="text-xs text-gray-400">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
