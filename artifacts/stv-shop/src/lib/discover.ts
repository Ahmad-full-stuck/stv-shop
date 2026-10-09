import type { Product } from '@/types'

export interface DiscoveryInput {
  garment?: string
  team?: string
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
const CLUB_WORDS = ['نادي', 'برشلونة', 'ريال', 'ليفربول', 'ميلان', 'باريس', 'PSG', 'مانشستر', 'يوفنتوس', 'بايرن', 'تشيلسي', 'arsenal', 'arsenal', 'arsenal']
const NATIONAL_WORDS = ['منتخب', 'العراق', 'البرازيل', 'الارجنتين', 'فرنسا', 'المانيا', 'اسبانيا', 'انجلترا', 'البرتغال', 'هولندا']

interface Profile {
  jersey: boolean
  tracksuit: boolean
  shoes: boolean
  gear: boolean
  club: boolean
  national: boolean
  dark: boolean
  pale: boolean
}

const luminance = (hex: string): number => {
  const value = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return 0.5
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const profileOf = (product: Product): Profile => {
  const specs = (product.specs ?? {}) as unknown as Record<string, unknown>
  const source = flat(
    product.name,
    product.type,
    product.description,
    specs.material,
    specs.use,
    specs.brand,
    product.colors.map((color) => color.name).join(' '),
  )
  const hexes = product.colors.map((color) => color.hex).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex))
  const avgLuminance = hexes.length ? hexes.reduce((sum, hex) => sum + luminance(hex), 0) / hexes.length : 0.5
  return {
    jersey: has(source, ['جيرزي', 'قميص', 'تيشيرت', 'jersey', 'kit']) || product.categoryId === 'jerseys',
    tracksuit: has(source, ['درستس', 'طقم', 'ست tracksuit', 'tracksuit']) || product.categoryId === 'tracksuits',
    shoes: has(source, ['حذاء', 'حذية', 'احذية', 'shoes', 'sneaker', 'اريلكس', 'اركس', 'nike', 'adidas']) || product.categoryId === 'shoes',
    gear: has(source, ['كرة', 'شنطة', 'دمبل', 'حبل', 'ساعة رياضية', 'اكمام', 'سوست', 'معدات']) || product.categoryId === 'accessories' || product.categoryId === 'equipment',
    club: has(source, CLUB_WORDS),
    national: has(source, NATIONAL_WORDS),
    dark: has(source, DARK_WORDS) || avgLuminance < 0.32,
    pale: has(source, LIGHT_WORDS) || avgLuminance > 0.72,
  }
}

type Rule = (profile: Profile, source: string) => { points: number; why: string }[]

const GARMENT_RULES: Record<string, Rule> = {
  'جيرزي أو قميص رياضي': (p, s) => [
    { points: p.jersey ? 34 : 0, why: 'disc.jerseyComfort' },
    { points: has(s, ['منتخب', 'نادي', 'برشلونة', 'ريال', 'ليفربول', 'ميلان']) ? 18 : 0, why: 'disc.clubOrNational' },
    { points: p.tracksuit ? -8 : 0, why: 'disc.lessJerseyFit' },
  ],
  'درستس وطقم رياضي': (p, s) => [
    { points: p.tracksuit ? 34 : 0, why: 'disc.tracksuitWarm' },
    { points: has(s, ['شتاء', 'شتوي', 'طقم', 'درستس']) ? 18 : 0, why: 'disc.winterReady' },
    { points: p.jersey ? -6 : 0, why: 'disc.lessTracksuitFit' },
  ],
  'أحذية رياضية': (p) => [
    { points: p.shoes ? 36 : 0, why: 'disc.shoesGrip' },
    { points: p.gear ? -10 : 0, why: 'disc.notShoes' },
  ],
  'إكسسوارات ومعدات': (p) => [
    { points: p.gear ? 30 : 0, why: 'disc.gearExtras' },
    { points: has(p.club ? 'نادي' : '', CLUB_WORDS) || p.club ? 8 : 0, why: 'disc.clubFits' },
    { points: p.shoes ? -8 : 0, why: 'disc.notGear' },
  ],
}

const toneRules = (tone: string | undefined, profile: Profile): { points: number; why: string }[] => {
  if (tone === 'داكن') return [
    { points: profile.dark ? 26 : 0, why: 'disc.darkShades' },
    { points: profile.pale ? -18 : 0, why: 'disc.paleColor' },
  ]
  if (tone === 'فاتح') return [
    { points: profile.pale ? 26 : 0, why: 'disc.paleShades' },
    { points: profile.dark ? -18 : 0, why: 'disc.darkColor' },
  ]
  if (tone === 'لامع') return [
    { points: profile.club || profile.jersey ? 20 : 8, why: 'disc.teamColours' },
  ]
  if (tone === 'محايد') return [
    { points: !profile.club ? 16 : 0, why: 'disc.quietColor' },
    { points: profile.dark || profile.pale ? 8 : 0, why: 'disc.easyToMatch' },
  ]
  return []
}

const teamRules = (team: string | undefined, profile: Profile): { points: number; why: string }[] => {
  if (team === 'clubs') return [
    { points: profile.club ? 26 : -10, why: profile.club ? 'disc.clubFits' : 'disc.notClub' },
  ]
  if (team === 'national') return [
    { points: profile.national ? 26 : -10, why: profile.national ? 'disc.nationalFits' : 'disc.notNational' },
  ]
  return []
}

export function runDiscovery(products: Product[], input: DiscoveryInput): DiscoveryMatch[] {
  const garment = (input.garment || '').trim()
  const tone = (input.tone || '').trim()
  const team = (input.team || '').trim()
  const rule = GARMENT_RULES[garment]

  const scored = products
    .map((product) => {
      const profile = profileOf(product)
      const source = flat(
        product.name,
        product.type,
        product.description,
        product.specs?.material,
        product.specs?.use,
        product.specs?.brand,
        product.specs?.care,
      )
      let score = 20
      const reasons: string[] = []
      if (rule) {
        rule(profile, source).forEach((item) => {
          score += item.points
          if (item.points > 0 && !reasons.includes(item.why)) reasons.push(item.why)
        })
      }
      teamRules(team, profile).forEach((item) => {
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
