/**
 * A storage handle that always works.
 *
 * `window.localStorage` is not always reachable. A preview or embed frame is
 * commonly served with sandbox="allow-scripts", which gives the document an
 * opaque origin — reading the property then throws a SecurityError, and a
 * single unguarded touch would take the whole page down with it.
 *
 * Session persistence is a nice-to-have; rendering is not. So: use real
 * localStorage when it is available and behaves, otherwise keep the session in
 * memory for the life of the tab. Nothing else about the client changes.
 */

function memoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
}

let cached: Storage | null = null;

export function safeWebStorage(): Storage {
  if (cached) return cached;

  try {
    const probe = window.localStorage;
    // A readable property is not enough: some sandboxed and private contexts
    // expose the object but refuse every write. Prove a write round-trips.
    const token = "__ndh-agricapital-probe__";
    probe.setItem(token, "1");
    probe.removeItem(token);
    cached = probe;
  } catch {
    cached = memoryStorage();
  }

  return cached;
}
