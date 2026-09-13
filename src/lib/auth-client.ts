import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

/**
 * NOTE: there is deliberately no `genericOAuthClient()` here.
 *
 * Better Auth 1.7 removed it. As of 1.7, the genericOAuth plugin registers its
 * providers as first-class SOCIAL providers rather than mounting endpoints of
 * its own, so sign-in goes through the core `signIn.social` / `callback/:id`
 * endpoints. The client plugin — and the `signIn.oauth2` method it added — no
 * longer exist.
 *
 * Call `authClient.signIn.social({ provider: "ministry-platform" })`. Note the
 * field is `provider`, not the `providerId` the old `signIn.oauth2` took.
 */
export const authClient = createAuthClient({
  plugins: [
    customSessionClient<typeof auth>(),
  ],
});
