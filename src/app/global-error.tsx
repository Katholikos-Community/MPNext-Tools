"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches a throw in the ROOT LAYOUT itself, which it
 * then replaces entirely (including <html> and <body>).
 *
 * This file MUST NOT import anything from the app — whatever failed may be that
 * very code — and it does not receive the app's global styles, so everything is
 * inlined.
 *
 * The inline `style` attributes below are safe ONLY BECAUSE `style-src` is
 * `'self' 'unsafe-inline'` with NO nonce (see `src/lib/security-headers.ts`).
 * The two are coupled: a nonce-based `style-src` would silently drop all of
 * this and render an unstyled page at the worst possible moment. If you change
 * one, check the other.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("ui.render.error", {
      boundary: "global",
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#f9fafb",
          color: "#111827",
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#dc2626",
              marginBottom: "0.75rem",
            }}
          >
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#4b5563", marginBottom: "1.5rem" }}>
            The application failed to load. Please try again.
          </p>
          <button
            onClick={retry}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "1.5rem" }}>
              Reference: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
