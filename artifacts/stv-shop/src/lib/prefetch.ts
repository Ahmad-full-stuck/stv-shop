/**
 * Idle-time image prefetcher. Warms the browser cache with the small
 * 320px WebP thumbnails that SmartImage would request anyway, so that
 * switching filters, pages, or hovering a chip feels instant. Requests
 * are de-duplicated, run at fetchPriority=low, and only start inside
 * requestIdleCallback so they never compete with visible content.
 */

const prefetched = new Set<string>()
let queued: string[] = []
let scheduled = false

const idle = (callback: () => void): void => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(callback, { timeout: 2000 })
  else setTimeout(callback, 200)
}

const drain = (): void => {
  scheduled = false
  const batch = queued
  queued = []
  for (const url of batch) {
    if (prefetched.has(url)) continue
    prefetched.add(url)
    const image = new Image()
    image.setAttribute('fetchpriority', 'low')
    image.decoding = 'async'
    image.src = url
  }
}

/** Build the 320px WebP URL SmartImage will use for a local fabric image. */
export const thumbUrl = (src: string): string | null => {
  if (!/^(fabrics|products|home)\/[\w-]+(\/[\w-]+)?\.jpe?g$/i.test(src)) return null
  return src.replace(/\.jpe?g$/i, '-320.webp')
}

/** Queue a batch of image URLs (or product image paths) to warm in the background. */
export const prefetchImages = (sources: (string | null | undefined)[]): void => {
  if (typeof window === 'undefined' || sources.length === 0) return
  let added = false
  for (const source of sources) {
    if (!source) continue
    const url = source.startsWith('http') || source.includes('.webp') ? source : thumbUrl(source)
    if (!url || prefetched.has(url) || queued.includes(url)) continue
    queued.push(url)
    added = true
  }
  if (!added || scheduled) return
  scheduled = true
  idle(drain)
}
