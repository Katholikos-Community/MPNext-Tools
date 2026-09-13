import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

/**
 * Logger tests.
 *
 * The `debug` channel was REMOVED, not merely quieted. It wrapped
 * `console.log` and was used to dump `$filter` query params, stored-procedure
 * parameters, PUT request bodies and full MP result sets — names, email
 * addresses, phone numbers. Gating it on `NODE_ENV !== 'production'` was not
 * enough: developer machines and any non-production deployment still wrote
 * member PII to a terminal or log aggregator, which typically has broader
 * access and longer retention than the Ministry Platform database itself.
 */
describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exposes NO debug channel', () => {
    expect('debug' in logger).toBe(false);
    expect((logger as Record<string, unknown>).debug).toBeUndefined();
  });

  it('exposes only the error channel', () => {
    expect(Object.keys(logger)).toEqual(['error']);
  });

  it('error always logs regardless of environment', () => {
    logger.error('boom', new Error('oops'));

    expect(errorSpy).toHaveBeenCalledWith('[MP]', 'boom', expect.any(Error));
  });

  it('never routes anything through console.log', () => {
    logger.error('some event', { table: 'Contacts', status: 500 });

    expect(logSpy).not.toHaveBeenCalled();
  });
});
