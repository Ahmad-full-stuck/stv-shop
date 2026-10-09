import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react'
import { Link } from 'wouter'
import type { Category, Product, ProductColor } from '@/types'
import { useT } from '@/lib/i18n'
import { typeLabelsEn } from '@/lib/strings/catalog'
import { ProductCard } from '@/components/ProductCard'
import { GlassStyles } from '@/pages/InfoPages'

interface FavoritesPageProps {
  products: Product[]
  categories: Category[]
  wishlist: string[]
  onWish: (slug: string) => void
  onAdd: (product: Product, color: ProductColor, size: string, quantity: number) => void
}

const favoriteCountLabel = (count: number, t: (key: string) => string): string => {
  if (count === 1) return t('fav.countOne')
  if (count === 2) return t('fav.countTwo')
  if (count <= 10) return t('fav.countFew').replace('{n}', String(count))
  return t('fav.countMany').replace('{n}', String(count))
}

const fallbackSuggestions = [
  { id: 'jerseys', label: 'جيرزي' },
  { id: 'tracksuits', label: 'درستس' },
  { id: 'shoes', label: 'أحذية' },
  { id: 'accessories', label: 'إكسسوارات' },
  { id: 'equipment', label: 'معدات' },
]

export function FavoritesPage({ products, categories, wishlist, onWish, onAdd }: FavoritesPageProps) {
  const { t, lang } = useT()
  const favoriteProducts = products.filter((product) => wishlist.includes(product.slug))
  const suggestedCategories = categories.length > 0
    ? categories.slice(0, 5).map((category) => ({ id: category.id, label: category.name }))
    : fallbackSuggestions.map((item) => ({ id: item.id, label: lang === 'en' ? typeLabelsEn[item.id] ?? item.label : item.label }))

  if (favoriteProducts.length === 0) {
    return (
      <>
        <GlassStyles />
        <main className="container-stv favorites-page">
          <div className="breadcrumbs"><Link href="/">{t('fav.breadcrumbHome')}</Link><span>›</span><span>{t('fav.title')}</span></div>
          <section className="glass empty-glass" role="status">
            <div className="empty-icon"><Heart size={25} /></div>
            <h1>{t('fav.emptyTitle')}</h1>
            <p>{t('fav.emptyHint')}</p>
            <div className="empty-actions">
              <Link href="/catalog" className="button button-primary">{t('fav.browse')} <ArrowLeft size={16} /></Link>
              <Link href="/fabric-guide" className="button button-outline">{t('fav.guide')} <ArrowLeft size={16} /></Link>
            </div>
            <div className="local-orders">
              <span>{t('fav.suggested')}</span>
              {suggestedCategories.map((category) => (
                <Link key={category.id} href={`/catalog?category=${encodeURIComponent(category.id)}`} className="chip">{category.label}</Link>
              ))}
            </div>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <GlassStyles />
      <main className="container-stv favorites-page">
        <div className="breadcrumbs"><Link href="/">{t('fav.breadcrumbHome')}</Link><span>›</span><span>{t('fav.title')}</span></div>
        <div className="page-title-row">
          <div>
            <span className="eyebrow">{t('fav.eyebrow')}</span>
            <h1>{t('fav.title')}</h1>
            <p>{favoriteCountLabel(favoriteProducts.length, t)}</p>
          </div>
          <Link href="/catalog" className="underlined-link">{t('fav.continue')} <ArrowLeft size={15} /></Link>
        </div>

        <div className="product-grid favorites-grid">
          {favoriteProducts.map((product) => (
            <div className="glass-card favorite-tile" key={product.id}>
              <ProductCard product={product} wished onWish={onWish} onAdd={onAdd} />
              <div className="favorite-tile-actions">
                <button type="button" className="chip" onClick={() => onWish(product.slug)} aria-label={t('fav.removeAria').replace('{name}', product.name)}>
                  <Heart size={13} />{t('fav.removeBtn')}
                </button>
                <Link href={`/product/${product.slug}`} className="underlined-link">{t('fav.details')} <ArrowLeft size={14} /></Link>
              </div>
            </div>
          ))}
        </div>

        <div className="favorites-note"><ShoppingBag size={18} /><span>{t('fav.note')}</span></div>
      </main>
    </>
  )
}
