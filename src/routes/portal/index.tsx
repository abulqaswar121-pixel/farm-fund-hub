import { createFileRoute, Navigate } from "@tanstack/react-router";

import { usePortalContext } from "../portal";

export const Route = createFileRoute("/portal/")({
  component: PortalIndex,
});

/** Sends each member straight to their own portal. */
function PortalIndex() {
  const { role } = usePortalContext();
  if (role === "admin") return <Navigate to="/portal/admin" />;
  if (role === "operator") return <Navigate to="/portal/operator" />;
  return <Navigate to="/portal/member" />;
}
