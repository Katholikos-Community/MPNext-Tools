import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WebError from './error';
import RootError from '../error';

/**
 * Error-boundary tests.
 *
 * Two failure modes here are silent, which is why they get explicit tests:
 *
 * 1. Next 16 renamed the boundary prop to `retry` (it was `reset`). `reset`
 *    still exists but only clears error state without re-fetching, so a
 *    boundary wired to the old name renders perfectly and its button does
 *    nothing at all.
 * 2. These boundaries sit above components that render MP names, addresses and
 *    household data. A render error's message is not guaranteed to be
 *    content-free, so neither the UI nor the log may include it.
 */
describe.each([
  ['(web) boundary', WebError, 'web'],
  ['root boundary', RootError, 'root'],
])('%s', (_label, Boundary, expectedBoundaryName) => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const error = Object.assign(new Error('Contact Jane Doe, jane@example.org, failed to parse'), {
    digest: 'abc123',
  });

  it('calls retry — not reset — when the button is clicked', () => {
    const retry = vi.fn();
    render(<Boundary error={error} retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the error message to the user', () => {
    render(<Boundary error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/jane@example.org/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('jane@example.org');
  });

  it('shows the digest so a user can quote it to support', () => {
    render(<Boundary error={error} retry={vi.fn()} />);

    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('renders without a digest', () => {
    render(<Boundary error={new Error('boom')} retry={vi.fn()} />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('logs identifiers only — never the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Boundary error={error} retry={vi.fn()} />);

    expect(spy).toHaveBeenCalledWith('ui.render.error', {
      boundary: expectedBoundaryName,
      name: 'Error',
      digest: 'abc123',
    });
    const payload = JSON.stringify(spy.mock.calls[0][1]);
    expect(payload).not.toContain('Jane Doe');
    expect(payload).not.toContain('jane@example.org');
  });
});

/**
 * `global-error.tsx` replaces the root layout, so it must not depend on
 * anything that might itself be what failed. It is checked at the source level
 * rather than rendered, because it emits its own <html>/<body>.
 */
describe('global-error boundary', () => {
  it('imports nothing from the app and styles itself inline', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(process.cwd(), 'src/app/global-error.tsx'),
      'utf-8',
    );

    // No app imports: whatever failed may be that very code, and it does not
    // receive global styles either.
    expect(source).not.toMatch(/from ["']@\//);
    expect(source).toContain('<html');
    // Inline styles are safe ONLY because style-src is 'self' 'unsafe-inline'
    // with no nonce — see src/lib/security-headers.ts. The two are coupled.
    expect(source).toContain('style={{');
  });

  it('uses the Next 16 retry prop', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(process.cwd(), 'src/app/global-error.tsx'),
      'utf-8',
    );

    expect(source).toContain('retry');
    expect(source).toContain('onClick={retry}');
  });
});
