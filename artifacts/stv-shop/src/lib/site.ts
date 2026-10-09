const adminContent = (): Record<string, string> => {
  try {
    const raw = window.localStorage.getItem('stv-admin-content')
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

const rawWhatsApp = import.meta.env.VITE_WHATSAPP_NUMBER || '9647701871844'
const rawInstagram = import.meta.env.VITE_INSTAGRAM_URL || 'https://www.instagram.com/stv5hop/'
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

const digits = (value: string): string => value.replace(/[^0-9]/g, '')

const internationalWhatsApp = (() => {
  let value = digits(rawWhatsApp)
  if (value.startsWith('00')) value = value.slice(2)
  if (value.startsWith('0')) value = `964${value.slice(1)}`
  if (!value.startsWith('964') && value.length > 0) value = `964${value}`
  return value || '9647701871844'
})()

const localPhone = (() => {
  if (internationalWhatsApp.startsWith('9647')) return `0${internationalWhatsApp.slice(4)}`
  return rawWhatsApp
})()

const safeInstagram = /^https?:\/\//i.test(rawInstagram) ? rawInstagram : `https://${rawInstagram.replace(/^\/+/, '')}`

export const siteConfig = {
  get name() { return adminContent().shopName || 'STV Shop — للتجهيزات الرياضية' },
  shortName: 'STV Shop',
  get phone() { return adminContent().phone || localPhone },
  get instagramUrl() { return adminContent().instagram || safeInstagram },
  get contactEmail() { return adminContent().emailOrdersTo || 'wealiahmad.ali@gmail.com' },
  emailUrl: (subject = 'استفسار من متجر STV Shop', body = 'مرحباً، أريد الاستفسار عن منتجاتكم.'): string => `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  instagramText: 'STV Shop على إنستغرام',
}

export const apiUrl = (path: string): string => `${apiBase}${path.startsWith('/') ? path : `/${path}`}`

export const phoneDigits = digits

const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

export const telProps = (phone: string): { href?: string } => ({ href: isTouchDevice() ? `tel:${phone}` : undefined })
