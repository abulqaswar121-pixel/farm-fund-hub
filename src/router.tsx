import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installSandboxSafeHistory } from "./lib/sandboxNavigation";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Must run before the router starts listening to clicks: in a sandboxed
  // preview frame the browser refuses history writes, which would otherwise
  // turn every link into a dead click. See src/lib/sandboxNavigation.ts.
  installSandboxSafeHistory();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
