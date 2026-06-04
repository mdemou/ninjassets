export type ObjectUrlFetcher = (path: string) => Promise<Blob | null>;

type CacheEntry = {
  url: string | null;
  refCount: number;
  inflight: Promise<string | null> | null;
  revokePending: boolean;
};

/** In-memory cache for authenticated binary resources (avatars, asset images, etc.). */
export function createObjectUrlCache(fetchBlob: ObjectUrlFetcher) {
  const cache = new Map<string, CacheEntry>();

  function finalizeEntry(path: string, entry: CacheEntry) {
    if (entry.refCount <= 0 && !entry.inflight) {
      if (entry.url) URL.revokeObjectURL(entry.url);
      cache.delete(path);
    } else if (entry.refCount <= 0 && entry.inflight) {
      entry.revokePending = true;
    }
  }

  function startInflight(path: string, entry: CacheEntry) {
    entry.inflight = fetchBlob(path)
      .then((blob) => {
        entry.inflight = null;
        if (!blob) {
          if (entry.refCount <= 0) cache.delete(path);
          return null;
        }
        const url = URL.createObjectURL(blob);
        entry.url = url;
        if (entry.revokePending && entry.refCount <= 0) {
          URL.revokeObjectURL(url);
          entry.url = null;
          cache.delete(path);
          return null;
        }
        return url;
      })
      .catch(() => {
        entry.inflight = null;
        if (entry.refCount <= 0) cache.delete(path);
        return null;
      });
  }

  async function acquireObjectUrl(path: string): Promise<string | null> {
    let entry = cache.get(path);
    if (!entry) {
      entry = { url: null, refCount: 0, inflight: null, revokePending: false };
      cache.set(path, entry);
    }

    // Count this consumer immediately so a quick unmount/remount (e.g. Strict Mode)
    // does not revoke the blob URL while a fetch is still in flight.
    entry.refCount++;
    if (entry.refCount > 0) entry.revokePending = false;

    if (entry.url) {
      return entry.url;
    }

    if (!entry.inflight) {
      startInflight(path, entry);
    }

    const inflight = entry.inflight;
    if (!inflight) return entry.url;
    return inflight;
  }

  function releaseObjectUrl(path: string): void {
    const entry = cache.get(path);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.refCount > 0) {
      entry.revokePending = false;
      return;
    }
    finalizeEntry(path, entry);
  }

  /** Drop a cached URL (e.g. after upload). Active consumers keep their ref until release. */
  function invalidateObjectUrl(path: string): void {
    const entry = cache.get(path);
    if (!entry) return;
    if (entry.url) URL.revokeObjectURL(entry.url);
    cache.delete(path);
  }

  return { acquireObjectUrl, releaseObjectUrl, invalidateObjectUrl };
}
