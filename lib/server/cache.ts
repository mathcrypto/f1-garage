import "server-only"
import { unstable_cache } from "next/cache"

// Caching for data that doesn't come from `fetch` (the Tavily SDK, derived
// briefings). `fetch` calls cache themselves with `next: { revalidate }`; see
// lib/server/f1data.ts.

class Uncacheable extends Error {}

/**
 * Wrap an async loader in Next's Data Cache (`unstable_cache`), the
 * recommended cache for non-fetch data when Cache Components are off.
 * - The loader returns `null` for "no usable result": that's passed through
 *   but never cached, so a failed lookup is retried on the next request.
 * - Concurrent calls with the same arguments share one in-flight load.
 * Results must be JSON-serializable.
 */
export function cachedLoader<A extends (string | number | null)[], R>(
  loader: (...args: A) => Promise<R | null>,
  keyParts: string[],
  options: { revalidate: number; tags?: string[] },
): (...args: A) => Promise<R | null> {
  const cached = unstable_cache(
    async (...args: A) => {
      const result = await loader(...args)
      if (result === null) throw new Uncacheable()
      return result
    },
    keyParts,
    options,
  )
  const inFlight = new Map<string, Promise<R | null>>()
  return (...args: A) => {
    const key = JSON.stringify(args)
    const running = inFlight.get(key)
    if (running) return running
    const run = cached(...args)
      .catch((error: unknown) => {
        if (error instanceof Uncacheable) return null
        throw error
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, run)
    return run
  }
}

/**
 * A small least-recently-used cache bounded by total size, for values that
 * can't go in the Data Cache (binary audio). Per server instance.
 */
export class LruCache<V> {
  private map = new Map<string, { value: V; size: number }>()
  private total = 0

  constructor(private readonly maxBytes: number, private readonly sizeOf: (value: V) => number) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    // Re-insert to mark as most recently used.
    this.map.delete(key)
    this.map.set(key, hit)
    return hit.value
  }

  set(key: string, value: V) {
    const size = this.sizeOf(value)
    if (size > this.maxBytes) return
    const old = this.map.get(key)
    if (old) { this.total -= old.size; this.map.delete(key) }
    this.map.set(key, { value, size })
    this.total += size
    for (const [k, v] of this.map) {
      if (this.total <= this.maxBytes) break
      this.map.delete(k)
      this.total -= v.size
    }
  }
}
