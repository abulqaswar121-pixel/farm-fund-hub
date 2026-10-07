import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Sprout } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { NdhFamilySymbol } from "../components/ndh/NdhFamilySymbol";
import { PreviewRibbon } from "../components/ndh/PreviewRibbon";

const SITE_TITLE = "NDH AgriCapital | Farm capital with the books left open";
const SITE_DESCRIPTION =
  "Put money into real Nigerian farm cycles — catfish, tilapia, poultry, grain and greenhouses — and follow what the farm did, what the harvest weighed and who got paid. The rules are fixed before anyone pays in.";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-porcelain px-6 text-center">
      <NdhFamilySymbol SectorIcon={Sprout} size={54} />
      <p className="fig mt-6 text-[3rem] font-bold leading-none text-navy">404</p>
      <h1 className="mt-3 text-xl text-ink-deep">That page is not on the farm map</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
        The link may be old, or the cycle it pointed at may have been renamed. The marketplace is
        always the best place to restart.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className="pg-btn pg-btn--primary">
          Go to the marketplace
        </Link>
        <Link to="/cycles" className="pg-btn pg-btn--ghost">
          Browse open cycles
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-porcelain px-6 text-center">
      <NdhFamilySymbol SectorIcon={Sprout} size={54} />
      <h1 className="mt-6 text-xl text-ink-deep">This page did not load</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
        Something failed on our side — no ledger entry was affected. Try again, or head back to the
        marketplace.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="pg-btn pg-btn--primary"
        >
          Try again
        </button>
        <a href="/" className="pg-btn pg-btn--ghost">
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "author", content: "Najeeb Digital Hub" },
      { name: "theme-color", content: "#0A1A30" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "NDH AgriCapital" },
      { property: "og:image", content: "/og-agricapital.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // The Open Gateway master mark wearing the agricultural sprout badge:
      // the crisp vector first, the PNG as the fallback every browser honours.
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "64x64" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      // Precision Gateway typography: Space Grotesk display, DM Sans body,
      // Roboto Mono for every figure the platform prints. The faces are served
      // from /fonts in this repository (see the @font-face block in
      // src/styles.css), so a first paint never waits on a third-party host.
      {
        rel: "preload",
        href: "/fonts/dm-sans-latin-400.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/space-grotesk-latin-600.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/roboto-mono-latin-400.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
    scripts: [{ src: "https://js.paystack.co/v1/inline.js", async: true }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-porcelain">
        <PreviewRibbon />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
