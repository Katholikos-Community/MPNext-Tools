import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MPHelper } from "@/lib/providers/ministry-platform";
import { validateGuid } from "@/lib/validation";

/**
 * Thrown when an authenticated caller is not permitted to perform an operation.
 *
 * Deliberately distinct from a generic `Error` so callers (and tests) can tell
 * "you may not do this" apart from "something broke". Infrastructure failures
 * must NEVER surface as this type — see `loadSecurityRoles`.
 */
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";

  constructor(message = "Not authorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface AuthorizationContext {
  /** MP table the operation targets, for the structured denial log. */
  table: string;
  operation: "read" | "create" | "update" | "delete";
}

/**
 * Per-REQUEST memoization via React `cache()`.
 *
 * The gate runs at up to three layers on a single request (page layout, server
 * action, service method); this collapses that into one MP read. It is
 * deliberately NOT a module-level or TTL cache: nothing crosses request
 * boundaries, which is what keeps a role revoked in MP effective on the user's
 * very next request rather than up to a TTL later.
 *
 * If `cache()` ever stops memoizing in a given execution context the only
 * consequence is redundant MP reads — never a wrong answer.
 */
const resolveUserId = cache(async (userGuid: string): Promise<number | null> => {
  const mp = new MPHelper();
  const records = await mp.getTableRecords<{ User_ID: number }>({
    table: "dp_Users",
    select: "User_ID",
    filter: `User_GUID = '${validateGuid(userGuid)}'`,
    top: 1,
  });
  // An empty result means "no such MP user" — a normal, fail-closed outcome.
  // A thrown error means MP is unreachable and propagates untouched.
  return records?.[0]?.User_ID ?? null;
});

const loadSecurityRoles = cache(async (userId: number): Promise<string[]> => {
  const mp = new MPHelper();
  const records = await mp.getTableRecords<{ Role_Name: string }>({
    table: "dp_User_Roles",
    select: "Role_ID_TABLE.Role_Name",
    filter: `User_ID = ${userId}`,
  });
  return (records ?? [])
    .map((r) => r.Role_Name)
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
});

/**
 * Roles permitted to use gated features, from `MP_SECURITY_ROLES`
 * (comma-separated). Unset or blank means "any MP security role will do", which
 * lets a deployment tighten access without a code change.
 */
function configuredRoles(): string[] {
  return (process.env.MP_SECURITY_ROLES ?? "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r.length > 0);
}

interface Decision {
  permitted: boolean;
  userId: number | null;
  reason: "ok" | "no_session" | "no_user_guid" | "no_mp_user" | "no_role";
}

/**
 * Authorization gate for everything that touches Ministry Platform data.
 *
 * WHY THIS EXISTS: MP's OIDC endpoint authenticates ANY `dp_Users` record, and
 * this app reads MP with its own client-credentials service account
 * (`dataplatform/scopes/all`). MP's per-user record security therefore never
 * applies to what this app returns. A Better Auth session proves only that
 * *some* MP user signed in — it is authentication, not authorization. Without
 * this gate, any MP user in the domain could read every household address
 * through the address-label tool, or reorder page fields for the entire domain
 * through field management.
 *
 * POLICY: any MP user may sign in and use the app shell. The MP-data tools
 * require an MP security role. Sign-in is deliberately NOT role-gated — a
 * role-less user still gets a session, the header and a working sign-out,
 * because refusing at sign-in strands them with no way out.
 */
export class AuthorizationService {
  private static instance: AuthorizationService;

  static getInstance(): AuthorizationService {
    if (!AuthorizationService.instance) {
      AuthorizationService.instance = new AuthorizationService();
    }
    return AuthorizationService.instance;
  }

  private async decide(): Promise<Decision> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { permitted: false, userId: null, reason: "no_session" };
    }

    const userGuid = (session.user as Record<string, unknown>).userGuid;
    if (typeof userGuid !== "string" || userGuid.length === 0) {
      return { permitted: false, userId: null, reason: "no_user_guid" };
    }

    let userId: number | null;
    try {
      userId = await resolveUserId(userGuid);
    } catch (err) {
      // Infrastructure failure. Rethrow rather than returning `permitted: false`
      // so a caller can never mistake "MP is down" for "this user is not
      // allowed" — the two demand very different responses.
      throw err;
    }

    if (userId === null) {
      return { permitted: false, userId: null, reason: "no_mp_user" };
    }

    const roles = await loadSecurityRoles(userId);
    if (roles.length === 0) {
      return { permitted: false, userId, reason: "no_role" };
    }

    const allowed = configuredRoles();
    if (allowed.length === 0) {
      // Blank config: holding any MP security role is sufficient.
      return { permitted: true, userId, reason: "ok" };
    }

    const held = roles.map((r) => r.toLowerCase());
    const match = held.some((r) => allowed.includes(r));
    return match
      ? { permitted: true, userId, reason: "ok" }
      : { permitted: false, userId, reason: "no_role" };
  }

  /**
   * ENFORCEMENT POINT. Throws `UnauthorizedError` if the caller may not perform
   * the operation, and logs a structured denial.
   *
   * @returns the acting MP `User_ID` — the single authoritative source for
   * `$userId` write attribution. Callers must use this value rather than one
   * they resolved themselves or, worse, one supplied by the caller.
   */
  async requireSecurityRole(context: AuthorizationContext): Promise<number> {
    const decision = await this.decide();

    if (!decision.permitted || decision.userId === null) {
      const event =
        context.operation === "read"
          ? "mp.read.unauthorized"
          : "mp.write.unauthorized";
      // Identifiers and shape only — never record content.
      console.warn(event, {
        table: context.table,
        operation: context.operation,
        reason: decision.reason,
        userId: decision.userId ?? null,
      });

      if (decision.userId === null && decision.reason !== "no_session") {
        console.warn("mp.write.non_user", {
          table: context.table,
          operation: context.operation,
          reason: decision.reason,
        });
      }

      throw new UnauthorizedError();
    }

    return decision.userId;
  }

  /**
   * Non-throwing, non-logging decision, for UI affordances and layout
   * redirects. NEVER use this as enforcement — a server action is a callable
   * POST endpoint whether or not the page that renders it was ever fetched.
   */
  async hasSecurityRole(): Promise<boolean> {
    try {
      const decision = await this.decide();
      return decision.permitted;
    } catch {
      // Fail closed for UI purposes. The enforcement path still surfaces the
      // underlying infrastructure error to the caller.
      return false;
    }
  }
}
