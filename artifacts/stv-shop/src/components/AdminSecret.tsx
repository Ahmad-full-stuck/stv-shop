import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { Check, Eye, EyeOff, Image as ImageIcon, Lock, LogOut, Plus, Save, ShieldCheck, Trash2, Upload, X, Pencil, Download, RotateCcw } from 'lucide-react'
import type { Category, Product, ProductColor } from '@/types'
import { fallbackCategories, fallbackProducts } from '@/lib/fallback-data'
import { sanitizeCategory, sanitizeProduct, sanitizeCategories, sanitizeProducts } from '@/lib/sanitize'
import { formatPrice } from '@/lib/catalog'
import { adminFetch, adminLogin, adminLogout, adminWhoami, getToken, listAdmins, createAdminAccount, deleteAdminAccount, changeAdminPassword, type AdminAccount, AdminRequestError, loadServerConfig, ping, pushServerContent, pushServerSettings } from '@/lib/api'

const PRODUCTS_KEY = 'stv-admin-products'
const REMOVED_KEY = 'stv-admin-removed'
const CATEGORIES_KEY = 'stv-admin-categories'
const PIN_KEY = 'stv-admin-pin'
const SESSION_KEY = 'stv-admin-session'
const DEFAULT_PIN_HASH = 'a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972'

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type { SiteContent as AdminContent } from '@/lib/site-content'
export { readSiteContent as readAdminContent, CONTENT_KEY } from '@/lib/site-content'
import { CONTENT_KEY, defaultSiteContent, readSiteContent, readStoreSettings, type SiteContent, type StoreSettings } from '@/lib/site-content'

interface TextField {
  key: keyof SiteContent
  label: string
  area?: boolean
  hint?: string
}

const groupFields: { title: string; fields: TextField[] }[] = [
  {
    title: 'الغلاف الرئيسي',
    fields: [
      { key: 'heroEyebrow', label: 'النص الصغير فوق العنوان' },
      { key: 'heroTitle', label: 'عنوان الغلاف', area: true, hint: 'افصلي السطور بـ | وأحيطي الكلمة المميزة بـ *' },
      { key: 'heroText', label: 'النص تحت العنوان', area: true },
      { key: 'heroNote', label: 'ملاحظة الغلاف الأولى' },
      { key: 'heroNoteAlt', label: 'ملاحظة الغلاف الثانية' },
      { key: 'statsTitle', label: 'عنوان شريط الأرقام' },
      { key: 'heroSlideMs', label: 'سرعة تبديل صور الغلاف (مللي ثانية)', hint: '2600 = 2.6 ثانية، وكلما قلّت زادت السرعة' },
    ],
  },
  {
    title: 'أقسام الصفحة الرئيسية',
    fields: [
      { key: 'categoriesEyebrow', label: 'عنوان صغير - الأقسام' },
      { key: 'categoriesTitle', label: 'عنوان قسم الأقسام' },
      { key: 'newEyebrow', label: 'عنوان صغير - وصل حديثاً' },
      { key: 'newTitle', label: 'عنوان قسم وصل حديثاً' },
      { key: 'newDesc', label: 'وصف قسم وصل حديثاً', area: true },
      { key: 'promoPill', label: 'شارة شريط التوصيل' },
      { key: 'promoLead', label: 'الجزء المميز من شريط التوصيل' },
      { key: 'promoText', label: 'نص شريط التوصيل', hint: 'استخدمي {price} لوضع حد التوصيل المجاني' },
    ],
  },
  {
    title: 'قسم دليل الأقمشة في الرئيسية',
    fields: [
      { key: 'guideEyebrow', label: 'العنوان الصغير' },
      { key: 'guideTitle', label: 'عنوان القسم', area: true, hint: 'افصلي السطور بـ |' },
      { key: 'guideText', label: 'نص القسم', area: true },
      { key: 'guideCta', label: 'نص الزر' },
    ],
  },
  {
    title: 'النشرة (اشتراك بالبريد)',
    fields: [
      { key: 'newsletterEyebrow', label: 'العنوان الصغير' },
      { key: 'newsletterTitle', label: 'عنوان النشرة', area: true },
      { key: 'newsletterText', label: 'نص النشرة', area: true },
    ],
  },
]

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota */
  }
  try {
    window.dispatchEvent(new Event('stv-admin-changed'))
  } catch {
    /* ignore */
  }
}

export const readAdminProducts = (): Product[] => sanitizeProducts(readJson<unknown>(PRODUCTS_KEY, []))

const readSlugList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []

export const readRemovedSlugs = (): string[] => readSlugList(readJson<unknown>(REMOVED_KEY, []))

export const readAdminCategories = (): Category[] => sanitizeCategories(readJson<unknown>(CATEGORIES_KEY, []))

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

// The stored overrides may be partial (a backup that only changed the price, for
// example), so the raw objects are merged onto the base product first and only
// then rebuilt through the sanitizer — otherwise missing fields would overwrite
// the real ones with defaults.
const readRawProductOverrides = (): Record<string, unknown>[] => {
  const raw = readJson<unknown>(PRODUCTS_KEY, [])
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is Record<string, unknown> => isPlainObject(item) && typeof item.slug === 'string' && item.slug.length > 0)
}

export const mergeAdminProducts = (source: Product[]): Product[] => {
  const removed = new Set(readRemovedSlugs())
  const overrides = readRawProductOverrides()
  const base = source.filter((item) => !removed.has(item.slug))
  const bySlug = new Map<string, Product>()
  for (const item of base) bySlug.set(item.slug, item)
  for (const item of overrides) {
    const slug = item.slug as string
    const existing = bySlug.get(slug)
    const merged = existing ? sanitizeProduct({ ...existing, ...item }) : sanitizeProduct(item)
    if (merged) bySlug.set(slug, merged)
  }
  return [...bySlug.values()]
}

export const mergeAdminCategories = (source: Category[]): Category[] => {
  const raw = readJson<unknown>(CATEGORIES_KEY, [])
  if (!Array.isArray(raw) || !raw.length) return source
  const map = new Map<string, Category>()
  for (const item of source) map.set(item.slug, item)
  raw.forEach((entry, index) => {
    if (!isPlainObject(entry)) return
    const existing = typeof entry.slug === 'string' ? map.get(entry.slug) : undefined
    const merged = sanitizeCategory(existing ? { ...existing, ...entry } : entry, index)
    if (merged) map.set(merged.slug, merged)
  })
  return [...map.values()]
}

const emptyProduct = (): Product => ({
  id: `custom-${Date.now()}`,
  slug: `custom-${Date.now()}`,
  name: '',
  type: '',
  categoryId: 'jerseys',
  description: '',
  price: 0,
  image: '',
  images: [],
  colors: [{ id: 'color-1', name: 'أساسي', hex: '#111113', available: true, stock: 10 }],
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  specs: {
    brand: 'STV Shop',
    gender: 'unisex',
    material: 'غير محدد',
    sizes: 'S–XXL',
    origin: 'غير محدد',
    care: 'غسيل بارد وتجنّب المجفف',
    use: 'رياضي يومي',
    warranty: 'ضمان استبدال ٣ أيام',
  },
  faqs: [],
  isNew: true,
  isFeatured: false,
  stock: 10,
  createdAt: new Date().toISOString().slice(0, 10),
})

const toFileDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const source = typeof reader.result === 'string' ? reader.result : ''
      if (!source || !source.startsWith('data:image/')) return resolve(source)
      const image = new Image()
      image.onload = () => {
        const maxEdge = 1600
        const scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1))
        const width = Math.max(1, Math.round((image.width || 1) * scale))
        const height = Math.max(1, Math.round((image.height || 1) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) return resolve(source)
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = () => reject(new Error('read failed'))
      image.src = source
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })

const adminStyles = `
.admin-layer { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom)); background: rgba(46,24,33,.58); backdrop-filter: blur(9px) saturate(130%); -webkit-backdrop-filter: blur(9px) saturate(130%); animation: adminFade .18s ease both; }
.admin-panel { width: min(940px, 100%); max-height: min(92vh, calc(100vh - 28px)); display: flex; flex-direction: column; overflow: hidden; background: #fffbfb; border: 1px solid rgba(255,255,255,.92); border-radius: 20px; box-shadow: 0 34px 80px -24px rgba(46,24,33,.55); animation: adminPop .22s cubic-bezier(.22,1,.36,1) both; }
@supports (height: 100dvh) { .admin-panel { max-height: min(92dvh, calc(100dvh - 28px)); } }
@keyframes adminFade { from { opacity: 0; } }
@keyframes adminPop { from { opacity: 0; transform: translateY(14px) scale(.985); } }
.admin-head { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; color: #fff; background: linear-gradient(135deg, #1a1a1e, var(--stv-red-dark)); }
.admin-head h2 { margin: 0; font-size: 16.5px; display: flex; align-items: center; gap: 9px; }
.admin-head small { display: block; font-size: 11px; opacity: .78; font-weight: 400; }
.admin-head .admin-btn.ghost { min-height: 34px; padding: 6px 12px; font-size: 12px; }
.admin-tabs { flex: 0 0 auto; display: flex; gap: 7px; padding: 11px 14px; border-bottom: 1px solid var(--stv-line); background: #fff; overflow-x: auto; scrollbar-width: none; }
.admin-tabs::-webkit-scrollbar { display: none; }
.admin-tab { flex: 0 0 auto; min-height: 38px; padding: 8px 15px; border: 1px solid var(--stv-line); border-radius: 999px; background: #fff; color: var(--stv-muted); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: color .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
.admin-tab:hover { color: var(--stv-red); border-color: var(--stv-red); }
.admin-tab.is-active { color: #fff; background: var(--stv-red); border-color: var(--stv-red); box-shadow: 0 8px 18px -8px rgba(225, 29, 46, .55); }
.admin-body { flex: 1 1 auto; padding: 18px 18px 22px; overflow-y: auto; overflow-x: hidden; min-height: 0; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; word-break: break-word; }
.admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.admin-card { border: 1px solid var(--stv-line); border-radius: 14px; overflow: hidden; background: #fff; }
.admin-card img { width: 100%; height: 118px; object-fit: cover; display: block; background: var(--stv-red-soft); }
.admin-card .ac-body { padding: 10px 12px; display: grid; gap: 6px; }
.admin-card strong { font-size: 13.5px; color: var(--stv-ink); line-height: 1.5; }
.admin-card .ac-price { color: var(--stv-red); font-weight: 700; font-size: 14px; }
.admin-card .ac-actions { display: flex; gap: 6px; }
.admin-card .ac-actions button { flex: 1; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px; border: 1px solid var(--stv-line); border-radius: 10px; background: #fff; color: var(--stv-ink); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: color .15s ease, border-color .15s ease, background .15s ease; }
.admin-card .ac-actions button:hover { color: var(--stv-red); border-color: var(--stv-red); background: var(--stv-red-soft); }
.admin-card .ac-actions button.danger { color: #a3193f; border-color: #f0c9d4; background: #fff5f7; }
.admin-card .ac-actions button.danger:hover { color: #fff; border-color: #a3193f; background: #a3193f; }
.admin-field { display: grid; gap: 5px; margin-bottom: 12px; }
.admin-field label { font-size: 12px; font-weight: 700; color: var(--stv-muted); }
.admin-field input, .admin-field textarea, .admin-field select { width: 100%; padding: 9px 11px; border: 1px solid var(--stv-line-strong); border-radius: 12px; background: #fff; color: var(--stv-ink); font-family: inherit; font-size: 13.5px; transition: border-color .15s ease, box-shadow .15s ease; }
.admin-field textarea { min-height: 78px; resize: vertical; line-height: 1.7; }
.admin-field input:focus, .admin-field textarea:focus, .admin-field select:focus { outline: 2px solid var(--stv-red); outline-offset: 1px; border-color: var(--stv-red); }
.admin-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.admin-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.admin-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 9px 16px; border: 1px solid transparent; border-radius: 12px; background: var(--stv-red); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease, color .15s ease; }
.admin-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 22px -10px rgba(225, 29, 46, .55); }
.admin-btn:focus-visible { outline: 2px solid var(--stv-red); outline-offset: 2px; }
.admin-btn.ghost { background: #fff; color: var(--stv-ink); border-color: var(--stv-line-strong); }
.admin-btn.ghost:hover:not(:disabled) { color: var(--stv-red); border-color: var(--stv-red); background: var(--stv-red-soft); box-shadow: none; }
.admin-btn.success { background: var(--stv-green); }
.admin-btn.success:hover:not(:disabled) { box-shadow: 0 10px 22px -10px rgba(47, 92, 66, .55); }
.admin-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
.admin-note { font-size: 12px; color: var(--stv-muted); line-height: 1.8; background: var(--stv-red-soft); border: 1px solid var(--stv-red-tint); border-radius: 12px; padding: 10px 12px; }
.admin-note.ok { background: #eef7f1; border-color: #cfe7d8; color: #2f5c42; }
.admin-login { display: grid; gap: 15px; justify-items: center; text-align: center; padding: 42px 22px; }
.admin-login .lock { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; color: #fff; background: linear-gradient(135deg, var(--stv-red), var(--stv-steel)); box-shadow: 0 16px 32px -14px rgba(225, 29, 46, .65); }
.admin-login h3 { margin: 0; font-size: 18px; }
.admin-login p { margin: 0; font-size: 12.5px; color: var(--stv-muted); max-width: 330px; line-height: 1.8; }
.admin-pin { display: flex; gap: 9px; flex-wrap: wrap; justify-content: center; width: 100%; }
.admin-pin input { flex: 1 1 150px; width: auto; max-width: 190px; min-height: 44px; padding: 10px 12px; text-align: center; letter-spacing: 6px; font-size: 17px; border: 1px solid var(--stv-line-strong); border-radius: 12px; font-family: inherit; background: #fff; color: var(--stv-ink); }
.admin-pin input:focus { outline: 2px solid var(--stv-red); outline-offset: 1px; border-color: var(--stv-red); }
.admin-pin .admin-btn { min-height: 44px; }
.admin-credentials { display: grid; gap: 9px; width: 100%; max-width: 320px; }
.admin-credentials input { width: 100%; min-height: 44px; padding: 10px 12px; text-align: center; font-size: 15px; border: 1px solid var(--stv-line-strong); border-radius: 12px; font-family: inherit; background: #fff; color: var(--stv-ink); }
.admin-credentials input:focus { outline: 2px solid var(--stv-red); outline-offset: 1px; border-color: var(--stv-red); }
.admin-credentials .admin-btn { min-height: 44px; }
.admin-color-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.admin-color-row input[type=color] { width: 44px; height: 38px; padding: 2px; border: 1px solid var(--stv-line-strong); border-radius: 8px; background: #fff; cursor: pointer; }
.admin-color-img { display: flex; gap: 6px; align-items: center; width: 100%; padding-inline-start: 52px; }
.admin-color-img .cc-preview { position: relative; width: 44px; height: 44px; border-radius: 8px; overflow: hidden; border: 1px solid var(--stv-line); background: var(--stv-red-soft); display: grid; place-items: center; color: var(--stv-muted); flex: 0 0 auto; }
.admin-color-img .cc-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.admin-color-img .cc-preview button { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgba(46,24,33,.82); color: #fff; cursor: pointer; padding: 0; }
.admin-color-img .cc-pick { display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; border: 1px dashed var(--stv-line-strong); border-radius: 9px; background: #fff; color: var(--stv-ink); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.admin-color-img .cc-pick:hover { border-color: var(--stv-red); color: var(--stv-red); }
.admin-color-img input[type=text] { flex: 1; min-width: 120px; padding: 7px 9px; border: 1px solid var(--stv-line-strong); border-radius: 9px; font-family: inherit; font-size: 12px; }
.admin-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid var(--stv-line); border-radius: 999px; background: #fff; font-size: 11.5px; color: var(--stv-ink); }
.admin-chip button { border: 0; background: none; padding: 0; cursor: pointer; color: #a3193f; display: inline-flex; }
.admin-thumb-row { display: flex; gap: 8px; flex-wrap: wrap; }
.admin-thumb { position: relative; width: 74px; height: 74px; border-radius: 10px; overflow: hidden; border: 1px solid var(--stv-line); }
.admin-thumb img { width: 100%; height: 100%; object-fit: cover; }
.admin-thumb button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgba(46,24,33,.82); color: #fff; cursor: pointer; padding: 0; }
.admin-list { display: grid; gap: 10px; }
.admin-list-item { display: flex; gap: 10px; align-items: center; padding: 9px 11px; border: 1px solid var(--stv-line); border-radius: 12px; background: #fff; }
.admin-list-item img { width: 46px; height: 46px; border-radius: 8px; object-fit: cover; background: var(--stv-red-soft); }
.admin-list-item .li-main { flex: 1; min-width: 0; display: grid; gap: 2px; }
.admin-list-item .li-main strong { font-size: 13px; }
.admin-list-item .li-main small { font-size: 11.5px; color: var(--stv-muted); }
@media (max-width: 560px) {
  .admin-layer { padding: 10px; }
  .admin-row { grid-template-columns: 1fr; }
  .admin-body { padding: 14px 13px 20px; }
  .admin-grid { grid-template-columns: repeat(auto-fill, minmax(146px, 1fr)); gap: 9px; }
  .admin-panel { max-height: min(96vh, calc(100vh - 16px)); border-radius: 16px; }
  @supports (height: 100dvh) { .admin-panel { max-height: min(96dvh, calc(100dvh - 16px)); } }
  .admin-head { padding: 13px 14px; }
  .admin-tabs { flex-wrap: wrap; overflow-x: visible; gap: 7px; padding: 10px; }
  .admin-tab { flex: 1 1 auto; min-height: 44px; padding: 8px 12px; text-align: center; }
  .admin-chip { max-width: 100%; overflow-wrap: anywhere; }
  .admin-actions input { flex-basis: 100% !important; min-width: 0 !important; }
  .admin-btn { min-height: 44px; }
  .admin-card .ac-actions button { min-height: 40px; }
  .admin-field input, .admin-field textarea, .admin-field select, .admin-pin input { font-size: 16px; }
  .admin-login { padding: 30px 16px; }
  .admin-color-row input[type=color] { width: 46px; height: 44px; }
}
`

interface AdminSecretProps {
  products: Product[]
  categories: Category[]
}

type Tab = 'products' | 'orders' | 'content' | 'settings' | 'backup'

interface AdminOrder {
  order_number?: string
  orderNumber?: string
  status?: string
  created_at?: string
  customer?: string | Record<string, unknown>
  totals?: string | Record<string, number>
  items?: string | unknown[]
}

interface AdminMessage {
  id: number
  name?: string
  phone?: string
  message?: string
  created_at?: string
}

const parseJsonField = <T,>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

export function AdminSecret({ products, categories }: AdminSecretProps) {
  const [location, navigate] = useLocation()
  const [open, setOpen] = useState(false)
  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return true
    } catch {
      /* ignore */
    }
    return Boolean(getToken())
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usePinMode, setUsePinMode] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinAttempts, setPinAttempts] = useState(0)
  const [pinLockUntil, setPinLockUntil] = useState(0)
  const [tab, setTab] = useState<Tab>('products')
  const [editing, setEditing] = useState<Product | null>(null)
  const [toast, setToast] = useState('')
  const [overrides, setOverrides] = useState<Product[]>(() => readAdminProducts())
  const [removed, setRemoved] = useState<string[]>(() => readRemovedSlugs())
  const [content, setContent] = useState<SiteContent>(() => readSiteContent())
  const [customCategories, setCustomCategories] = useState<Category[]>(() => readAdminCategories())
  const [newCat, setNewCat] = useState('')
  const [settings, setSettings] = useState<StoreSettings>(() => readStoreSettings())
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [online, setOnline] = useState(false)
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [adminsLoaded, setAdminsLoaded] = useState(false)
  const [adminsBusy, setAdminsBusy] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', displayName: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const closePanel = () => {
    setOpen(false)
    if (location === '/admin') navigate('/', { replace: true })
  }

  useEffect(() => {
    setOpen(location === '/admin')
  }, [location])

  useEffect(() => {
    if (!open) return undefined
    let active = true
    void ping().then((ok) => {
      if (active) setOnline(ok)
    })
    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!getToken()) return
    void adminWhoami().catch(() => {
      /* 401 يُطلق حدث eva-admin-expired ويغلق الجلسة */
    })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onExpired = () => {
      setAuthed(false)
      try {
        window.sessionStorage.removeItem(SESSION_KEY)
      } catch {
        /* ignore */
      }
      setToast('انتهت الجلسة، سجّلي الدخول من جديد')
    }
    window.addEventListener('stv-admin-expired', onExpired)
    return () => window.removeEventListener('stv-admin-expired', onExpired)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const allProducts = useMemo(() => mergeAdminProducts(products), [products, overrides, removed])
  const allCategories = useMemo(() => [...categories, ...customCategories.filter((c) => !categories.some((x) => x.slug === c.slug))], [categories, customCategories])

  const enterAdmin = () => {
    setAuthed(true)
    setPin('')
    setPassword('')
    setUsername('')
    setPinError('')
    setPinAttempts(0)
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const pullFromServer = async () => {
    await loadServerConfig()
    setContent(readSiteContent())
    setSettings(readStoreSettings())
  }

  const submitLogin = async () => {
    if (pinLockUntil > Date.now()) {
      setPinError('عدد كبير من المحاولات، حاولي بعد دقيقة')
      return
    }
    const cleanUser = username.trim()
    const withUser = Boolean(cleanUser && password)
    if (!withUser && !pin) {
      setPinError('أدخلي بيانات الدخول')
      return
    }

    // 1) محاولة الدخول إلى الخادم أولاً
    try {
      await adminLogin(withUser ? { username: cleanUser, password } : { pin })
      setOnline(true)
      enterAdmin()
      try {
        await pullFromServer()
      } catch {
        /* المحتوى المحلي يبقى كنسخة احتياطية */
      }
      setToast('تم تسجيل الدخول إلى الخادم')
      return
    } catch (error) {
      if (error instanceof AdminRequestError) {
        // الخادم يستجيب والبيانات مرفوضة — لا يُستبدل بمدخل محلي
        const nextAttempts = pinAttempts + 1
        if (nextAttempts >= 5) {
          setPinAttempts(0)
          setPinLockUntil(Date.now() + 60_000)
          setPinError('تم إيقاف المحاولات لمدة دقيقة')
        } else {
          setPinAttempts(nextAttempts)
          setPinError(`${error.message} (${5 - nextAttempts} محاولات متبقية)`)
        }
        setPin('')
        setPassword('')
        return
      }
      setOnline(false)
      if (withUser) {
        setPinError('تعذر الوصول إلى الخادم، حاولي لاحقاً')
        return
      }
    }

    // 2) وضع محلي (بدون خادم) — عبر الرمز فقط
    const stored = (() => {
      try {
        return window.localStorage.getItem(PIN_KEY) || DEFAULT_PIN_HASH
      } catch {
        return DEFAULT_PIN_HASH
      }
    })()
    let matches = false
    if (/^[0-9a-f]{64}$/i.test(stored)) {
      try {
        matches = (await sha256Hex(pin)) === stored.toLowerCase()
      } catch {
        matches = false
      }
    } else {
      matches = pin === stored
      if (matches) {
        try {
          window.localStorage.setItem(PIN_KEY, await sha256Hex(pin))
        } catch {
          /* ترقية قديمة تفشل — يبقى المخزّن كما هو */
        }
      }
    }
    if (matches) {
      enterAdmin()
    } else {
      const nextAttempts = pinAttempts + 1
      if (nextAttempts >= 5) {
        setPinAttempts(0)
        setPinLockUntil(Date.now() + 60_000)
        setPinError('تم إيقاف المحاولات لمدة دقيقة')
      } else {
        setPinAttempts(nextAttempts)
        setPinError(`الرمز غير صحيح (${5 - nextAttempts} محاولات متبقية)`)
      }
      setPin('')
    }
  }

  useEffect(() => {
    if (pinLockUntil <= 0) return undefined
    const wait = pinLockUntil - Date.now()
    if (wait <= 0) {
      setPinLockUntil(0)
      return undefined
    }
    const timer = window.setTimeout(() => setPinLockUntil(0), wait)
    return () => window.clearTimeout(timer)
  }, [pinLockUntil])

  const logout = () => {
    setAuthed(false)
    void adminLogout()
    setOnline(false)
    try {
      window.sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    closePanel()
  }

  useEffect(() => {
    if (!authed || tab !== 'settings' || adminsLoaded) return
    let active = true
    void listAdmins()
      .then((rows) => {
        if (!active) return
        setAdmins(rows)
        setAdminsLoaded(true)
      })
      .catch(() => {
        if (active) setAdminsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [authed, tab, adminsLoaded])

  const refreshAdmins = async (): Promise<void> => {
    try {
      setAdmins(await listAdmins())
      setAdminsLoaded(true)
    } catch {
      /* يبقى القائمة السابقة */
    }
  }

  const addAdmin = async () => {
    const u = newAdmin.username.trim().toLowerCase()
    if (!/^[a-z0-9_.-]{3,24}$/.test(u)) {
      setToast('اسم المستخدم: 3-24 حرفاً لاتينياً')
      return
    }
    if (newAdmin.password.length < 6) {
      setToast('كلمة المرور: 6 أحرف على الأقل')
      return
    }
    setAdminsBusy(true)
    try {
      await createAdminAccount({ username: u, password: newAdmin.password, displayName: newAdmin.displayName.trim() })
      setNewAdmin({ username: '', password: '', displayName: '' })
      setToast('تمت إضافة المدير')
      await refreshAdmins()
    } catch (error) {
      setToast(error instanceof AdminRequestError ? error.message : 'تعذّرت إضافة المدير')
    } finally {
      setAdminsBusy(false)
    }
  }

  const removeAdmin = async (account: AdminAccount) => {
    if (admins.length <= 1) {
      setToast('لا يمكن حذف آخر مدير في المتجر')
      return
    }
    if (!window.confirm(`حذف المدير "${account.username}"؟ سيتم إلغاء جلساته فوراً.`)) return
    setAdminsBusy(true)
    try {
      await deleteAdminAccount(account.id)
      setToast('تم حذف المدير')
      await refreshAdmins()
    } catch (error) {
      setToast(error instanceof AdminRequestError ? error.message : 'تعذّر الحذف')
    } finally {
      setAdminsBusy(false)
    }
  }

  const resetAdminPassword = async (account: AdminAccount) => {
    const next = window.prompt(`كلمة مرور جديدة للمدير "${account.username}" (6 أحرف على الأقل):`)
    if (next === null) return
    if (next.length < 6) {
      setToast('كلمة المرور: 6 أحرف على الأقل')
      return
    }
    setAdminsBusy(true)
    try {
      await changeAdminPassword(account.id, next)
      setToast('تم تغيير كلمة المرور وإلغاء جلساته')
    } catch (error) {
      setToast(error instanceof AdminRequestError ? error.message : 'تعذّر تغيير كلمة المرور')
    } finally {
      setAdminsBusy(false)
    }
  }

  const loadOrders = async () => {
    if (ordersLoading) return
    setOrdersLoading(true)
    setOrdersError('')
    try {
      const [rows, inbox] = await Promise.all([
        adminFetch<AdminOrder[]>('/api/admin/orders'),
        adminFetch<AdminMessage[]>('/api/admin/contacts').catch(() => [] as AdminMessage[]),
      ])
      setOrders(Array.isArray(rows) ? rows : [])
      setMessages(Array.isArray(inbox) ? inbox : [])
      setOnline(true)
    } catch (error) {
      setOrdersError(error instanceof AdminRequestError ? error.message : 'تعذر الوصول إلى الخادم')
    } finally {
      setOrdersLoading(false)
    }
  }

  const deleteMessage = async (id: number) => {
    if (!window.confirm('حذف هذه الرسالة؟')) return
    try {
      await adminFetch(`/api/admin/contacts/${id}`, { method: 'DELETE' })
      setMessages((current) => current.filter((row) => row.id !== id))
      setToast('تم حذف الرسالة')
    } catch {
      setToast('تعذر حذف الرسالة من الخادم')
    }
  }

  const setOrderStatus = async (number: string, status: string) => {
    const previous = orders
    setOrders((current) => current.map((row) => ((row.order_number || row.orderNumber) === number ? { ...row, status } : row)))
    try {
      await adminFetch(`/api/admin/orders/${encodeURIComponent(number)}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setToast('تم تحديث حالة الطلب')
    } catch {
      setOrders(previous)
      setToast('تعذر التحديث على الخادم')
    }
  }

  const pushProductToServer = (product: Product) => {
    const payload = { ...product, images: product.images.filter((src) => !src.startsWith('data:')), image: product.image.startsWith('data:') ? (product.images.find((src) => !src.startsWith('data:')) || '') : product.image }
    void adminFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) })
      .then(() => setToast('تم حفظ المنتج في الخادم'))
      .catch((error) => setToast(error instanceof AdminRequestError ? error.message : 'حُفظ محلياً — تعذر الوصول للخادم'))
  }

  const saveSettings = async () => {
    try {
      await pushServerSettings(settings as unknown as Record<string, unknown>)
      setToast('تم حفظ الإعدادات في الخادم')
    } catch {
      setToast('حُفظت محلياً — تعذر الوصول للخادم')
    }
  }

  const savePin = async (raw: string): Promise<boolean> => {
    const value = raw.trim()
    if (!/^\d{4,12}$/.test(value)) {
      setToast('الرمز يجب أن يكون من 4 إلى 12 رقماً')
      return false
    }
    try {
      window.localStorage.setItem(PIN_KEY, await sha256Hex(value))
    } catch {
      try { window.localStorage.setItem(PIN_KEY, value) } catch { /* ignore */ }
    }
    try {
      await adminFetch('/api/admin/pin', { method: 'POST', body: JSON.stringify({ pin: value }) })
      setToast('تم تغيير الرمز في الخادم')
    } catch {
      setToast('حُفظ الرمز محلياً — الخادم غير متصل')
    }
    return true
  }

  const persistProducts = (next: Product[]) => {
    setOverrides(next)
    writeJson(PRODUCTS_KEY, next)
  }

  const persistRemoved = (next: string[]) => {
    setRemoved(next)
    writeJson(REMOVED_KEY, next)
  }

  const saveProduct = (product: Product) => {
    const slug = product.slug.trim() || `custom-${Date.now()}`
    const clean: Product = {
      ...product,
      slug,
      id: slug,
      name: product.name.trim(),
      price: Math.max(0, Number(product.price) || 0),
      stock: Math.max(0, Number(product.stock) || 0),
      image: product.image || product.images[0] || '',
      images: product.images.length ? product.images : (product.image ? [product.image] : []),
    }
    const rest = overrides.filter((item) => item.slug !== slug && item.id !== clean.id)
    persistProducts([clean, ...rest])
    if (removed.includes(slug)) persistRemoved(removed.filter((item) => item !== slug))
    setEditing(null)
    pushProductToServer(clean)
    if (!overrides.some((item) => item.slug === slug)) setToast('تمت إضافة المنتج')
  }

  const deleteProduct = (product: Product) => {
    if (!window.confirm(`حذف «${product.name || product.slug}» من المتجر؟`)) return
    if (overrides.some((item) => item.slug === product.slug)) {
      persistProducts(overrides.filter((item) => item.slug !== product.slug))
    }
    if (!removed.includes(product.slug)) persistRemoved([...removed, product.slug])
    void adminFetch(`/api/admin/products/${encodeURIComponent(product.slug)}`, { method: 'DELETE' })
      .then(() => setToast('تم حذف المنتج'))
      .catch(() => setToast('أُخفي المنتج من المتجر — تعذر حفظه في الخادم'))
  }

  const uploadImages = async (files: FileList | null) => {
    if (!files || !files.length || !editing) return
    const list = await Promise.all(Array.from(files).slice(0, 6).map(toFileDataUrl))
    const valid = list.filter((item) => item.length > 200)
    if (!valid.length) return
    setToast('جارٍ رفع الصور...')
    const uploaded: string[] = []
    let failed = 0
    for (const dataUrl of valid) {
      try {
        const result = await adminFetch<{ url?: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl, product: editing.slug }),
        })
        if (result?.url) uploaded.push(result.url)
        else failed += 1
      } catch {
        failed += 1
      }
    }
    if (uploaded.length) {
      const next = { ...editing, images: [...editing.images, ...uploaded].slice(0, 8) }
      if (!next.image) next.image = uploaded[0]
      setEditing(next)
    }
    if (failed) setToast(`تعذر رفع ${failed} صورة، حاول مرة أخرى`)
    else setToast('تم رفع الصور بنجاح')
  }

  const restoreAll = async () => {
    const edited = overrides
    const restoreSlugs = removed
    persistProducts([])
    persistRemoved([])
    const originalBySlug = new Map(fallbackProducts.map((item) => [item.slug, item]))
    let failed = 0
    for (const item of edited) {
      const original = originalBySlug.get(item.slug)
      if (!original) continue
      try {
        await adminFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(original) })
      } catch {
        failed += 1
      }
    }
    if (restoreSlugs.length) {
      try {
        await adminFetch('/api/admin/restore', { method: 'POST', body: JSON.stringify({ slugs: restoreSlugs }) })
      } catch {
        failed += 1
      }
    }
    setToast(failed ? 'تمت الاستعادة محلياً — تعذر الوصول للخادم' : 'تمت استعادة المنتجات الأصلية')
  }

  const exportData = () => {
    const payload = { products: overrides, removed, categories: customCategories, content, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eva-store-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setToast('تم تنزيل النسخة الاحتياطية')
  }

  const importData = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object') throw new Error('bad')
      if (parsed.products) persistProducts(sanitizeProducts(parsed.products))
      if (parsed.removed) persistRemoved(readSlugList(parsed.removed))
      if (parsed.categories) {
        const next = sanitizeCategories(parsed.categories)
        setCustomCategories(next)
        writeJson(CATEGORIES_KEY, next)
      }
      if (parsed.content && typeof parsed.content === 'object' && parsed.content !== null) {
        const raw = parsed.content as Record<string, unknown>
        const clean: Partial<SiteContent> = {}
        for (const key of Object.keys(defaultSiteContent) as (keyof SiteContent)[]) {
          const value = raw[key]
          if (key === 'emailProvider') {
            if (value === 'mailto' || value === 'formsubmit') clean.emailProvider = value
            continue
          }
          if (typeof value === 'string') clean[key] = value.slice(0, 6000)
        }
        const next = { ...content, ...clean }
        setContent(next)
        writeJson(CONTENT_KEY, next)
      }
      setToast('تم استيراد البيانات')
    } catch {
      setToast('ملف غير صالح')
    }
  }

  const saveContent = async () => {
    writeJson(CONTENT_KEY, content)
    try {
      await pushServerContent(content as unknown as Record<string, unknown>)
      setToast('تم حفظ المحتوى في الخادم')
    } catch {
      setToast('حُفظ محلياً — تعذر الوصول للخادم')
    }
  }

  const addCategory = () => {
    const name = newCat.trim()
    if (!name) return
    const slug = `cat-${Date.now()}`
    const next = [...customCategories, { id: slug, slug, name, description: name, image: '', accent: '#a34163' }]
    setCustomCategories(next)
    writeJson(CATEGORIES_KEY, next)
    setNewCat('')
    setToast('تمت إضافة التصنيف')
  }

  const removeCategory = (slug: string) => {
    const next = customCategories.filter((item) => item.slug !== slug)
    setCustomCategories(next)
    writeJson(CATEGORIES_KEY, next)
  }

  const setField = (key: keyof Product, value: unknown) => {
    if (!editing) return
    setEditing({ ...editing, [key]: value } as Product)
  }

  return (
    <>
      <style>{adminStyles}</style>
      {open && (
        <div className="admin-layer" role="dialog" aria-modal="true" aria-label="لوحة التحكم">
          <div className="admin-panel">
            <div className="admin-head">
              <h2>
                <ShieldCheck size={17} />
                <span>
                  لوحة التحكم
                  <small>{authed ? 'مساحة الإدارة السرية' : 'دخول محمي'}</small>
                </span>
              </h2>
              <div style={{ display: 'flex', gap: 7 }}>
                {authed && (
                  <button type="button" className="admin-btn ghost" style={{ padding: '6px 11px', fontSize: 12 }} onClick={logout}>
                    <LogOut size={14} /> خروج
                  </button>
                )}
                <button type="button" className="admin-btn ghost" style={{ padding: '6px 9px' }} onClick={closePanel} aria-label="إغلاق">
                  <X size={16} />
                </button>
              </div>
            </div>

            {!authed ? (
              <div className="admin-login">
                <span className="lock"><Lock size={22} /></span>
                <h3>تسجيل الدخول كمدير</h3>
                <p>{usePinMode ? 'أدخلي رمز الدخول السريع، أو استخدمي اسم المستخدم وكلمة المرور.' : 'أدخلي اسم المستخدم وكلمة المرور الدائمين للوصول إلى لوحة إدارة المنتجات والمحتوى.'}</p>
                {usePinMode ? (
                  <div className="admin-pin">
                    <input
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      onChange={(event) => { setPin(event.target.value); setPinError('') }}
                      onKeyDown={(event) => { if (event.key === 'Enter') void submitLogin() }}
                      placeholder="••••"
                      maxLength={12}
                      autoFocus
                      aria-label="رمز الدخول"
                    />
                    <button type="button" className="admin-btn" onClick={() => void submitLogin()} disabled={pinLockUntil > Date.now()}>
                      <Lock size={15} /> دخول
                    </button>
                  </div>
                ) : (
                  <div className="admin-credentials">
                    <input
                      value={username}
                      onChange={(event) => { setUsername(event.target.value); setPinError('') }}
                      placeholder="اسم المستخدم"
                      autoComplete="username"
                      autoFocus
                      aria-label="اسم المستخدم"
                      dir="ltr"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); setPinError('') }}
                      onKeyDown={(event) => { if (event.key === 'Enter') void submitLogin() }}
                      placeholder="كلمة المرور"
                      autoComplete="current-password"
                      aria-label="كلمة المرور"
                      dir="ltr"
                    />
                    <button type="button" className="admin-btn" onClick={() => void submitLogin()} disabled={pinLockUntil > Date.now()}>
                      <Lock size={15} /> دخول
                    </button>
                  </div>
                )}
                {pinError && <p style={{ color: '#a3193f', fontWeight: 700, fontSize: 12.5 }}>{pinError}</p>}
                <button
                  type="button"
                  className="admin-btn ghost"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={() => { setUsePinMode(!usePinMode); setPinError(''); setPin(''); setPassword(''); setUsername('') }}
                >
                  {usePinMode ? 'الدخول باسم المستخدم وكلمة المرور' : 'الدخول بالرمز السريع'}
                </button>
              </div>
            ) : (
              <>
                <div className="admin-tabs" role="tablist">
                  <button type="button" className={`admin-tab${tab === 'products' ? ' is-active' : ''}`} onClick={() => setTab('products')} role="tab">
                    المنتجات
                  </button>
                  <button type="button" className={`admin-tab${tab === 'orders' ? ' is-active' : ''}`} onClick={() => { setTab('orders'); void loadOrders() }} role="tab">
                    الطلبات
                  </button>
                  <button type="button" className={`admin-tab${tab === 'content' ? ' is-active' : ''}`} onClick={() => setTab('content')} role="tab">
                    المحتوى
                  </button>
                  <button type="button" className={`admin-tab${tab === 'settings' ? ' is-active' : ''}`} onClick={() => setTab('settings')} role="tab">
                    الإعدادات
                  </button>
                  <button type="button" className={`admin-tab${tab === 'backup' ? ' is-active' : ''}`} onClick={() => setTab('backup')} role="tab">
                    النسخ الاحتياطي
                  </button>
                </div>

                <div className="admin-body">
                  {editing ? (
                    <div>
                      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 14 }}>
                        <button type="button" className="admin-btn ghost" onClick={() => setEditing(null)}>
                          <X size={15} /> رجوع للقائمة
                        </button>
                        <span className="admin-chip">{overrides.some((item) => item.slug === editing.slug) ? 'تعديل منتج' : 'منتج جديد'}</span>
                      </div>

                      <div className="admin-thumb-row" style={{ marginBottom: 14 }}>
                        {editing.images.map((src, index) => (
                          <div className="admin-thumb" key={`${src.slice(0, 24)}-${index}`}>
                            <img src={src} alt="" />
                            <button
                              type="button"
                              aria-label="حذف الصورة"
                              onClick={() => setField('images', editing.images.filter((_, i) => i !== index))}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="admin-btn ghost" style={{ height: 74, padding: '0 14px' }} onClick={() => fileRef.current?.click()}>
                          <Upload size={15} /> رفع صور
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => void uploadImages(event.target.files)} />
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label>اسم المنتج *</label>
                          <input value={editing.name} onChange={(event) => setField('name', event.target.value)} placeholder="مثال: قماش كتان" />
                        </div>
                        <div className="admin-field">
                          <label>الرابط (slug)</label>
                          <input value={editing.slug} onChange={(event) => setField('slug', event.target.value)} dir="ltr" placeholder="cotton-fabric" />
                        </div>
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label>السعر (دينار) *</label>
                          <input type="number" min={0} value={editing.price} onChange={(event) => setField('price', Number(event.target.value))} dir="ltr" />
                        </div>
                        <div className="admin-field">
                          <label>المخزون (قطعة)</label>
                          <input type="number" min={0} value={editing.stock} onChange={(event) => setField('stock', Number(event.target.value))} dir="ltr" />
                        </div>
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label>التصنيف</label>
                          <select value={editing.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                            {allCategories.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="admin-field">
                          <label>النوع</label>
                          <input value={editing.type} onChange={(event) => setField('type', event.target.value)} />
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>الوصف</label>
                        <textarea value={editing.description} onChange={(event) => setField('description', event.target.value)} />
                      </div>

                      <div className="admin-field">
                        <label>المقاسات (افصل بفاصلة)</label>
                        <input
                          dir="rtl"
                          value={editing.sizes.join(', ')}
                          onChange={(event) => setField('sizes', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                          placeholder="S, M, L, XL, XXL أو 39, 40, 41, 42, 43"
                        />
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label>العلامة التجارية</label>
                          <input value={editing.specs.brand} onChange={(event) => setField('specs', { ...editing.specs, brand: event.target.value })} />
                        </div>
                        <div className="admin-field">
                          <label>الجنس</label>
                          <select value={editing.specs.gender} onChange={(event) => setField('specs', { ...editing.specs, gender: event.target.value })}>
                            <option value="unisex">رجالي/نسائي (unisex)</option>
                            <option value="men">رجالي</option>
                            <option value="women">نسائي</option>
                            <option value="kids">أطفال</option>
                          </select>
                        </div>
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label>الخامة</label>
                          <input value={editing.specs.material} onChange={(event) => setField('specs', { ...editing.specs, material: event.target.value })} placeholder="بوليستر، قطن..." />
                        </div>
                        <div className="admin-field">
                          <label>بلد المنشأ</label>
                          <input value={editing.specs.origin} onChange={(event) => setField('specs', { ...editing.specs, origin: event.target.value })} />
                        </div>
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label>العناية</label>
                          <input value={editing.specs.care} onChange={(event) => setField('specs', { ...editing.specs, care: event.target.value })} />
                        </div>
                        <div className="admin-field">
                          <label>الاستخدام</label>
                          <input value={editing.specs.use} onChange={(event) => setField('specs', { ...editing.specs, use: event.target.value })} />
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>الضمان</label>
                        <input value={editing.specs.warranty} onChange={(event) => setField('specs', { ...editing.specs, warranty: event.target.value })} />
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="checkbox" checked={editing.isNew} onChange={(event) => setField('isNew', event.target.checked)} style={{ width: 16, height: 16 }} />
                            منتج جديد
                          </label>
                        </div>
                        <div className="admin-field">
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="checkbox" checked={editing.isFeatured} onChange={(event) => setField('isFeatured', event.target.checked)} style={{ width: 16, height: 16 }} />
                            مميز
                          </label>
                        </div>
                      </div>

                      <div className="admin-row">
                        <div className="admin-field">
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="checkbox" checked={editing.colorsEnabled !== false} onChange={(event) => setField('colorsEnabled', event.target.checked)} style={{ width: 16, height: 16 }} />
                            إظهار خيارات الألوان لهذا المنتج
                          </label>
                        </div>
                        <div className="admin-field">
                          <label>مصدر الصور</label>
                          <input value={editing.sourceUrl || ''} onChange={(event) => setField('sourceUrl', event.target.value)} dir="ltr" placeholder="رابط منشور إنستغرام (اختياري)" />
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>الألوان</label>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {editing.colors.map((color, index) => (
                            <div key={color.id} style={{ border: '1px solid var(--stv-line)', borderRadius: 12, padding: 8, display: 'grid', gap: 8 }}>
                              <div className="admin-color-row">
                                <input
                                  type="color"
                                  value={/^#[0-9a-fA-F]{6}$/.test(color.hex) ? color.hex : '#111113'}
                                  onChange={(event) => {
                                    const next = [...editing.colors]
                                    next[index] = { ...color, hex: event.target.value }
                                    setField('colors', next)
                                  }}
                                  aria-label={`لون ${index + 1}`}
                                />
                                <input
                                  value={color.name}
                                  onChange={(event) => {
                                    const next = [...editing.colors]
                                    next[index] = { ...color, name: event.target.value }
                                    setField('colors', next)
                                  }}
                                  placeholder="اسم اللون"
                                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--stv-line-strong)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13 }}
                                />
                                <label className="admin-field" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                  <input
                                    type="checkbox"
                                    checked={color.available}
                                    onChange={(event) => {
                                      const next = [...editing.colors]
                                      next[index] = { ...color, available: event.target.checked }
                                      setField('colors', next)
                                    }}
                                    style={{ width: 15, height: 15 }}
                                  />
                                  متوفر
                                </label>
                                <button
                                  type="button"
                                  className="admin-btn ghost"
                                  style={{ padding: '7px 9px' }}
                                  disabled={editing.colors.length <= 1}
                                  onClick={() => setField('colors', editing.colors.filter((_, i) => i !== index))}
                                  aria-label="حذف اللون"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="admin-color-img">
                                <span className="cc-preview" title="صورة هذا اللون">
                                  {color.image ? <img src={color.image} alt={color.name} /> : <ImageIcon size={16} />}
                                  {color.image && (
                                    <button type="button" aria-label="حذف صورة اللون" onClick={() => {
                                      const next = [...editing.colors]
                                      next[index] = { ...color, image: '' }
                                      setField('colors', next)
                                    }}><X size={10} /></button>
                                  )}
                                </span>
                                <label className="cc-pick">
                                  <Upload size={13} />
                                  {color.image ? 'تغيير صورة اللون' : 'صورة للون'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={async (event) => {
                                      const file = event.target.files?.[0]
                                      event.target.value = ''
                                      if (!file) return
                                      try {
                                        const dataUrl = await toFileDataUrl(file)
                                        const result = await adminFetch<{ url?: string }>('/api/admin/upload', {
                                          method: 'POST',
                                          body: JSON.stringify({ dataUrl, product: editing.slug }),
                                        })
                                        if (!result?.url) throw new Error('upload-failed')
                                        const next = [...editing.colors]
                                        next[index] = { ...color, image: result.url }
                                        setField('colors', next)
                                        setToast('تم رفع صورة اللون')
                                      } catch {
                                        setToast('تعذر رفع صورة اللون')
                                      }
                                    }}
                                  />
                                </label>
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={color.image?.startsWith('data:') ? '' : color.image || ''}
                                  placeholder="أو رابط صورة (https://...)"
                                  onChange={(event) => {
                                    const next = [...editing.colors]
                                    next[index] = { ...color, image: event.target.value }
                                    setField('colors', next)
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="admin-btn ghost"
                            onClick={() => setField('colors', [...editing.colors, { id: `color-${editing.colors.length + 1}-${Date.now()}`, name: 'لون جديد', hex: '#111113', available: true, stock: editing.stock }])}
                          >
                            <Plus size={14} /> إضافة لون
                          </button>
                        </div>
                      </div>

                      <div className="admin-actions">
                        <button type="button" className="admin-btn success" onClick={() => saveProduct(editing)} disabled={!editing.name.trim()}>
                          <Save size={15} /> حفظ المنتج
                        </button>
                        <button type="button" className="admin-btn ghost" onClick={() => setEditing(null)}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : tab === 'products' ? (
                    <div>
                      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 14 }}>
                        <button type="button" className="admin-btn" onClick={() => setEditing(emptyProduct())}>
                          <Plus size={15} /> إضافة منتج جديد
                        </button>
                        <button type="button" className="admin-btn ghost" onClick={restoreAll}>
                          <RotateCcw size={15} /> استعادة الأصلية
                        </button>
                        <span className="admin-chip">{allProducts.length} منتج</span>
                      </div>
                      <div className="admin-grid">
                        {allProducts.map((product) => (
                          <div className="admin-card" key={product.slug}>
                            <img src={product.image} alt="" loading="lazy" />
                            <div className="ac-body">
                              <strong>{product.name}</strong>
                              <span className="ac-price">{product.price > 0 ? formatPrice(product.price) : <em style={{ fontStyle: 'normal', color: '#a3701f' }}>السعر عند التأكيد</em>}</span>
                              <span className="admin-chip" style={{ justifySelf: 'start' }}>{product.colorsEnabled === false ? 'الألوان مخفية' : `${product.colors.length} لون`}</span>
                              <div className="ac-actions">
                                <button type="button" onClick={() => setEditing({ ...product, colors: product.colors.length ? product.colors : emptyProduct().colors, images: product.images.length ? product.images : [product.image] })}>
                                  <Pencil size={13} /> تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...product, colorsEnabled: product.colorsEnabled === false }
                                    persistProducts(overrides.some((item) => item.slug === product.slug)
                                      ? overrides.map((item) => (item.slug === product.slug ? next : item))
                                      : [next, ...overrides])
                                    pushProductToServer(next)
                                    setToast(next.colorsEnabled === false ? 'تم إخفاء ألوان المنتج' : 'تم إظهار ألوان المنتج')
                                  }}
                                  title="تفعيل/إخفاء ألوان هذا المنتج"
                                >
                                  {product.colorsEnabled === false ? <EyeOff size={13} /> : <Eye size={13} />} الألوان
                                </button>
                                <button type="button" className="danger" onClick={() => deleteProduct(product)}>
                                  <Trash2 size={13} /> حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : tab === 'content' ? (
                    <div>
                      <div className="admin-note" style={{ marginBottom: 14 }}>
                        عدّل نصوص وبيانات المتجر. تُحفظ التعديلات فوراً في متصفحك وتنعكس على الواجهة مباشرة.
                      </div>
                      <div className="admin-field" style={{ marginBottom: 16 }}>
                        <label>التصنيفات</label>
                        <div className="admin-actions" style={{ marginTop: 0 }}>
                          <input value={newCat} onChange={(event) => setNewCat(event.target.value)} placeholder="اسم تصنيف جديد" style={{ flex: 1, minWidth: 160, padding: '9px 11px', border: '1px solid var(--stv-line-strong)', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5 }} />
                          <button type="button" className="admin-btn" onClick={addCategory}>
                            <Plus size={14} /> إضافة
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                          {allCategories.map((item) => (
                            <span className="admin-chip" key={item.id}>
                              {item.name}
                              {customCategories.some((c) => c.slug === item.slug) && (
                                <button type="button" onClick={() => removeCategory(item.slug)} aria-label="حذف التصنيف">
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="admin-row">
                        <div className="admin-field">
                          <label>اسم المتجر</label>
                          <input value={content.shopName} onChange={(event) => setContent({ ...content, shopName: event.target.value })} />
                        </div>
                        <div className="admin-field">
                          <label>رقم الهاتف</label>
                          <input value={content.phone} onChange={(event) => setContent({ ...content, phone: event.target.value })} dir="ltr" />
                        </div>
                      </div>
                      <div className="admin-row">
                        <div className="admin-field">
                          <label>رقم تواصل إضافي (دولي بدون +)</label>
                          <input value={content.whatsapp} onChange={(event) => setContent({ ...content, whatsapp: event.target.value })} dir="ltr" />
                        </div>
                        <div className="admin-field">
                          <label>رابط إنستغرام</label>
                          <input value={content.instagram} onChange={(event) => setContent({ ...content, instagram: event.target.value })} dir="ltr" />
                        </div>
                      </div>
                      <div className="admin-row">
                        <div className="admin-field">
                          <label>الشريط العلوي (يمين)</label>
                          <input value={content.announcementRight} onChange={(event) => setContent({ ...content, announcementRight: event.target.value })} />
                        </div>
                        <div className="admin-field">
                          <label>الشريط العلوي (يسار)</label>
                          <input value={content.announcementLeft} onChange={(event) => setContent({ ...content, announcementLeft: event.target.value })} />
                        </div>
                      </div>
                      <div className="admin-field">
                        <label>عنوان صفحة من نحن (رئيسي)</label>
                        <input value={content.aboutTitle} onChange={(event) => setContent({ ...content, aboutTitle: event.target.value })} />
                      </div>
                      <div className="admin-field">
                        <label>نص صفحة من نحن</label>
                        <textarea value={content.aboutText} onChange={(event) => setContent({ ...content, aboutText: event.target.value })} />
                      </div>
                      <div className="admin-field">
                        <label>عنوان صفحة تواصل معنا</label>
                        <input value={content.contactTitle} onChange={(event) => setContent({ ...content, contactTitle: event.target.value })} />
                      </div>
                      <div className="admin-field">
                        <label>نص صفحة تواصل معنا</label>
                        <textarea value={content.contactText} onChange={(event) => setContent({ ...content, contactText: event.target.value })} />
                      </div>

                      {groupFields.map((group) => (
                        <div key={group.title} style={{ marginTop: 16 }}>
                          <div className="admin-note" style={{ marginBottom: 8, fontWeight: 700, color: 'var(--stv-ink, #30262a)' }}>{group.title}</div>
                          {group.fields.map((field) => (
                            <div className="admin-field" key={field.key}>
                              <label>{field.label}</label>
                              {field.area
                                ? <textarea value={content[field.key]} onChange={(event) => setContent({ ...content, [field.key]: event.target.value })} />
                                : <input value={content[field.key]} onChange={(event) => setContent({ ...content, [field.key]: event.target.value })} />}
                              {field.hint && <small style={{ display: 'block', marginTop: 4, color: 'var(--stv-muted)', fontSize: 11 }}>{field.hint}</small>}
                            </div>
                          ))}
                        </div>
                      ))}


<div style={{ marginTop: 20, padding: 14, border: '1px solid var(--stv-line-strong)', borderRadius: 12 }}>
                        <div className="admin-note" style={{ marginBottom: 10, fontWeight: 700, color: 'var(--stv-ink, #30262a)' }}>استقبال الطلبات بالبريد الإلكتروني</div>
                        <div className="admin-note" style={{ marginBottom: 12 }}>
                          كل طلب يُرسل تلقائياً إلى هذا البريد عند تأكيد الزبون. الوضع الافتراضي (FormSubmit) يرسل الرسالة مباشرة إلى بريدك دون أي تسجيل مسبق.
                        </div>
                        <div className="admin-row">
                          <div className="admin-field">
                            <label>بريد استقبال الطلبات</label>
                            <input
                              value={content.emailOrdersTo}
                              onChange={(event) => setContent({ ...content, emailOrdersTo: event.target.value })}
                              dir="ltr"
                              inputMode="email"
                              type="email"
                              placeholder="your-email@example.com"
                            />
                          </div>
                          <div className="admin-field">
                            <label>اسم المرسل</label>
                            <input value={content.emailFromName} onChange={(event) => setContent({ ...content, emailFromName: event.target.value })} />
                          </div>
                        </div>
                        <div className="admin-row">
                          <div className="admin-field">
                            <label>طريقة الإرسال</label>
                            <select
                              value={content.emailProvider}
                              onChange={(event) => setContent({ ...content, emailProvider: event.target.value as SiteContent['emailProvider'] })}
                            >
                              <option value="formsubmit">FormSubmit — إرسال مباشر (موصى به)</option>
                              <option value="mailto">برامج البريد — يفتح تطبيق البريد</option>
                            </select>
                          </div>
                          <div className="admin-field">
                            <label>بريد الرد على الزبون (اختياري)</label>
                            <input
                              value={content.emailFrom}
                              onChange={(event) => setContent({ ...content, emailFrom: event.target.value })}
                              dir="ltr"
                              type="email"
                              placeholder="name@example.com"
                            />
                          </div>
                        </div>
                        {content.emailProvider === 'formsubmit' && (
                          <div className="admin-field">
                            <label>رابط خدمة الإرسال</label>
                            <input
                              value={content.emailFormSubmitAction}
                              onChange={(event) => setContent({ ...content, emailFormSubmitAction: event.target.value })}
                              dir="ltr"
                            />
                            <small style={{ display: 'block', marginTop: 4, color: 'var(--stv-muted)', fontSize: 11 }}>
                              اتركه كما هو: https://formsubmit.co/your-email@example.com — أو استبدل your-email@example.com ببريدك.
                            </small>
                          </div>
                        )}
                        <div className="admin-field">
                          <label>موضوع الإيميل</label>
                          <input value={content.emailSubjectOrder} onChange={(event) => setContent({ ...content, emailSubjectOrder: event.target.value })} dir="ltr" />
                          <small style={{ display: 'block', marginTop: 4, color: 'var(--stv-muted)', fontSize: 11 }}>استخدم {'{orderNumber}'} لرقم الطلب.</small>
                        </div>
                        <div className="admin-field">
                          <label>قالب نص الإيميل (اختياري)</label>
                          <textarea
                            rows={6}
                            value={content.emailTemplateOrder}
                            onChange={(event) => setContent({ ...content, emailTemplateOrder: event.target.value })}
                            placeholder="اتركه فارغاً لاستخدام القالب الافتراضي المفصّل"
                            style={{ width: '100%', minHeight: 110, padding: '9px 11px', border: '1px solid var(--stv-line-strong)', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' }}
                          />
                          <small style={{ display: 'block', marginTop: 4, color: 'var(--stv-muted)', fontSize: 11 }}>
                            المتغيرات: {'{orderNumber} {name} {phone} {email} {governorate} {district} {address} {landmark} {notes} {items} {subtotal} {delivery} {total} {date} {shop}'}
                          </small>
                        </div>
                      </div>

                      <div className="admin-actions">
                        <button type="button" className="admin-btn success" onClick={saveContent}>
                          <Save size={15} /> حفظ المحتوى
                        </button>
                        <button type="button" className="admin-btn" onClick={() => { setContent({ ...defaultSiteContent }); setToast('تمت استعادة النصوص الافتراضية، اضغطي حفظ') }}>
                          <RotateCcw size={15} /> استعادة النصوص الافتراضية
                        </button>
                      </div>
                    </div>
                  ) : tab === 'orders' ? (
                    <div>
                      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 14 }}>
                        <button type="button" className="admin-btn" onClick={() => void loadOrders()} disabled={ordersLoading}>
                          <RotateCcw size={15} /> {ordersLoading ? 'جارٍ التحديث...' : 'تحديث الطلبات'}
                        </button>
                        <span className="admin-chip">{orders.length} طلب</span>
                      </div>
                      {ordersError && <div className="admin-note" role="alert">{ordersError}</div>}
                      {!ordersError && !orders.length && !ordersLoading && <div className="admin-note">لا توجد طلبات بعد. أول طلب يظهر هنا فور تأكيده من المتجر.</div>}
                      <div className="admin-list">
                        {orders.map((row) => {
                          const number = row.order_number || row.orderNumber || ''
                          const customer = parseJsonField<Record<string, unknown>>(row.customer, {})
                          const totals = parseJsonField<Record<string, number>>(row.totals, {})
                          const items = parseJsonField<unknown[]>(row.items, [])
                          const name = typeof customer.name === 'string' ? customer.name : ''
                          const phone = typeof customer.phone === 'string' ? customer.phone : ''
                          const statuses: { key: string; label: string }[] = [
                            { key: 'new', label: 'جديد' },
                            { key: 'contacted', label: 'تم التواصل' },
                            { key: 'shipped', label: 'تم الشحن' },
                            { key: 'done', label: 'مكتمل' },
                          ]
                          return (
                            <div className="admin-list-item" key={number} style={{ display: 'grid', gap: 8 }}>
                              <div className="li-main">
                                <strong dir="ltr">{number}</strong>
                                <small>{[name, phone].filter(Boolean).join(' · ')}{row.created_at ? ` · ${row.created_at}` : ''}</small>
                                <small>{Array.isArray(items) ? items.length : 0} قطعة · {formatPrice(Number(totals.total) || 0)}</small>
                              </div>
                              <div className="admin-actions" style={{ marginTop: 0 }}>
                                {statuses.map((status) => (
                                  <button
                                    key={status.key}
                                    type="button"
                                    className={`admin-btn${row.status === status.key ? ' success' : ' ghost'}`}
                                    style={{ padding: '6px 10px', fontSize: 11.5 }}
                                    onClick={() => void setOrderStatus(number, status.key)}
                                  >
                                    {status.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ marginTop: 24 }}>
                        <div className="admin-actions" style={{ marginTop: 0, marginBottom: 10 }}>
                          <strong style={{ fontSize: 13.5 }}>رسائل التواصل</strong>
                          <span className="admin-chip">{messages.length} رسالة</span>
                        </div>
                        {!messages.length && <div className="admin-note">لا توجد رسائل بعد. تصل رسائل صفحة «تواصلي معنا» هنا.</div>}
                        <div className="admin-list">
                          {messages.map((row) => (
                            <div className="admin-list-item" key={row.id} style={{ display: 'grid', gap: 6 }}>
                              <div className="li-main">
                                <strong>{row.name || 'بدون اسم'}</strong>
                                <small dir="ltr">{[row.phone, row.created_at].filter(Boolean).join(' · ')}</small>
                                <small style={{ whiteSpace: 'pre-wrap' }}>{row.message}</small>
                              </div>
                              <button
                                type="button"
                                className="admin-btn ghost"
                                style={{ padding: '6px 10px', fontSize: 11.5 }}
                                onClick={() => void deleteMessage(row.id)}
                              >
                                <Trash2 size={14} /> حذف
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : tab === 'settings' ? (
                    <div>
                      <div className="admin-note" style={{ marginBottom: 14 }}>
                        إعدادات عامة للمتجر: وضع الألوان، عتبة التوصيل المجاني، ورسوم التوصيل. تُحفظ في الخادم (أو محلياً عند انقطاعه) وتظهر فوراً في واجهة المتجر.
                      </div>
                      <div className="admin-field">
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={settings.colorsEnabled !== false}
                            onChange={(event) => setSettings({ ...settings, colorsEnabled: event.target.checked })}
                            style={{ width: 16, height: 16 }}
                          />
                          تفعيل وضع الألوان في المتجر (عام)
                        </label>
                        <small style={{ display: 'block', marginTop: 4, color: 'var(--stv-muted)', fontSize: 11 }}>
                          عند الإيقاف تختفي قوائم الألوان من البطاقات وصفحات المنتجات، ويمكن تفعيلها لمنتج معيّن من تبويب المنتجات.
                        </small>
                      </div>
                      <div className="admin-row">
                        <div className="admin-field">
                          <label>التوصيل المجاني ابتداءً من (دينار)</label>
                          <input type="number" min={0} step={1000} value={settings.freeDeliveryFrom} onChange={(event) => setSettings({ ...settings, freeDeliveryFrom: Number(event.target.value) || 0 })} dir="ltr" />
                        </div>
                        <div className="admin-field">
                          <label>رسوم التوصيل (دينار)</label>
                          <input type="number" min={0} step={500} value={settings.deliveryFee} onChange={(event) => setSettings({ ...settings, deliveryFee: Number(event.target.value) || 0 })} dir="ltr" />
                        </div>
                      </div>
                      <div className="admin-actions">
                        <button type="button" className="admin-btn success" onClick={() => void saveSettings()}>
                          <Save size={15} /> حفظ الإعدادات
                        </button>
                        <span className="admin-chip">وضع الاتصال: {online ? 'الخادم' : 'محلي'}</span>
                      </div>

                      <div className="admin-field" style={{ marginTop: 20 }}>
                        <label>تغيير رمز الدخول إلى اللوحة</label>
                        <small style={{ fontSize: 11, color: 'var(--stv-muted)', lineHeight: 1.7 }}>
                          من 4 إلى 12 رقماً. يُحفظ في الخادم، وإذا كان الخادم غير متصل يُحفظ محلياً في هذا المتصفح.
                        </small>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                          <input
                            id="new-pin"
                            type="password"
                            inputMode="numeric"
                            placeholder="رمز جديد (4-12 رقماً)"
                            maxLength={12}
                            style={{ flex: '1 1 160px', maxWidth: 240 }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return
                              const target = event.target as HTMLInputElement
                              void savePin(target.value).then((saved) => { if (saved) target.value = '' })
                            }}
                          />
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => {
                              const input = document.getElementById('new-pin') as HTMLInputElement | null
                              const value = input?.value ?? ''
                              void savePin(value).then((saved) => { if (saved && input) input.value = '' })
                            }}
                          >
                            <Save size={15} /> حفظ الرمز
                          </button>
                        </div>
                      </div>

                      <div className="admin-field" style={{ marginTop: 20 }}>
                        <label>قائمة المدراء (دخول دائم باسم وكلمة مرور)</label>
                        <small style={{ fontSize: 11, color: 'var(--stv-muted)', lineHeight: 1.7 }}>
                          كل مدير يسجّل الدخول باسمه وكلمة مروره. تبقى الجلسة 45 يوماً وتتجدد تلقائياً مع كل زيارة، ولا حاجة لإعادة الدخول عند كل فتح تبويب.
                        </small>
                        <div className="admin-admins" style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          {admins.length ? (
                            admins.map((account) => (
                              <div key={account.id} className="admin-list-item" style={{ alignItems: 'center' }}>
                                <div className="li-main">
                                  <strong dir="ltr" style={{ display: 'block' }}>{account.username}</strong>
                                  {account.display_name ? <span style={{ fontSize: 12, color: 'var(--stv-muted)' }}>{account.display_name}</span> : null}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button type="button" className="admin-btn ghost" style={{ fontSize: 12, padding: '5px 10px' }} disabled={adminsBusy} onClick={() => void resetAdminPassword(account)}>
                                    تغيير كلمة المرور
                                  </button>
                                  <button type="button" className="admin-btn ghost" style={{ fontSize: 12, padding: '5px 10px', color: '#a3193f' }} disabled={adminsBusy} onClick={() => void removeAdmin(account)}>
                                    حذف
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="admin-note">لا توجد حسابات ظاهرة (أو الخادم غير متصل).</div>
                          )}
                        </div>
                        <div className="admin-row" style={{ marginTop: 10 }}>
                          <div className="admin-field">
                            <label>اسم مستخدم جديد</label>
                            <input value={newAdmin.username} onChange={(event) => setNewAdmin({ ...newAdmin, username: event.target.value })} dir="ltr" placeholder="manager1" autoComplete="off" />
                          </div>
                          <div className="admin-field">
                            <label>كلمة المرور</label>
                            <input type="password" value={newAdmin.password} onChange={(event) => setNewAdmin({ ...newAdmin, password: event.target.value })} dir="ltr" placeholder="6 أحرف على الأقل" autoComplete="new-password" />
                          </div>
                          <div className="admin-field">
                            <label>الاسم الظاهر (اختياري)</label>
                            <input value={newAdmin.displayName} onChange={(event) => setNewAdmin({ ...newAdmin, displayName: event.target.value })} placeholder="مثال: المساعدة" />
                          </div>
                        </div>
                        <div className="admin-actions" style={{ marginTop: 6 }}>
                          <button type="button" className="admin-btn success" disabled={adminsBusy} onClick={() => void addAdmin()}>
                            <Plus size={15} /> إضافة مدير
                          </button>
                          <span className="admin-chip">عدد المدراء: {admins.length}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="admin-note" style={{ marginBottom: 14 }}>
                        تنزيل نسخة احتياطية من كل التعديلات (منتجات، تصنيفات، محتوى) أو استيرادها من ملف سابق. استخدمها قبل إعادة بناء الموقع لحفظ تعديلاتك.
                      </div>
                      <div className="admin-actions" style={{ marginTop: 0 }}>
                        <button type="button" className="admin-btn" onClick={exportData}>
                          <Download size={15} /> تنزيل نسخة احتياطية
                        </button>
                        <label className="admin-btn ghost" style={{ cursor: 'pointer' }}>
                          <Upload size={15} /> استيراد نسخة
                          <input type="file" accept="application/json" hidden onChange={(event) => void importData(event.target.files?.[0] ?? null)} />
                        </label>
                        <button type="button" className="admin-btn ghost" onClick={restoreAll}>
                          <RotateCcw size={15} /> استعادة الافتراضي
                        </button>
                      </div>

                      <div className="admin-list">
                        <div className="admin-list-item">
                          <ImageIcon size={20} style={{ color: 'var(--stv-red)' }} />
                          <div className="li-main">
                            <strong>{allProducts.length} منتج</strong>
                            <small>{overrides.length} مُعدَّل · {removed.length} محذوف</small>
                          </div>
                        </div>
                        <div className="admin-list-item">
                          <Check size={20} style={{ color: 'var(--stv-green)' }} />
                          <div className="li-main">
                            <strong>{content.shopName}</strong>
                            <small dir="ltr">{content.phone}</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: '#1a1a1e', color: '#fff', padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, boxShadow: '0 12px 30px -12px rgba(15,15,20,.6)' }} role="status">
          {toast}
        </div>
      )}
    </>
  )
}

export { fallbackProducts, fallbackCategories }
