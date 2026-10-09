import { MapPin, MessageCircle, PackageSearch } from 'lucide-react'
import { Link } from 'wouter'
import type { Category, SiteRoute } from '@/types'
import { governorates } from '@/lib/fallback-data'
import { useT } from '@/lib/i18n'
import { governoratesEn, routeLabelsEn } from '@/lib/strings/header'
import { siteConfig } from '@/lib/site'
import { Logo } from './Logo'

interface SiteFooterProps {
  routes: SiteRoute[]
  categories: Category[]
}

const infoItems = [
  { path: '/about', label: 'foot.nav.about' },
  { path: '/fabric-guide', label: 'foot.nav.guide' },
  { path: '/order-tracking', label: 'foot.nav.tracking' },
  { path: '/contact', label: 'foot.nav.contact' },
  { path: '/policies', label: 'foot.nav.policies' },
]

export function SiteFooter({ routes, categories }: SiteFooterProps) {
  const { lang, t } = useT()
  const infoRoutes = infoItems.map((item) => {
    const matched = routes.find((route) => route.path === item.path)
    const label = matched?.label || t(item.label)
    return { ...item, id: item.path, label: lang === 'en' && matched ? routeLabelsEn[matched.id] ?? label : label }
  })
  const nearbyGovernorates = (lang === 'en' ? governoratesEn : governorates).slice(0, 6)

  return (
    <footer className="site-footer glass-dark">
      <div className="container-stv footer-brand footer-top">
        <Logo light />
        <p>{t('foot.tagline')}</p>
        <div className="social-links">
          <Link href="/contact" aria-label={t('foot.contactViaSite')}><MessageCircle size={17} /></Link>
        </div>
      </div>
      <div className="container-stv footer-grid">
        <div className="footer-col">
          <h2>{t('foot.colFabrics')}</h2>
          <Link href="/catalog">{t('foot.allFabrics')}</Link>
          {categories.slice(0, 5).map((category) => <Link key={category.id} href={`/catalog?category=${encodeURIComponent(category.id)}`}>{category.name}</Link>)}
        </div>
        <div className="footer-col">
          <h2>{t('foot.colInfo')}</h2>
          {infoRoutes.map((route) => <Link key={route.id} href={route.path}>{route.label}</Link>)}
          <Link href="/policies#privacy">{t('foot.privacy')}</Link>
          <Link href="/policies#returns">{t('foot.returns')}</Link>
          <Link href="/admin" className="footer-admin-link">{t('foot.adminLogin')}</Link>
        </div>
        <div className="footer-col">
          <h2>{t('foot.colContact')}</h2>
          <Link href="/contact"><MessageCircle size={15} />{t('foot.contactForm')}</Link>
          <Link href="/order-tracking"><PackageSearch size={15} />{t('foot.trackStatus')}</Link>
        </div>
        <div className="footer-col">
          <h2>{t('foot.colServiceArea')}</h2>
          <p>{t('foot.deliveryRange').replace('{list}', nearbyGovernorates.join(`${t('foot.listSeparator')} `))}</p>
          <span className="footer-delivery-note"><MapPin size={15} />{t('foot.deliveryFee')}</span>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container-stv">
          <span>© {new Date().getFullYear()} {siteConfig.name}</span>
          <span>{t('foot.pricesNote')}</span>
        </div>
      </div>
    </footer>
  )
}
