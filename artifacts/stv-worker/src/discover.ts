import type { StoreProduct } from './types'

export interface DiscoveryInput {
  garment?: string
  stretch?: string
  tone?: string
  limit?: number
}

export interface DiscoveryMatch {
  slug: string
  name: string
  score: number
  reasons: string[]
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

const flat = (...values: unknown[]): string =>
  values
    .map((value) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)))
    .join(' ')
    .replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)))
    .toLowerCase()

const has = (source: string, words: string[]): boolean => words.some((word) => source.includes(word))

const DARK_WORDS = ['اسود', 'أسود', 'كحلي', 'نيلي', 'بني', 'عنابي', 'خمري', 'زيتوني', 'فحمي', 'داكن', 'أسمر', 'بترولي', 'كستنائي']
const LIGHT_WORDS = ['أبيض', 'ابيض', 'عاجي', 'بيج', 'سماوي', 'وردي فاتح', 'ليلكي', 'فضي', 'أوف وايت', 'كريمي', 'فاتح']
const GLOSS_WORDS = ['لامع', 'لمعان', 'ميتاليك', 'ميتلك', 'ترتر', 'ساتان', 'غليتر', 'هولو', 'لمعة', 'سلك', 'ديجتال', 'ذهبي', 'فضي']
const MATTE_WORDS = ['مطفي', 'مطفيه', 'سادة', 'قطن', 'لينن', 'كتان']
const STRETCH_WORDS = ['مطاطي', 'اسпанكس', 'سباندكس', 'سبانكس', 'ليكرا', 'استرتش', 'كريب سباندكس']
const NON_STRETCH_WORDS = ['غير مطاطي', 'سادة', 'كتان', 'لينن', 'صوف', 'بوبلين']
const OPACITY_WORDS = ['شفاف', 'شفافيه', 'خفيف جدا']
const OPAQUE_WORDS = ['غير شفاف', 'معتم', 'كثيف', 'ثقيل', 'بطانة', 'بطانه']
const WEIGHT_LIGHT = ['خفيف', 'ناعم', 'انسيابي', 'انسيابيه']
const WEIGHT_HEAVY = ['ثقيل', 'شتوي', 'شتاء', 'سميك', 'بوبلين', 'تويل', 'توييد']
const WIDE_WORDS = ['150', '١٥٠', 'عرض', 'wide', 'm']

interface Profile {
  stretch: 'yes' | 'no' | 'any'
  gloss: boolean
  matte: boolean
  opaque: boolean
  sheer: boolean
  light: boolean
  heavy: boolean
  dark: boolean
  pale: boolean
  usedFor: string[]
}

const luminance = (hex: string): number => {
  const value = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return 0.5
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const profileOf = (product: StoreProduct): Profile => {
  const specs = (product.specs ?? {}) as Record<string, unknown>
  const source = flat(product.name, product.type, product.description, specs.composition, specs.use, specs.finish, specs.weight, specs.stretch, specs.opacity, product.colors.map((color) => color.name).join(' '))
  const hexes = product.colors.map((color) => color.hex).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex))
  const avgLuminance = hexes.length ? hexes.reduce((sum, hex) => sum + luminance(hex), 0) / hexes.length : 0.5
  const isStretch = typeof specs.isStretch === 'boolean' ? (specs.isStretch as boolean) : has(source, STRETCH_WORDS) && !has(source, NON_STRETCH_WORDS)
  return {
    stretch: isStretch ? 'yes' : 'no',
    gloss: has(source, GLOSS_WORDS),
    matte: has(source, MATTE_WORDS),
    opaque: has(source, OPAQUE_WORDS) && !has(source, OPACITY_WORDS),
    sheer: has(source, OPACITY_WORDS),
    light: has(source, WEIGHT_LIGHT),
    heavy: has(source, WEIGHT_HEAVY),
    dark: has(source, DARK_WORDS) || avgLuminance < 0.32,
    pale: has(source, LIGHT_WORDS) || avgLuminance > 0.72,
    usedFor: [specs.use, product.description].filter((item): item is string => typeof item === 'string'),
  }
}

const GARMENT_RULES: Record<string, (profile: Profile, source: string) => { points: number; why: string }[]> = {
  'فستان يومي': (p, s) => [
    { points: has(s, ['فستان', 'قميص', 'تنورة', 'يومي']) ? 30 : 0, why: 'مناسب للفساتين اليومية' },
    { points: p.light ? 18 : 0, why: 'خامة خفيفة ومريحة' },
    { points: p.opaque ? 14 : 0, why: 'غير شفافة' },
    { points: p.stretch === 'yes' ? 12 : 0, why: 'مرنة وسهلة التفصيل' },
    { points: p.heavy ? -10 : 0, why: 'ثقيلة قليلاً للاستخدام اليومي' },
  ],
  'فستان سهرة': (p, s) => [
    { points: p.gloss ? 32 : 0, why: 'لمعة مناسبة للسهرة' },
    { points: has(s, ['سهرة', 'ناعم', 'انسيابي', 'ساتان']) ? 22 : 0, why: 'انسيابية أنيقة' },
    { points: has(s, ['فستان', 'سهرة']) ? 14 : 0, why: 'مذكور للفساتين' },
    { points: p.opaque ? 10 : 0, why: 'تغطية مريحة' },
    { points: p.matte && !p.gloss ? -8 : 0, why: 'مطفي بدون لمعة' },
  ],
  'عباءة أو برنوش': (p, s) => [
    { points: has(s, ['عباءة', 'برنوش', 'بنتوش', 'جاكيت', 'شنطة']) ? 30 : 0, why: 'مذكور للعباءات' },
    { points: p.opaque ? 20 : 0, why: 'تغطية كاملة' },
    { points: p.heavy ? 16 : 0, why: 'سماكة مناسبة للطبقة الخارجية' },
    { points: p.sheer ? -18 : 0, why: 'شفافة ولا تناسب العباءة' },
    { points: p.stretch === 'yes' ? 6 : 0, why: 'مرونة في الارتداء' },
  ],
  'قطعة عملية': (p, s) => [
    { points: has(s, ['جاكيت', 'قميص', 'تنورة', 'بنطلون', 'طقم', 'عملي']) ? 26 : 0, why: 'مذكور لقطع عملية' },
    { points: p.stretch === 'yes' ? 20 : 0, why: 'مطاطية تسهل الحركة' },
    { points: p.opaque ? 14 : 0, why: 'تغطية عملية' },
    { points: p.light ? 8 : 0, why: 'خفيفة على الجسم' },
    { points: p.gloss ? -6 : 0, why: 'لمعة أقل ملاءمة للاستخدام العملي' },
  ],
}

const toneRules = (tone: string | undefined, profile: Profile): { points: number; why: string }[] => {
  if (tone === 'داكن') {
    return [
      { points: profile.dark ? 26 : 0, why: 'درجات داكنة' },
      { points: profile.pale ? -18 : 0, why: 'فاتح اللون' },
    ]
  }
  if (tone === 'فاتح') {
    return [
      { points: profile.pale ? 26 : 0, why: 'درجات فاتحة' },
      { points: profile.dark ? -18 : 0, why: 'داكن اللون' },
    ]
  }
  if (tone === 'لامع') {
    return [
      { points: profile.gloss ? 28 : 0, why: 'سطح لامع' },
      { points: profile.matte && !profile.gloss ? -14 : 0, why: 'سطح مطفي' },
    ]
  }
  if (tone === 'محايد') {
    return [
      { points: !profile.gloss ? 16 : 0, why: 'لون هادئ غير لامع' },
      { points: profile.dark || profile.pale ? 8 : 0, why: 'سهل التنسيق' },
    ]
  }
  return []
}

const stretchRules = (stretch: string | undefined, profile: Profile): { points: number; why: string }[] => {
  if (stretch === 'نعم، مطاطي' || stretch === 'مطاطي' || stretch === 'yes') {
    return [
      { points: profile.stretch === 'yes' ? 24 : -30, why: profile.stretch === 'yes' ? 'مطاطية' : 'غير مطاطية' },
    ]
  }
  if (stretch === 'لا، غير مطاطي' || stretch === 'غير مطاطي' || stretch === 'no') {
    return [
      { points: profile.stretch === 'no' ? 24 : -30, why: profile.stretch === 'no' ? 'غير مطاطية' : 'مطاطية' },
    ]
  }
  return []
}

export function runDiscovery(products: StoreProduct[], input: DiscoveryInput): DiscoveryMatch[] {
  const garment = (input.garment || '').trim()
  const tone = (input.tone || '').trim()
  const stretch = (input.stretch || '').trim()
  const rule = GARMENT_RULES[garment]

  const scored = products
    .filter((product) => product.stockMeters > 0)
    .map((product) => {
      const profile = profileOf(product)
      const source = flat(product.name, product.type, product.description, product.specs)
      let score = 20
      const reasons: string[] = []
      if (rule) {
        rule(profile, source).forEach((item) => {
          score += item.points
          if (item.points > 0 && !reasons.includes(item.why)) reasons.push(item.why)
        })
      }
      stretchRules(stretch, profile).forEach((item) => {
        score += item.points
        if (item.points > 0 && !reasons.includes(item.why)) reasons.push(item.why)
      })
      toneRules(tone, profile).forEach((item) => {
        score += item.points
        if (item.points > 0 && !reasons.includes(item.why)) reasons.push(item.why)
      })
      if (product.isFeatured) score += 4
      return { slug: product.slug, name: product.name, score, reasons: reasons.slice(0, 3) }
    })
    .sort((a, b) => b.score - a.score)

  const limit = Math.min(Math.max(Number(input.limit) || 6, 1), 24)
  return scored.slice(0, limit)
}
