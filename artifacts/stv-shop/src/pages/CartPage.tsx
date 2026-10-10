import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Minus, Pencil, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { Link } from 'wouter'
import type { CartItem } from '@/types'
import { availableStock, formatDinar, formatPrice, getCartTotals, orderKey } from '@/lib/catalog'
import { useT } from '@/lib/i18n'
import { typeLabelsEn } from '@/lib/strings/product'
import { useStoreSettings } from '@/lib/site-content'
import { SmartImage } from '@/components/ui/SmartImage'

interface CartPageProps {
  cart: CartItem[]
  onUpdate: (key: string, length: number) => void
  onRemove: (key: string) => void
}

const glassStyles = `
.glass-scope { --glass-fill: rgba(255, 255, 255, .62); --glass-strong: rgba(255, 255, 255, .9); --glass-line: rgba(255, 255, 255, .75); --glass-shadow: 0 22px 48px rgba(15, 15, 20, .08); }
.glass-scope .glass { position: relative; background: var(--glass-fill); border: 1px solid var(--glass-line); box-shadow: var(--glass-shadow); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); }
.glass-scope .glass-card { border-radius: 16px; }
.glass-scope .glass-strong { background: var(--glass-strong); border-color: rgba(255, 255, 255, .92); }
.glass-scope .glass.checkout-summary, .glass-scope .glass.order-summary { position: sticky; top: 120px; }
.glass-scope .glass-dark { color: #fff; background: rgba(15, 15, 20, .88); border: 1px solid rgba(255, 255, 255, .12); box-shadow: 0 16px 34px rgba(15, 15, 20, .22); }
.glass-scope .glass-pill { border-radius: 999px; }
.glass-scope .glass-divider { height: 1px; margin: 16px 0; background: linear-gradient(90deg, rgba(225, 29, 46, 0), rgba(225, 29, 46, .35), rgba(225, 29, 46, 0)); border: 0; }
.glass-scope .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; color: var(--stv-muted); background: rgba(255, 255, 255, .72); border: 1px solid rgba(255, 255, 255, .9); border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
.glass-scope .chip i { width: 11px; height: 11px; border: 1px solid rgba(15, 15, 20, .2); border-radius: 50%; }
.glass-scope a.chip:hover { color: var(--stv-red); border-color: rgba(225, 29, 46, .45); }
.glass-scope .cart-items { padding: 4px 20px; border-top: 0; border-radius: 18px; }
.glass-scope .cart-item:last-child { border-bottom: 0; }
.glass-scope .cart-item-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.glass-scope .cart-item-tools { display: flex; align-items: center; gap: 8px; }
.glass-scope .cart-item-total { display: grid; gap: 2px; text-align: end; }
.glass-scope .cart-item-total small { color: var(--stv-muted); font-size: 11.5px; }
.glass-scope .cart-item-total strong { color: var(--stv-ink); font-size: 14px; }
.glass-scope .remove-button { color: var(--stv-muted); background: rgba(255, 255, 255, .7); border: 1px solid rgba(255, 255, 255, .8); }
.glass-scope .remove-button:hover { color: #fff; background: var(--stv-red); border-color: var(--stv-red); }
.glass-scope .order-summary, .glass-scope .checkout-summary { background: rgba(255, 255, 255, .72); border: 1px solid rgba(255, 255, 255, .85); }
.glass-scope .order-summary, .glass-scope .checkout-summary { border-radius: 18px; }
.glass-scope .delivery-progress { display: grid; gap: 9px; padding: 13px 14px; background: rgba(255, 255, 255, .66); border: 1px solid rgba(255, 255, 255, .9); border-radius: 14px; }
.glass-scope .delivery-progress-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--stv-muted); font-size: 11.5px; }
.glass-scope .delivery-progress-head b { color: var(--stv-red); font-size: 11.5px; }
.glass-scope .progress-track { height: 7px; overflow: hidden; background: rgba(15, 15, 20, .1); border-radius: 999px; }
.glass-scope .progress-track i { display: block; height: 100%; background: linear-gradient(90deg, var(--stv-red), #c98fa8); border-radius: 999px; transition: width .45s ease; }
.glass-scope .delivery-free { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 14px; font-size: 11.5px; }
.glass-scope .empty-card { display: grid; justify-items: center; max-width: 470px; padding: 44px 32px; border-radius: 20px; text-align: center; }
.glass-scope .empty-card p { max-width: 330px; margin-top: 7px; color: var(--stv-muted); font-size: 13px; }
.glass-scope .empty-card .button { margin-top: 24px; }
.glass-scope a:focus-visible, .glass-scope button:focus-visible, .glass-scope input:focus-visible, .glass-scope select:focus-visible, .glass-scope textarea:focus-visible, .glass-scope [tabindex]:focus-visible { outline: 2px solid var(--stv-red); outline-offset: 3px; }
.glass-scope .cart-mobile-bar { display: none; }
@media (max-width: 820px) {
  .glass-scope .glass.checkout-summary, .glass-scope .glass.order-summary { position: static; top: auto; }
  .glass-scope .cart-items { padding: 4px 15px; }
  .glass-scope .cart-page { padding-bottom: 110px; }
  .glass-scope .cart-mobile-bar { position: fixed; right: 10px; bottom: calc(14px + env(safe-area-inset-bottom)); left: 10px; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px 10px 16px; background: rgba(255, 255, 255, .93); border: 1px solid rgba(225, 29, 46, .16); border-radius: 20px; box-shadow: 0 18px 38px rgba(15, 15, 20, .18); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); }
  .glass-scope .cart-mobile-bar > span { display: grid; gap: 1px; }
  .glass-scope .cart-mobile-bar small { color: var(--stv-muted); font-size: 11.5px; }
  .glass-scope .cart-mobile-bar strong { color: var(--stv-red); font-size: 19px; }
  .glass-scope .cart-mobile-bar .button { min-height: 48px; padding-inline: 18px; font-size: 14.5px; }
}
@media (max-width: 560px) {
  .glass-scope .cart-item-bottom { flex-direction: column; align-items: stretch; gap: 11px; }
  .glass-scope .cart-item-total { text-align: start; }
  .glass-scope .quantity-control { width: 100%; justify-content: space-between; }
  .glass-scope .cart-item-chips .chip { font-size: 11.5px; }
  .glass-scope .empty-card { padding: 34px 18px; }
  .glass-scope .cart-item-top { flex-wrap: wrap; }
  .glass-scope .cart-item-tools { flex-wrap: wrap; justify-content: flex-end; }
  .glass-scope .delivery-progress-head { flex-wrap: wrap; }
  .glass-scope .summary-line, .glass-scope .summary-total { flex-wrap: wrap; }
}
@media (max-width: 360px) {
  .glass-scope .cart-item { grid-template-columns: 74px 1fr; gap: 9px; }
  .glass-scope .cart-item-tools { width: 100%; justify-content: space-between; }
  .glass-scope .cart-item-image { height: 100px; }
}
@media (min-width: 1600px) {
  .glass-scope.container-stv { width: min(1320px, calc(100% - 96px)); }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .glass-scope *, .glass-scope *::before, .glass-scope *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`

export function CartPage({ cart, onUpdate, onRemove }: CartPageProps) {
  const { t, lang } = useT()
  const settings = useStoreSettings()
  const freeFrom = Math.max(0, settings.freeDeliveryFrom || 50000)
  const totals = getCartTotals(cart)
  const [announcement, setAnnouncement] = useState('')
  const itemsRef = useRef<HTMLElement>(null)
  const emptyRef = useRef<HTMLDivElement>(null)
  const previousCount = useRef(cart.length)

  useEffect(() => {
    const removed = cart.length < previousCount.current
    previousCount.current = cart.length
    if (!removed) return undefined
    const target = cart.length === 0 ? emptyRef.current : itemsRef.current
    if (!target) return undefined
    const timer = window.setTimeout(() => target.focus({ preventScroll: true }), 40)
    return () => window.clearTimeout(timer)
  }, [cart.length])

  const handleUpdate = (item: CartItem, nextQuantity: number) => {
    onUpdate(orderKey(item), nextQuantity)
    setAnnouncement(t('cart.updated').replace('{name}', item.product.name).replace('{meters}', String(nextQuantity)))
  }

  const handleRemove = (item: CartItem) => {
    onRemove(orderKey(item))
    setAnnouncement(t('cart.removed').replace('{name}', item.product.name))
  }

  if (cart.length === 0) {
    return (
      <main className="container-stv empty-state page-empty glass-scope">
        <style>{glassStyles}</style>
        <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
        <div className="glass glass-card empty-card" tabIndex={-1} ref={emptyRef}>
          <div className="empty-icon"><ShoppingBag size={26} /></div>
          <h1>{t('cart.emptyTitle')}</h1>
          <p>{t('cart.emptyText')}</p>
          <Link href="/catalog" className="button button-primary">{t('cart.browse')} <ArrowLeft size={16} /></Link>
        </div>
      </main>
    )
  }

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0)
  const remaining = Math.max(0, freeFrom - totals.subtotal)
  const progress = freeFrom ? Math.min(100, Math.round((totals.subtotal / freeFrom) * 100)) : 100

  return (
    <main className="container-stv cart-page glass-scope">
      <style>{glassStyles}</style>
      <div className="breadcrumbs">
        <Link href="/">{t('cart.home')}</Link>
        <span>›</span>
        <span>{t('cart.crumb')}</span>
      </div>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">{t('cart.eyebrow')}</span>
          <h1>{t('cart.title')}</h1>
          <p>{t('cart.inCart').replace('{meters}', String(totalQty))}</p>
        </div>
        <Link href="/catalog" className="underlined-link">{t('cart.continue')} <ArrowLeft size={15} /></Link>
      </div>
      <div className="cart-layout">
        <section className="cart-items glass glass-card" aria-label={t('cart.itemsAria')} tabIndex={-1} ref={itemsRef}>
          <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
          {cart.map((item) => {
            const key = orderKey(item)
            const maxStock = availableStock(item.product, item.color)
            const lineTotal = item.product.price * item.quantity
            return (
              <article className="cart-item" key={key}>
                <Link href={`/product/${item.product.slug}`} className="cart-item-image glass-card">
                  <SmartImage src={item.product.image} alt={item.product.name} sizes="76px" />
                </Link>
                <div className="cart-item-info">
                  <div className="cart-item-top">
                    <div className="cart-item-details">
                      <span className="product-type">{lang === 'en' ? typeLabelsEn[item.product.type] || item.product.type : item.product.type}</span>
                      <Link href={`/product/${item.product.slug}`} className="product-name">{item.product.name}</Link>
                      <div className="cart-item-chips">
                        <span className="chip glass-pill">{formatPrice(item.product.price)} / {t('cart.perMeter')}</span>
                        {item.size && <span className="chip glass-pill">{t('pd.sizeHeading')}: {item.size}</span>}
                      </div>
                    </div>
                    <div className="cart-item-tools">
                      <Link href={`/product/${item.product.slug}`} className="chip"><Pencil size={12} />{t('cart.edit')}</Link>
                      <button type="button" className="remove-button" onClick={() => handleRemove(item)} aria-label={t('cart.removeAria').replace('{name}', item.product.name)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="cart-item-bottom">
                    <div className="quantity-control compact">
                      <button type="button" onClick={() => handleUpdate(item, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={t('cart.decreaseAria').replace('{name}', item.product.name)}><Minus size={15} /></button>
                      <output aria-label={t('cart.qtyAria').replace('{name}', item.product.name)}>{item.quantity}</output>
                      <button type="button" onClick={() => handleUpdate(item, item.quantity + 1)} disabled={item.quantity >= maxStock} aria-label={t('cart.increaseAria').replace('{name}', item.product.name)}><Plus size={15} /></button>
                    </div>
                    <div className="cart-item-total">
                      <small>{item.quantity} × {formatPrice(item.product.price)}</small>
                      <strong>{formatPrice(lineTotal)}</strong>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
        <aside className="order-summary glass glass-strong" aria-label={t('cart.summary')}>
          <h2>{t('cart.summary')}</h2>
          {remaining > 0 ? (
            <div className="delivery-progress">
              <div className="delivery-progress-head">
                <span>{t('cart.freeAt').replace('{amount}', formatDinar(freeFrom))}</span>
                <b>{t('cart.remaining').replace('{amount}', formatDinar(remaining))}</b>
              </div>
              <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('cart.progressAria')}>
                <i style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="delivery-free glass-dark"><Truck size={16} /><span>{t('cart.freeUnlocked')}</span></div>
          )}
          <div className="glass-divider" />
          <div className="summary-line">
            <span>{t('cart.subtotal')}</span>
            <strong>{formatPrice(totals.subtotal)}</strong>
          </div>
          <div className="summary-line">
            <span>{t('cart.delivery')} <small>{t('cart.estimated')}</small></span>
            <strong>{totals.deliveryFee ? formatPrice(totals.deliveryFee) : t('cart.free')}</strong>
          </div>
          <div className="summary-total">
            <span>{t('cart.total')}</span>
            <strong>{formatPrice(totals.total)}</strong>
          </div>
          <Link href="/checkout" className="button button-primary summary-button">{t('cart.checkout')} <ArrowLeft size={16} /></Link>
          <p className="summary-note">{t('cart.summaryNote')}</p>
          <div className="summary-trust"><ShieldCheck size={16} /><span>{t('cart.savedNote')}</span></div>
        </aside>
      </div>
      <div className="cart-mobile-bar">
        <span><small>{t('cart.total')}</small><strong>{formatPrice(totals.total)}</strong></span>
        <Link href="/checkout" className="button button-primary">{t('cart.checkout')} <ArrowLeft size={15} /></Link>
      </div>
    </main>
  )
}
