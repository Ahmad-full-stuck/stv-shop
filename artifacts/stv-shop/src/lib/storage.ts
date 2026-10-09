import type { CartItem, Product, ProductColor } from '@/types'
import { availableStock, orderKey } from './catalog'

const CART_KEY = 'stv-cart-v1'
const WISHLIST_KEY = 'stv-wishlist-v1'

const readArray = (key: string): unknown[] => {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.length > 500 ? parsed.slice(0, 500) : parsed
  } catch {
    return []
  }
}

const findProduct = (products: Product[], slug: string): Product | undefined => products.find((product) => product.slug === slug)

const findColor = (product: Product, id: string): ProductColor => product.colors.find((item) => item.id === id) || product.colors[0] || {
  id: 'default',
  name: 'اللون الافتراضي',
  hex: '#222222',
  available: true,
  stock: product.stock,
}

const normalizeQuantity = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(1, Math.floor(value))
}

const merge = (cart: CartItem[], item: CartItem): CartItem[] => {
  const max = availableStock(item.product, item.color)
  const key = orderKey(item)
  const existingIndex = cart.findIndex((entry) => orderKey(entry) === key)
  if (max <= 0) return cart
  if (existingIndex < 0) return [...cart, { ...item, quantity: Math.min(item.quantity, max) }]
  const next = [...cart]
  const current = next[existingIndex]
  next[existingIndex] = { ...current, quantity: Math.min(max, current.quantity + item.quantity) }
  return next
}

export const getStoredCart = (products: Product[]): CartItem[] => {
  let result: CartItem[] = []
  const seen = new Set<string>()
  for (const entry of readArray(CART_KEY)) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const productRecord = record.product && typeof record.product === 'object' ? record.product as Record<string, unknown> : undefined
    const slug = typeof record.productSlug === 'string'
      ? record.productSlug
      : typeof record.slug === 'string'
        ? record.slug
        : typeof productRecord?.slug === 'string'
          ? productRecord.slug
          : ''
    const product = findProduct(products, slug)
    if (!product) continue
    const colorId = typeof record.colorId === 'string'
      ? record.colorId
      : typeof record.color === 'string'
        ? record.color
        : ''
    const color = findColor(product, colorId)
    const size = typeof record.size === 'string' && record.size ? record.size : (product.sizes[0] || 'M')
    const signature = `${slug}:${color.id}:${size}`
    if (seen.has(signature)) continue
    const quantity = normalizeQuantity(typeof record.quantity === 'number' ? record.quantity : typeof record.length === 'number' ? record.length : 1)
    if (!quantity) continue
    seen.add(signature)
    result = merge(result, { product, color, size, quantity })
  }
  return result
}

export const addCartItem = (
  cart: CartItem[],
  product: Product,
  color: ProductColor,
  size: string,
  requestedQuantity: number,
): { cart: CartItem[]; added: number; capped: boolean; available: boolean } => {
  const available = availableStock(product, color)
  const quantity = normalizeQuantity(requestedQuantity)
  if (available <= 0 || quantity <= 0) return { cart, added: 0, capped: false, available: false }
  const existing = cart.find((item) => orderKey(item) === orderKey({ product, color, size }))
  const current = existing?.quantity || 0
  const nextQuantity = Math.min(available, current + quantity)
  return { cart: merge(cart, { product, color, size, quantity }), added: nextQuantity - current, capped: nextQuantity < current + quantity, available: true }
}

export const updateCartItem = (cart: CartItem[], key: string, requestedQuantity: number): CartItem[] => {
  const item = cart.find((entry) => orderKey(entry) === key)
  if (!item) return cart
  const max = availableStock(item.product, item.color)
  const nextQuantity = normalizeQuantity(requestedQuantity)
  if (max <= 0 || nextQuantity <= max) return nextQuantity > 0 ? cart.map((entry) => orderKey(entry) === key ? { ...entry, quantity: nextQuantity } : entry) : cart.filter((entry) => orderKey(entry) !== key)
  return cart.map((entry) => orderKey(entry) === key ? { ...entry, quantity: max } : entry)
}

export const removeCartItem = (cart: CartItem[], key: string): CartItem[] => cart.filter((item) => orderKey(item) !== key)

export const reconcileCart = (cart: CartItem[], products: Product[]): CartItem[] => {
  let result: CartItem[] = []
  const seen = new Set<string>()
  for (const item of cart) {
    const product = findProduct(products, item.product.slug)
    if (!product) continue
    const color = findColor(product, item.color.id)
    const size = item.size || product.sizes[0] || 'M'
    const signature = `${product.slug}:${color.id}:${size}`
    if (seen.has(signature)) continue
    const quantity = Math.min(item.quantity, availableStock(product, color))
    if (quantity <= 0) continue
    seen.add(signature)
    result = merge(result, { product, color, size, quantity })
  }
  return result
}

export const getStoredWishlist = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(WISHLIST_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  } catch {
    return []
  }
}

export const setStoredWishlist = (slugs: string[]): void => {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(WISHLIST_KEY, JSON.stringify([...new Set(slugs)])) } catch { return }
}

export const setStoredCart = (cart: CartItem[]): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart.map((item) => ({ productSlug: item.product.slug, colorId: item.color.id, size: item.size, quantity: item.quantity }))))
  } catch {
    return
  }
}
