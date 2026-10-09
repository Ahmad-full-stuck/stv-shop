import { useEffect, useState } from 'react'
import { readServerContent, readServerSettings } from '@/lib/api'

export const CONTENT_KEY = 'stv-admin-content'

export interface SiteContent {
  shopName: string
  phone: string
  whatsapp: string
  instagram: string
  announcementRight: string
  announcementLeft: string
  aboutTitle: string
  aboutText: string
  contactTitle: string
  contactText: string
  heroEyebrow: string
  heroTitle: string
  heroText: string
  heroNote: string
  heroNoteAlt: string
  statsTitle: string
  heroSlideMs: string
  categoriesEyebrow: string
  categoriesTitle: string
  newEyebrow: string
  newTitle: string
  newDesc: string
  guideEyebrow: string
  guideTitle: string
  guideText: string
  guideCta: string
  newsletterEyebrow: string
  newsletterTitle: string
  newsletterText: string
  promoPill: string
  promoLead: string
  promoText: string
  emailOrdersTo: string
  emailFromName: string
  emailFrom: string
  emailSubjectOrder: string
  emailTemplateOrder: string
  emailProvider: 'mailto' | 'formsubmit'
  emailFormSubmitAction: string
}

export const defaultSiteContent: SiteContent = {
  shopName: 'STV Shop — للتجهيزات الرياضية',
  phone: '07701871844',
  whatsapp: '9647701871844',
  instagram: 'https://www.instagram.com/stv5hop/',
  announcementRight: 'شحن إلى جميع محافظات العراق',
  announcementLeft: 'التوصيل بـ ٥ آلاف دينار فقط',
  aboutTitle: 'من كركوك — لكل رياضي',
  aboutText: 'STV Shop متجر تجهيزات رياضية في كركوك، مقابل البوليفارد. هدفنا بسيط: كل ما يحتاجه الرياضي في مكان واحد — جيرزي، درستس، أحذية، إكسسوارات ومعدات — بجودة تثق بها وخدمة تليق بك. تجربة تسوّق مريحة، أسعار واضحة، وتوصيل لكل المحافظات.',
  contactTitle: 'سؤال عن منتج أو طلب؟',
  contactText: 'راسلنا عبر واتساب 07701871844 أو اكتب لنا هنا. نرد عليك من ١٠ صباحاً حتى ١٠ ليلاً، يومياً.',
  heroEyebrow: 'تجهيزات رياضية من كركوك',
  heroTitle: 'كل ما يحتاجه *الرياضي*|في مكان واحد',
  heroText: 'جيرزي أندية، درستس، أحذية، إكسسوارات ومعدات — مختارة بعناية لتشتغل أداء أقوى.',
  heroNote: 'توصيل إلى جميع محافظات العراق',
  heroNoteAlt: 'دفع عند استلام الطلب',
  statsTitle: 'أرقام المتجر الآن',
  heroSlideMs: '2600',
  categoriesEyebrow: 'اختاري من البداية',
  categoriesTitle: 'كل التجهيزات',
  newEyebrow: 'نماذج مختارة',
  newTitle: 'وصل حديثاً',
  newDesc: 'أحدث القطع التي أضفناها إلى المتجر',
  guideEyebrow: 'قبل أن تختاري',
  guideTitle: 'المقاس الصحيح|فرق في الأداء.',
  guideText: 'الجيرزي يلبس مقاسك فعلاً، والحذاء يفكّر في رِجلك. شوف دليل المقاسات قبل الطلب — وإذا ما ناسبك، التبديل سهل.',
  guideCta: 'دليل المقاسات',
  newsletterEyebrow: 'نشرة STV',
  newsletterTitle: 'اشتراك بالبريد',
  newsletterText: 'عرض جديد أو قطعة توصل للمتجر يصلك عبر البريد: اكتب بريدك واضغط الزر لتفتح البريد وتؤكّد الاشتراك.',
  promoPill: 'توصيل لكل العراق',
  promoLead: 'توصيل مجاني',
  promoText: 'للطلبات فوق {price}',
  emailOrdersTo: 'wealiahmad.ali@gmail.com',
  emailFromName: 'STV Shop — للتجهيزات الرياضية',
  emailFrom: '',
  emailSubjectOrder: 'طلب جديد من STV Shop #{orderNumber}',
  emailTemplateOrder: '',
  emailProvider: 'formsubmit',
  emailFormSubmitAction: 'https://formsubmit.co/wealiahmad.ali@gmail.com',
}

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

export const readSiteContent = (): SiteContent => ({
  ...defaultSiteContent,
  ...(readServerContent<Partial<SiteContent>>() || {}),
  ...readJson<Partial<SiteContent>>(CONTENT_KEY, {}),
})

export interface StoreSettings {
  colorsEnabled: boolean
  freeDeliveryFrom: number
  deliveryFee: number
  [key: string]: unknown
}

export const defaultStoreSettings: StoreSettings = {
  colorsEnabled: true,
  freeDeliveryFrom: 50000,
  deliveryFee: 5000,
}

export const readStoreSettings = (): StoreSettings => ({
  ...defaultStoreSettings,
  ...(readServerSettings() as Partial<StoreSettings>),
})

export const useStoreSettings = (): StoreSettings => {
  const [settings, setSettings] = useState<StoreSettings>(() => readStoreSettings())
  useEffect(() => {
    const sync = () => setSettings(readStoreSettings())
    window.addEventListener('stv-admin-changed', sync)
    return () => window.removeEventListener('stv-admin-changed', sync)
  }, [])
  return settings
}

const listeners = new Set<() => void>()

export const useSiteContent = (): SiteContent => {
  const [content, setContent] = useState<SiteContent>(() => readSiteContent())
  useEffect(() => {
    const sync = () => setContent(readSiteContent())
    listeners.add(sync)
    window.addEventListener('stv-admin-changed', sync)
    return () => {
      listeners.delete(sync)
      window.removeEventListener('stv-admin-changed', sync)
    }
  }, [])
  return content
}

export const contentLines = (value: string): string[] =>
  value.split('|').map((line) => line.trim()).filter(Boolean)

export const contentParts = (value: string): string[] => value.split('*')
