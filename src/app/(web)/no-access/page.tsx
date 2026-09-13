/**
 * Explaining page for signed-in users who hold no MP security role.
 *
 * Deliberately inside the `(web)` route group so it renders WITH the app shell:
 * the header, user menu and — critically — the sign-out control stay available.
 * Refusing these users at sign-in instead would strand them in the app with no
 * way out, which is why sign-in is not role-gated (see AuthorizationService).
 */
export default function NoAccessPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-3">You don&apos;t have access to this tool</h1>
        <p className="text-gray-600">
          Your Ministry Platform account signed in successfully, but it
          doesn&apos;t have a security role that grants access to these tools.
          Ask your Ministry Platform administrator to assign one.
        </p>
      </div>
    </div>
  );
}
