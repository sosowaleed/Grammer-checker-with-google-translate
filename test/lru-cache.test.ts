import { describe, it, expect } from 'vitest';
import { LRUCache } from '../src/background/lru-cache';

describe('LRUCache', () => {
  it('stores and retrieves cached entries', () => {
    const cache = new LRUCache<string>(3);
    cache.set('a', 'apple');
    cache.set('b', 'banana');

    expect(cache.get('a')).toBe('apple');
    expect(cache.get('b')).toBe('banana');
    expect(cache.get('c')).toBeUndefined();
  });

  it('evicts least recently used item when capacity is exceeded', () => {
    const cache = new LRUCache<number>(3);
    cache.set('one', 1);
    cache.set('two', 2);
    cache.set('three', 3);

    // Access 'one' to make it recently used
    cache.get('one');

    // Add fourth item, 'two' should be evicted because 'one' was accessed and 'three' was added after
    cache.set('four', 4);

    expect(cache.get('one')).toBe(1);
    expect(cache.get('two')).toBeUndefined();
    expect(cache.get('three')).toBe(3);
    expect(cache.get('four')).toBe(4);
  });

  it('handles clearing items', () => {
    const cache = new LRUCache<string>(2);
    cache.set('x', '10');
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('x')).toBeUndefined();
  });
});
