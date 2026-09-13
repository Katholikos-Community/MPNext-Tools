import { Suspense } from "react";
import { SignInContent, SignInFallback } from "./sign-in-content";

/**
 * Opt this route out of static prerendering.
 *
 * The CSP in `src/proxy.ts` is nonce-based, and Next.js reads the nonce off the
 * INCOMING REQUEST HEADERS at render time. A page prerendered at build time has
 * no request, therefore no nonce — so under an enforced CSP its bootstrap
 * script is blocked and the page never hydrates. For this route that means a
 * permanent spinner that never reaches Ministry Platform, because everything it
 * does happens in a client effect.
 *
 * THIS FILE MUST NOT BE MARKED "use client": route segment config is silently
 * IGNORED in a client module. Declaring `dynamic` there leaves it inert, the
 * build output still reports this route as static (○), and the page still fails
 * to hydrate — with no error to explain why. That is why the interactive body
 * lives in `./sign-in-content` and this file stays a server component.
 *
 * `src/app/signin/page.test.tsx` pins both halves of this: the export, and the
 * absence of the "use client" directive.
 */
export const dynamic = "force-dynamic";

export default function SignIn() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent />
    </Suspense>
  );
}
