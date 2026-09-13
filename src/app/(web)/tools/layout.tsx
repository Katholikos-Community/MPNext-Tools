import { redirect } from "next/navigation";
import { AuthorizationService } from "@/services/authorizationService";

/**
 * Page-level authorization gate for every tool.
 *
 * React renders a layout before its children and only renders `children` once
 * the layout returns, so a `redirect()` here means the tool page component
 * never runs — one gate covers every route under `/tools`.
 *
 * This is the UX layer, NOT the security control. It uses `hasSecurityRole()`
 * (non-throwing, non-logging) purely to choose between rendering and
 * redirecting. Enforcement lives in the server actions and in the service
 * methods, both of which use `requireSecurityRole()` — a server action is a
 * callable POST endpoint whether or not this layout ever rendered.
 */
export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const permitted = await AuthorizationService.getInstance().hasSecurityRole();
  if (!permitted) {
    redirect("/no-access");
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {children}
    </div>
  );
}
