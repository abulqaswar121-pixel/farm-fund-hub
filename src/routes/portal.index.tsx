import { createFileRoute, Navigate } from "@tanstack/react-router";

import { usePortalContext } from "./portal";

export const Route = createFileRoute("/portal/")({
  component: PortalLanding,
});

/**
 * Role router. Admins and operators land on the console that needs them first;
 * everyone else lands in the investor view.
 */
function PortalLanding() {
  const { role } = usePortalContext();
  if (role === "admin") return <Navigate to="/portal/admin" />;
  if (role === "operator") return <Navigate to="/portal/operator" />;
  return <Navigate to="/portal/investor" />;
}
