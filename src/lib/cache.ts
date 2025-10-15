type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

export class TTLCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string) {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: V, ttlMs?: number) {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { value, expiresAt });
  }

  async remember(key: string, factory: () => Promise<V>, ttlMs?: number) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  clear(key?: string) {
    if (typeof key === "string") {
      this.store.delete(key);
      return;
    }

    this.store.clear();
  }
}
