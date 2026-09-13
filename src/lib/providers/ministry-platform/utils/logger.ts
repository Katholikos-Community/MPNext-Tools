/**
 * MP provider logging.
 *
 * There is deliberately NO `debug` channel. It previously wrapped
 * `console.log` and was used to dump `$filter` query params, stored-procedure
 * parameters, PUT request bodies and full result sets — names, email
 * addresses, phone numbers. Being gated on `NODE_ENV !== 'production'` was not
 * enough: developer machines and any non-production deployment still wrote
 * member PII to a terminal or a log aggregator, which typically has broader
 * access and longer retention than the Ministry Platform database itself.
 *
 * The rule for what remains: log IDENTIFIERS AND SHAPE, never content — table
 * names, record IDs, HTTP status. Never record fields, `$filter` strings,
 * request bodies or response bodies.
 *
 * `no-console` in `eslint.config.mjs` enforces this across `src/`, allowing
 * only `warn` and `error`.
 */
export const logger = {
  error: (...args: unknown[]) => console.error('[MP]', ...args),
};
