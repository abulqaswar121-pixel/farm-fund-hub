// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Local preview ledger (development only — see scripts/preview-ledger).
 *
 * When a build is pointed at the stand-in ledger instead of Supabase, the
 * browser must not be handed an address like http://127.0.0.1:8788: that
 * resolves on the viewer's own machine, not in the sandbox serving the page.
 * So the client is given the relative base "/__ledger" and the dev server
 * proxies it to the stand-in, on the same origin as the page it is rendering.
 *
 * Nothing here applies unless PREVIEW_LEDGER_PROXY is set: a normal checkout
 * and every production build keep talking to Supabase directly.
 */
const PREVIEW_LEDGER_TARGET = process.env["PREVIEW_LEDGER_PROXY"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Allow the sandbox preview host (e.g. 8080-<id>.e2b.app) to reach the dev server.
      allowedHosts: true,
      ...(PREVIEW_LEDGER_TARGET
        ? {
            proxy: {
              "/__ledger": {
                target: PREVIEW_LEDGER_TARGET,
                changeOrigin: true,
                rewrite: (path: string) => path.replace(/^\/__ledger/, ""),
              },
            },
          }
        : {}),
    },
    preview: {
      allowedHosts: true,
    },
  },
});
