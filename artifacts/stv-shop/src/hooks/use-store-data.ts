import { useEffect, useState } from 'react'
import type { Category, DataSource, Product, ProductColor, ProductFaq, ProductSpecs, SiteRoute, StorefrontData } from '@/types'
import { fallbackCategories, fallbackProducts, fallbackRoutes } from '@/lib/fallback-data'
import { apiUrl } from '@/lib/site'
import { readStoreSettings } from '@/lib/site-content'
import { mergeAdminCategories, mergeAdminProducts } from '@/components/AdminSecret'

type ApiStatus = 'loading' | 'ready' | 'fallback'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const numberFrom = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^\d.-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const textFrom = (value: unknown, fallback: string): string => typeof value === 'string' && value.trim() ? value.trim() : fallback

const booleanFrom = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback

const listFrom = (payload: unknown, key: string): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  if (Array.isArray(payload[key])) return payload[key] as unknown[]
  if (isRecord(payload.data)) {
    if (Array.isArray(payload.data[key])) return payload.data[key] as unknown[]
    if (Array.isArray(payload.data)) return payload.data as unknown[]
  }
  if (Array.isArray(payload.items)) return payload.items as unknown[]
  return []
}

const stockFrom = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  if (typeof value === 'string') {
    if (value.includes('غير متوفر')) return 0
    const parsed = Number(value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^\d.-]/g, ''))
    if (Number.isFinite(parsed)) return Math.max(0, parsed)
    return value.includes('محدود') ? Math.min(fallback, 2) : fallback
  }
  return fallback
}

const normalizeColor = (value: unknown, index: number, stock: number, primaryColorName: string, productAvailable: boolean): ProductColor => {
  const available = productAvailable
  if (typeof value === 'string') {
    const isHex = /^#[0-9a-f]{3,8}$/i.test(value)
    return {
      id: `color-${index + 1}`,
      name: isHex ? (index === 0 && primaryColorName ? primaryColorName : `لون ${index + 1}`) : value,
      hex: isHex ? value : '#222222',
      available,
      stock: available ? stock : 0,
    }
  }
  if (!isRecord(value)) return { id: `color-${index + 1}`, name: `لون ${index + 1}`, hex: '#222222', available, stock: available ? stock : 0 }
  const colorStock = stockFrom(value.stock ?? value.stockMeters ?? value.inventory, stock)
  return {
    id: textFrom(value.id, `color-${index + 1}`),
    name: textFrom(value.name ?? value.color, index === 0 && primaryColorName ? primaryColorName : `لون ${index + 1}`),
    hex: /^#[0-9a-f]{3,8}$/i.test(String(value.hex)) ? String(value.hex) : '#222222',
    available: productAvailable && booleanFrom(value.available, colorStock > 0) && colorStock > 0,
    stock: productAvailable ? colorStock : 0,
  }
}

const normalizeSpecs = (value: unknown): ProductSpecs => {
  const source = isRecord(value) ? value : {}
  return {
    brand: textFrom(source.brand, 'غير محددة'),
    gender: textFrom(source.gender, 'غير محدد'),
    material: textFrom(source.material, 'خامة غير محددة'),
    sizes: textFrom(source.sizes, 'غير محددة'),
    origin: textFrom(source.origin, 'غير محدد'),
    care: textFrom(source.care, 'اتباع تعليمات العناية على البطاقة'),
    use: textFrom(source.use, 'الاستخدام الرياضي'),
    warranty: textFrom(source.warranty, 'استبدال خلال ٣ أيام'),
  }
}

const normalizeSizes = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (typeof value === 'string' && value.trim()) return value.split(/[,،/|]/).map((item) => item.trim()).filter(Boolean)
  return ['M', 'L', 'XL']
}

const normalizeFaq = (value: unknown, index: number): ProductFaq | null => {
  if (!isRecord(value)) return null
  const question = textFrom(value.question ?? value.q, '')
  const answer = textFrom(value.answer ?? value.a, '')
  return question && answer ? { question, answer } : null
}

const normalizeProduct = (value: unknown, index: number): Product | null => {
  if (!isRecord(value)) return null
  const name = textFrom(value.name, '')
  const slug = textFrom(value.slug, textFrom(value.id, `product-${index + 1}`))
  if (!name || !slug) return null
  const image = textFrom(value.image, '')
  const imageList = Array.isArray(value.images) ? value.images.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
  const stock = stockFrom(value.stock ?? value.stockMeters ?? value.stockQuantity ?? value.inventory, 10)
  const productAvailable = booleanFrom(value.inStock, true)
  const primaryColorName = textFrom(value.color, '')
  const colors = Array.isArray(value.colors) && value.colors.length > 0
    ? value.colors.map((item, colorIndex) => normalizeColor(item, colorIndex, stock, primaryColorName, productAvailable))
    : [normalizeColor({}, 0, stock, primaryColorName, productAvailable)]
  return {
    id: textFrom(value.id, slug),
    slug,
    name,
    type: textFrom(value.type, ''),
    categoryId: textFrom(value.categoryId ?? value.category, 'jerseys'),
    description: textFrom(value.description, ''),
    price: Math.max(0, numberFrom(value.price, 0)),
    compareAtPrice: typeof value.compareAtPrice === 'number' ? value.compareAtPrice : undefined,
    image,
    images: [image, ...imageList.filter((item) => item !== image)],
    colors,
    sizes: normalizeSizes(value.sizes),
    specs: normalizeSpecs(isRecord(value.specs) ? { ...value, ...value.specs } : value),
    faqs: Array.isArray(value.faqs) ? value.faqs.map(normalizeFaq).filter((item): item is ProductFaq => item !== null) : [],
    isNew: booleanFrom(value.isNew, false),
    isFeatured: booleanFrom(value.isFeatured, true),
    colorsEnabled: booleanFrom(value.colorsEnabled, Array.isArray(value.colors) && value.colors.length > 0),
    stock,
    sourceUrl: textFrom(value.sourceUrl, ''),
    video: textFrom(value.video, '') || undefined,
    createdAt: textFrom(value.createdAt, new Date().toISOString().slice(0, 10)),
  }
}

const normalizeCategory = (value: unknown, index: number): Category | null => {
  if (!isRecord(value)) return null
  const name = textFrom(value.name, '')
  const id = textFrom(value.id ?? value.slug, `category-${index + 1}`)
  return name ? { id, slug: textFrom(value.slug, id), name, description: textFrom(value.description, 'تشكيلة من التجهيزات الرياضية'), image: textFrom(value.image, ''), accent: textFrom(value.accent, '#e11d2e') } : null
}

const normalizeRoute = (value: unknown, index: number): SiteRoute | null => {
  if (!isRecord(value)) return null
  const path = textFrom(value.path, '')
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return { id: textFrom(value.id, `route-${index + 1}`), label: textFrom(value.label, 'رابط'), path, header: booleanFrom(value.header, false) }
}

const fetchList = async (path: string, signal: AbortSignal, key: string): Promise<unknown[]> => {
  const response = await fetch(apiUrl(path), { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`API ${path} failed`)
  const payload: unknown = await response.json()
  return listFrom(payload, key)
}

/** المفتاح العام لوضع الألوان: عند إيقائه تختفي خيارات الألوان من كل المنتجات. */
const applyGlobalColors = (products: Product[]): Product[] => {
  let settings: ReturnType<typeof readStoreSettings>
  try {
    settings = readStoreSettings()
  } catch {
    return products
  }
  if (settings.colorsEnabled !== false) return products
  return products.map((product) => (product.colorsEnabled === false ? product : { ...product, colorsEnabled: false }))
}

export const useStoreData = (): StorefrontData & { status: ApiStatus } => {
  const [data, setData] = useState<StorefrontData>(() => ({ products: applyGlobalColors(mergeAdminProducts(fallbackProducts)), categories: mergeAdminCategories(fallbackCategories), routes: fallbackRoutes, source: 'fallback' }))
  const [status, setStatus] = useState<ApiStatus>('loading')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 3500)
    const load = async (): Promise<void> => {
      const [productsResult, categoriesResult, routesResult] = await Promise.allSettled([
        fetchList('/api/products', controller.signal, 'products'),
        fetchList('/api/categories', controller.signal, 'categories'),
        fetchList('/api/routes', controller.signal, 'routes'),
      ])
      const products = productsResult.status === 'fulfilled' ? productsResult.value.map(normalizeProduct).filter((item): item is Product => item !== null) : []
      const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value.map(normalizeCategory).filter((item): item is Category => item !== null) : []
      const routes = routesResult.status === 'fulfilled' ? routesResult.value.map(normalizeRoute).filter((item): item is SiteRoute => item !== null) : []
      const successful = Number(products.length > 0) + Number(categories.length > 0) + Number(routes.length > 0)
      const source: DataSource = successful === 0 ? 'fallback' : successful === 3 ? 'api' : 'mixed'
      setData({
        products: applyGlobalColors(mergeAdminProducts(products.length ? products : fallbackProducts)),
        categories: mergeAdminCategories(categories.length ? categories : fallbackCategories),
        routes: routes.length ? routes : fallbackRoutes,
        source,
      })
      setStatus(successful === 0 ? 'fallback' : 'ready')
    }
    void load()
    const syncAdmin = () => {
      setData((current) => ({ ...current, products: applyGlobalColors(mergeAdminProducts(current.products)), categories: mergeAdminCategories(current.categories) }))
    }
    window.addEventListener('stv-admin-changed', syncAdmin)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
      window.removeEventListener('stv-admin-changed', syncAdmin)
    }
  }, [])

  return { ...data, status }
}
