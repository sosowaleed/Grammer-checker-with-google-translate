export interface CacheItem<T> {
  value: T;
  timestamp: number;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheItem<T>>;
  private storageKey: string;
  private ttlMs: number;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    capacity: number = 200,
    storageKey: string = 'polyglot_lru_cache',
    ttlMs: number = 2 * 60 * 60 * 1000 // 2 hours default
  ) {
    this.capacity = capacity;
    this.cache = new Map<string, CacheItem<T>>();
    this.storageKey = storageKey;
    this.ttlMs = ttlMs;
    this.initFromStorage();
  }

  private getStorageApi(): any {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return chrome.storage.local;
    }
    if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser?.storage?.local) {
      return (globalThis as any).browser.storage.local;
    }
    return null;
  }

  private async initFromStorage(): Promise<void> {
    try {
      const storageApi = this.getStorageApi();
      if (!storageApi) return;

      const data = await storageApi.get(this.storageKey);
      const items = data && data[this.storageKey];
      if (Array.isArray(items)) {
        const now = Date.now();
        for (const [key, item] of items) {
          if (item && typeof item === 'object' && 'value' in item && 'timestamp' in item) {
            if (now - item.timestamp < this.ttlMs) {
              this.cache.set(key, item);
            }
          } else if (item !== undefined) {
            // Backward compatibility for legacy flat values
            this.cache.set(key, { value: item, timestamp: now });
          }
        }
      }
    } catch {
      // Silently fall back to in-memory only
    }
  }

  public get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) {
      return undefined;
    }

    // Check expiration
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest item (first key)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
    this.scheduleStorageSync();
  }

  public clear(): void {
    this.cache.clear();
    this.scheduleStorageSync();
  }

  public size(): number {
    this.cleanupExpired();
    return this.cache.size;
  }

  public cleanupExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  private scheduleStorageSync(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncToStorage();
    }, 2000);
  }

  private async syncToStorage(): Promise<void> {
    try {
      const storageApi = this.getStorageApi();
      if (!storageApi) return;

      this.cleanupExpired();
      // Bound the persisted entries to at most 50 to prevent storage quota exhaustion
      const entries = Array.from(this.cache.entries()).slice(-50);
      await storageApi.set({ [this.storageKey]: entries });
    } catch {
      // Silently ignore storage sync errors
    }
  }
}
