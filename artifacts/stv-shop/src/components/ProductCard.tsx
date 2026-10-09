import { Heart, Plus, ShoppingBag } from 'lucide-react'
import { Link } from 'wouter'
import type { Product, ProductColor } from '@/types'
import { useT } from '@/lib/i18n'
import { formatPrice, isSoldOut } from '@/lib/catalog'
import { typeLabelEn } from '@/lib/strings/catalog'
import { SmartImage } from '@/components/ui/SmartImage'

interface ProductCardProps {
  product: Product
  wished: boolean
  onWish: (slug: string) => void
  onAdd: (product: Product, color: ProductColor, size: string, quantity: number) => void
  priority?: boolean
}

const glassStyles = `
.glass-card {
  border: 1px solid rgba(255, 255, 255, .75);
  border-radius: 20px;
  background: linear-gradient(155deg, rgba(255, 255, 255, .8), rgba(255, 250, 250, .46));
  box-shadow: 0 14px 34px rgba(74, 24, 43, .1);
  backdrop-filter: blur(16px) saturate(1.15);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
}
.glass-surface {
  border: 1px solid rgba(255, 255, 255, .8);
  border-radius: 22px;
  background: linear-gradient(150deg, rgba(255, 255, 255, .78), rgba(255, 250, 250, .44));
  box-shadow: 0 16px 38px rgba(74, 24, 43, .1);
  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
}
.glass-pill {
  border: 1px solid rgba(255, 255, 255, .85);
  border-radius: 999px;
  background: linear-gradient(140deg, rgba(255, 255, 255, .85), rgba(255, 250, 250, .55));
  box-shadow: 0 8px 22px rgba(74, 24, 43, .08);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
}
.product-card.glass-card {
  position: relative;
  padding: 10px;
  transition: transform .35s cubic-bezier(.2, .7, .3, 1), box-shadow .35s ease, border-color .35s ease;
}
.product-card.glass-card:hover {
  transform: translateY(-6px);
  border-color: rgba(225, 29, 46, .38);
  box-shadow: 0 26px 48px rgba(225, 29, 46, .18);
}
@media (max-width: 560px) {
  .product-card.glass-card { padding: 10px 10px 14px; }
}
.product-card.glass-card .product-card-media {
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(232, 220, 211, .92), rgba(248, 243, 237, .75));
}
.product-card.glass-card .product-card-image { transition: transform .5s ease; }
.product-card.glass-card .product-card-body { padding: 13px 0 3px; }
.product-card.glass-card .badge {
  border: 1px solid rgba(255, 255, 255, .5);
  box-shadow: 0 4px 12px rgba(40, 26, 26, .18);
  backdrop-filter: blur(9px);
  -webkit-backdrop-filter: blur(9px);
}
.product-card.glass-card .badge-accent { background: rgba(225, 29, 46, .85); }
.product-card.glass-card .badge-warm { background: rgba(217, 121, 67, .88); }
.product-card.glass-card .badge-muted { background: rgba(255, 252, 249, .88); }
.product-card.glass-card .product-wish {
  background: rgba(44, 30, 30, .34);
  transition: background-color .2s ease, color .2s ease, transform .2s ease;
}
.product-card.glass-card .product-wish:hover,
.product-card.glass-card .product-wish.is-active { transform: scale(1.08); }
.product-card.glass-card .add-button {
  background: rgba(255, 255, 255, .74);
  backdrop-filter: blur(9px);
  -webkit-backdrop-filter: blur(9px);
}
.product-card.glass-card .add-button:hover:not(:disabled) { background: #fff; }
.skeleton-shimmer { position: relative; }
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(100deg, rgba(255, 255, 255, 0) 28%, rgba(255, 255, 255, .72) 50%, rgba(255, 255, 255, 0) 72%);
  background-size: 220% 100%;
  animation: skeleton-shimmer 1.5s linear infinite;
}
@keyframes skeleton-shimmer { from { background-position: 140% 0; } to { background-position: -140% 0; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  .product-card.glass-card:hover,
  .product-card:hover .product-card-image,
  .product-card.glass-card .product-wish:hover,
  .chip:hover,
  .chip.chip-active:hover,
  .button:hover { transform: none !important; }
}
`

const injectStyles = (id: string, css: string) => {
  if (typeof document === 'undefined' || document.getElementById(id)) return
  const node = document.createElement('style')
  node.id = id
  node.textContent = css
  document.head.appendChild(node)
}

injectStyles('stv-glass-styles', glassStyles)

export function ProductCard({ product, wished, onWish, onAdd, priority = false }: ProductCardProps) {
  const { t, lang } = useT()
  const addColor = product.colors.find((color) => color.available && color.stock > 0) || product.colors[0]
  const soldOut = !addColor || isSoldOut(product)
  const lowStock = !soldOut && product.stock > 0 && product.stock <= 3
  const wishLabel = wished ? t('card.wishRemove').replace('{name}', product.name) : t('card.wishAdd').replace('{name}', product.name)
  const addLabel = t('card.addHalfAria').replace('{name}', product.name)
  const detailPath = `/product/${product.slug}`

  return (
    <article className="product-card glass-card">
      <div className="product-card-media">
        <Link href={detailPath} className="product-card-image-link" aria-label={t('card.detailsAria').replace('{name}', product.name)}>
          <span className="card-image-stack">
            <span className="card-image-layer is-active">
              <SmartImage
                src={product.image}
                alt={product.name}
                className="product-card-image"
                sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 22vw"
                intrinsicWidth={1024}
                intrinsicHeight={1024}
                priority={priority}
                onError={(event) => {
                  const node = event.currentTarget
                  const stack = [...new Set([product.image, ...product.images].filter(Boolean))]
                  const attempt = Number(node.dataset.attempt || 0)
                  const next = stack[attempt + 1]
                  if (next) {
                    node.dataset.attempt = String(attempt + 1)
                    node.src = next
                  } else {
                    node.style.display = 'none'
                  }
                }}
              />
            </span>
          </span>
        </Link>
        <div className="product-card-badges">
          {product.categoryId === 'style' && <span className="badge badge-muted">{t('card.badgeStyle')}</span>}
          {product.isNew && <span className="badge badge-accent">{t('card.badgeNew')}</span>}
          {lowStock && <span className="badge badge-warm">{t('card.badgeLow')}</span>}
          {soldOut && <span className="badge badge-muted">{t('card.badgeSold')}</span>}
        </div>
        <button
          type="button"
          className={`product-wish ${wished ? 'is-active' : ''}`}
          onClick={() => onWish(product.slug)}
          aria-label={wishLabel}
          aria-pressed={wished}
          title={wishLabel}
        >
          <Heart size={17} fill={wished ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <div className="product-card-body">
        <div className="product-card-heading">
          <div>
            <p className="product-type">{lang === 'en' ? typeLabelEn(product.type) : product.type}</p>
            <Link href={detailPath} className="product-name">{product.name}</Link>
          </div>
          <span className="product-price">{formatPrice(product.price)}<small>{t('card.perMeter')}</small></span>
        </div>
        <div className="product-card-footer">
          <button
            type="button"
            className="add-button"
            disabled={soldOut}
            onClick={() => addColor && onAdd(product, addColor, product.sizes[0] || 'M', 1)}
            aria-label={addLabel}
          >
            {soldOut ? t('card.soldOut') : <><ShoppingBag size={14} aria-hidden="true" /><span>{t('card.addHalf')}</span></>}
          </button>
        </div>
      </div>
    </article>
  )
}

export function ProductGridSkeleton() {
  const { t } = useT()
  return (
    <div className="product-grid" role="status" aria-busy="true" aria-label={t('card.loadingAria')}>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="product-skeleton skeleton-shimmer" aria-hidden="true"><div /><span /><span /></div>
      ))}
    </div>
  )
}

export function InlineAddButton({ product, onAdd }: { product: Product; onAdd: (product: Product, color: ProductColor, size: string, quantity: number) => void }) {
  const { t } = useT()
  const color = product.colors.find((item) => item.available)
  return (
    <button
      type="button"
      className="icon-button"
      disabled={!color}
      onClick={() => color && onAdd(product, color, product.sizes[0] || 'M', 1)}
      aria-label={t('card.addToCartAria').replace('{name}', product.name)}
    >
      <Plus size={18} aria-hidden="true" />
    </button>
  )
}
