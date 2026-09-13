'use server';

import { AuthorizationService } from '@/services/authorizationService';
import type { MjmlCompileResult } from '@/components/template-editor/types';

/**
 * Authorization gate for this feature's server actions.
 *
 * A server action is a callable POST endpoint whether or not the page that
 * renders it was ever fetched, so the page-level gate in the tools layout is
 * not sufficient on its own. This replaces the previous bare session check:
 * MP's OIDC endpoint authenticates ANY dp_Users record, and this app reads MP
 * with its own service account, so "a session exists" proves nothing about
 * whether the caller may see or change this data.
 *
 * The service layer gates again — that is deliberate defence in depth, and the
 * per-request memoization in AuthorizationService keeps it to one MP read.
 */
async function requireAccess(
  table: string,
  operation: 'read' | 'create' | 'update' | 'delete',
): Promise<number> {
  return AuthorizationService.getInstance().requireSecurityRole({ table, operation });
}


const MAX_MJML_SIZE = 512_000; // 500KB

export async function compileMjml(mjmlSource: string): Promise<MjmlCompileResult> {
  // Touches no MP data, but it is a tool feature and the policy is that tools
  // require an MP security role — gating here keeps that rule uniform rather
  // than creating a carve-out that has to be reasoned about later.
  await requireAccess('dp_Tools', 'read');

  if (!mjmlSource || mjmlSource.length > MAX_MJML_SIZE) {
    throw new Error(`MJML source must be between 1 and ${MAX_MJML_SIZE} characters`);
  }

  const mjml2html = (await import('mjml')).default;

  const result = await mjml2html(mjmlSource, {
    validationLevel: 'soft',
    minify: false,
  });

  return {
    html: result.html,
    errors: result.errors.map((e) => ({
      line: e.line,
      message: e.message,
      tagName: e.tagName,
      formattedMessage: e.formattedMessage,
    })),
  };
}
