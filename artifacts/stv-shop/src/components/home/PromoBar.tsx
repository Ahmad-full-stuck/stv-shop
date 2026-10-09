import { ArrowLeft, Sparkles } from 'lucide-react'
import { Link } from 'wouter'
import { formatDinar } from '@/lib/catalog'
import { useT } from '@/lib/i18n'
import { useSiteContent, useStoreSettings } from '@/lib/site-content'

export function PromoBar() {
  const { t } = useT()
  const content = useSiteContent()
  const settings = useStoreSettings()
  const freeFrom = formatDinar(settings.freeDeliveryFrom || 50000)

  return (
    <div className="container-stv" style={{ marginBlock: 'clamp(14px, 3vw, 30px)' }}>
      <section className="promo-bar" aria-label={t('home.promo.aria').replace('{price}', freeFrom)}>
        <span className="glass-pill"><Sparkles size={13} />{content.promoPill}</span>
        <p><strong>{content.promoLead}</strong> {content.promoText.replace('{price}', freeFrom)}</p>
        <Link href="/catalog" className="button button-primary button-small">{t('home.promo.cta')} <ArrowLeft size={14} /></Link>
      </section>
    </div>
  )
}
