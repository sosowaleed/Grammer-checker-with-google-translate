export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, T>;
  private storageKey: string;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(capacity: number = 200, storageKey: string = 'polyglot_lru_cache') {
    this.capacity = capacity;
    this.cache = new Map<string, T>();
    this.storageKey = storageKey;
    this.initFromStorage();
  }

  private getStorageApi(): any {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage.session || chrome.storage.local;
    }
    if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser?.storage) {
      return (globalThis as any).browser.storage.session || (globalThis as any).browser.storage.local;
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
        for (const [key, value] of items) {
          this.cache.set(key, value);
        }
      }
    } catch {
      // Silently fall back to in-memory only
    }
  }

  public get(key: string): T | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Refresh position for LRU
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  public has(key: string): boolean {
    return this.cache.has(key);
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
    this.cache.set(key, value);
    this.scheduleStorageSync();
  }

  public clear(): void {
    this.cache.clear();
    this.scheduleStorageSync();
  }

  public size(): number {
    return this.cache.size;
  }

  private scheduleStorageSync(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncToStorage();
    }, 1000);
  }

  private async syncToStorage(): Promise<void> {
    try {
      const storageApi = this.getStorageApi();
      if (!storageApi) return;

      const entries = Array.from(this.cache.entries()).slice(-100);
      await storageApi.set({ [this.storageKey]: entries });
    } catch {
      // Silently ignore storage sync errors
    }
  }
}
