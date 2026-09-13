import { describe, it, expect } from 'vitest';
import { buildCsp, cspHeaderName, generateNonce } from './security-headers';

/**
 * Security-header tests.
 *
 * These pin the three deliberate loosenings in the policy and the two defaults
 * that are easy to invert by accident. Each assertion below corresponds to a
 * failure mode that produces either a silent security hole or a silent outage.
 */
describe('cspHeaderName', () => {
  it('enforces by default', () => {
    expect(cspHeaderName(true)).toBe('Content-Security-Policy');
  });

  it('drops to report-only only when explicitly disabled', () => {
    expect(cspHeaderName(false)).toBe('Content-Security-Policy-Report-Only');
  });

  it('treats any value other than the exact string "false" as enforcing', () => {
    // The point of the default: a typo ("FALSE", "0", "no") must fail LOUD with
    // a too-strict header, never SILENT with no policy at all.
    for (const value of ['FALSE', '0', 'no', 'true', '', undefined]) {
      expect(cspHeaderName(value !== 'false')).toBe('Content-Security-Policy');
    }
  });
});

describe('buildCsp', () => {
  const base = {
    nonce: 'abc123',
    mpBaseUrl: 'https://mp.example.org/ministryplatformapi',
    mpFileUrl: 'https://mp.example.org/ministryplatform/files',
  };

  it('nonces script-src and enables strict-dynamic', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it('does NOT put a nonce on style-src', () => {
    // CSP3 browsers IGNORE 'unsafe-inline' whenever a nonce sits beside it in
    // the same directive. Radix's dialog (via react-remove-scroll) injects a
    // <style> ELEMENT at runtime whose content embeds the computed scrollbar
    // width — it can be covered by neither a nonce nor a stable hash. A nonce
    // here therefore breaks every dialog in the app with React error #441.
    const csp = buildCsp(base);
    const styleSrc = csp.split('; ').find((d) => d.startsWith('style-src'));
    expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'");
    expect(styleSrc).not.toContain('nonce');
  });

  it('allows form submissions to the MP origin', () => {
    // Sign-out is a form-driven server action ending in a redirect to MP's
    // endsession endpoint, and browsers apply form-action to the WHOLE redirect
    // chain, not just the first hop.
    const csp = buildCsp(base);
    expect(csp).toContain("form-action 'self' https://mp.example.org");
  });

  it('allows images from the MP origins', () => {
    const csp = buildCsp(base);
    const imgSrc = csp.split('; ').find((d) => d.startsWith('img-src'));
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('https://mp.example.org');
  });

  it('blocks framing, objects and frames outright', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('omits upgrade-insecure-requests when report-only', () => {
    // Browsers refuse to honour it in a report-only policy and log an error
    // saying so on EVERY page — burying the reports report-only exists to
    // surface.
    expect(buildCsp({ ...base, reportOnly: true })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('omits upgrade-insecure-requests in development', () => {
    expect(buildCsp({ ...base, isDev: true })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('includes upgrade-insecure-requests when enforcing in production', () => {
    expect(buildCsp(base)).toContain('upgrade-insecure-requests');
  });

  it("only relaxes script-src with 'unsafe-eval' in development", () => {
    expect(buildCsp({ ...base, isDev: true })).toContain("'unsafe-eval'");
    expect(buildCsp(base)).not.toContain("'unsafe-eval'");
  });

  it('tolerates unset or malformed MP URLs without emitting a broken directive', () => {
    const csp = buildCsp({ nonce: 'n', mpBaseUrl: undefined, mpFileUrl: 'not a url' });
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain('undefined');
    expect(csp).not.toContain('null');
  });
});

describe('generateNonce', () => {
  it('produces a fresh value per call', () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });

  it('matches the charset Next accepts when extracting the nonce', () => {
    // Next's CSP_NONCE_SOURCE_REGEX is /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/.
    // A nonce outside that charset is silently ignored and every script tag
    // renders unnonced.
    for (let i = 0; i < 25; i++) {
      expect(generateNonce()).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    }
  });
});
