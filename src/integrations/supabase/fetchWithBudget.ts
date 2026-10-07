/**
 * A fetch that gives up, and one that speaks to PostgREST the way this project
 * configures its keys.
 *
 * Budget: server-rendered pages read the ledger before they paint. If that read
 * hangs — an unreachable host, a blocked network path, a firewall that swallows
 * the request instead of refusing it — the response never finishes and the
 * visitor stares at a blank tab for as long as the socket stays open. Every
 * page here is written to survive an unreachable ledger and render its honest
 * empty state, but that code only runs when the request actually *fails*. So
 * every server-side call gets a budget: exceeding it aborts the request, the
 * read throws, and the page renders in seconds instead of never.
 *
 * Keys: a key that is not a JWT (Supabase's newer `sb_publishable_…` and
 * `sb_secret_…` values) is not a bearer token and must never be sent as one.
 * The client library's own behaviour around that is not something to rely on,
 * so it is handled here explicitly.
 *
 * A caller that supplies its own signal keeps control of its own request.
 */
const DEFAULT_BUDGET_MS = 8_000;

export function fetchWithBudget(
  inner: typeof fetch = fetch,
  budgetMs: number = DEFAULT_BUDGET_MS,
): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal) return inner(input, init);

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`Ledger request exceeded ${budgetMs}ms`)),
      budgetMs,
    );

    return inner(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

export function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** The fetch Supabase is given on the server: budgeted, and key-aware. */
export function createLedgerFetch(apiKey: string, budgetMs?: number): typeof fetch {
  const budgeted = fetchWithBudget(undefined, budgetMs);

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isOpaqueApiKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", apiKey);
    return budgeted(input, { ...init, headers });
  };
}
