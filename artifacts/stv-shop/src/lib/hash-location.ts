import { useSyncExternalStore } from 'react'

interface NavigateOptions {
  state?: unknown
  replace?: boolean
}

let listeners: Array<() => void> = []

const onHashChange = () => listeners.forEach((cb) => cb())

const subscribeToHashUpdates = (callback: () => void) => {
  if (listeners.push(callback) === 1) addEventListener('hashchange', onHashChange)
  return () => {
    listeners = listeners.filter((item) => item !== callback)
    if (!listeners.length) removeEventListener('hashchange', onHashChange)
  }
}

const hashPrefix = /^#?\/?/
const currentHashLocation = () => '/' + location.hash.replace(hashPrefix, '')

// Pasted / shared links such as `#/catalog?sort=newest` keep the query inside the
// hash, which the router would treat as part of the path and answer with a 404.
// Move that query into the real search string (where navigate() puts it) before
// anything reads the location.
const normalizeHashQuery = (): void => {
  if (typeof window === 'undefined') return
  const hash = window.location.hash
  const index = hash.indexOf('?')
  if (index < 0) return
  try {
    const url = new URL(window.location.href)
    const inline = hash.slice(index + 1)
    url.hash = hash.slice(0, index) || '#/'
    url.search = inline
    window.history.replaceState(window.history.state, '', url.href)
    onHashChange()
  } catch {
    /* malformed URL — leave it to the 404 page */
  }
}

if (typeof window !== 'undefined') {
  normalizeHashQuery()
  window.addEventListener('hashchange', normalizeHashQuery)
}

export const navigate = (to: string, options: NavigateOptions = {}) => {
  const { state = null, replace = false } = options
  const oldURL = location.href
  const [hash, search = ''] = to.replace(hashPrefix, '').split('?')
  const url = new URL(oldURL)
  url.hash = `/${hash}`
  url.search = search
  const newURL = url.href
  history[replace ? 'replaceState' : 'pushState'](state, '', newURL)
  const event = typeof HashChangeEvent !== 'undefined'
    ? new HashChangeEvent('hashchange', { oldURL, newURL })
    : new Event('hashchange')
  dispatchEvent(event)
}

const useHashLocationHook = ({ ssrPath = '/' }: { ssrPath?: string } = {}) =>
  [
    useSyncExternalStore(subscribeToHashUpdates, currentHashLocation, () => ssrPath),
    navigate,
  ] as [string, typeof navigate]

useHashLocationHook.hrefs = (href: string) => '#' + href

export const useHashLocation = useHashLocationHook
