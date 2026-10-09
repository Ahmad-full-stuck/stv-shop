import { ArrowLeft, Search } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useT } from '@/lib/i18n'
import {
  AboutPage,
  ContactPage,
  FabricGuidePage,
  GlassStyles,
  OrderTrackingPage,
  PoliciesPage,
} from '@/pages/InfoPages'

export default function NotFound() {
  const { t } = useT()
  const [rawLocation] = useLocation()
  const location = rawLocation.split('?')[0]
  const fragmentIndex = location.indexOf('#')

  if (fragmentIndex > 0) {
    const base = location.slice(0, fragmentIndex)
    if (base === '/about') return <AboutPage />
    if (base === '/fabric-guide') return <FabricGuidePage />
    if (base === '/contact') return <ContactPage />
    if (base === '/policies') return <PoliciesPage />
    if (base === '/order-tracking') return <OrderTrackingPage />
  }

  return (
    <>
      <GlassStyles />
      <main className="container-stv not-found-page">
        <section className="glass not-found-card">
          <span className="not-found-code" aria-hidden="true">404</span>
          <span className="eyebrow"><Search size={14} />{t('nf.eyebrow')}</span>
          <h1>{t('nf.title')}</h1>
          <p>{t('nf.text')}</p>
          <div className="not-found-actions">
            <Link href="/" className="button button-primary">{t('nf.home')} <ArrowLeft size={16} /></Link>
            <Link href="/catalog" className="button button-outline">{t('nf.browse')} <ArrowLeft size={16} /></Link>
          </div>
          <div className="not-found-links">
            <Link href="/fabric-guide" className="chip">{t('nf.guide')}</Link>
            <Link href="/about" className="chip">{t('nf.about')}</Link>
            <Link href="/contact" className="chip">{t('nf.contact')}</Link>
            <Link href="/order-tracking" className="chip">{t('nf.tracking')}</Link>
            <Link href="/favorites" className="chip">{t('nf.favorites')}</Link>
            <Link href="/policies" className="chip">{t('nf.policies')}</Link>
          </div>
        </section>
      </main>
    </>
  )
}
