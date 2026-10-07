/**
 * Keep navigation working inside a sandboxed frame.
 *
 * A preview or embed frame is often served with sandbox="allow-scripts", which
 * gives the document an opaque origin. In that state the browser refuses every
 * history write — `history.pushState(url)` throws a SecurityError, because the
 * document's origin can never be same-origin with the URL it is asked to push.
 *
 * This is a single-page app, so a refused pushState means a click that does
 * nothing: the address bar never changes and no page loads. On the open web the
 * wrapper below is invisible — the try block simply succeeds. Only where the
 * write is refused does it fall back to a real navigation, which a sandboxed
 * frame is perfectly happy to serve: a full page load instead of a client-side
 * transition, and the visitor still reaches the page they asked for.
 */
let installed = false;

export function installSandboxSafeHistory(): void {
  if (installed || typeof window === "undefined" || !window.history) return;
  installed = true;

  const patch = (name: "pushState" | "replaceState") => {
    const original = window.history[name];
    if (typeof original !== "function") return;

    window.history[name] = function patched(
      this: History,
      state: unknown,
      title: string,
      url?: string | URL | null,
    ) {
      try {
        return original.call(this, state, title, url as string | undefined);
      } catch (error) {
        if (url === undefined || url === null) throw error;
        // The frame cannot hold history entries of its own, so let the browser
        // do the navigation it does allow.
        window.location.assign(String(url));
        return undefined;
      }
    } as History["pushState"];
  };

  patch("pushState");
  patch("replaceState");
}
