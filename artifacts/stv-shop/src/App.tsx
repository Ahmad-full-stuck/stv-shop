import { useEffect, useLayoutEffect, useState, type MouseEvent } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { Link } from 'wouter'
import { ArrowLeft, Check, ShoppingBag } from 'lucide-react'
import type { CartItem, Product, ProductColor } from '@/types'
import { useStoreData } from '@/hooks/use-store-data'
import { LangProvider, useT } from '@/lib/i18n'
import { addCartItem, getStoredCart, getStoredWishlist, reconcileCart, removeCartItem, setStoredCart, setStoredWishlist, updateCartItem } from '@/lib/storage'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { AdminSecret } from '@/components/AdminSecret'
import { HomePage } from '@/pages/HomePage'
import { CatalogPage } from '@/pages/CatalogPage'
import { ProductPage } from '@/pages/ProductPage'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { AboutPage, ContactPage, FabricGuidePage, OrderConfirmationPage, OrderTrackingPage, PoliciesPage } from '@/pages/InfoPages'
import NotFound from '@/pages/not-found'

const shellStyles = `
.skip-link { position: fixed; top: 14px; right: 14px; z-index: 140; display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; color: #fff6f8; background: var(--stv-red); border: 1px solid rgba(255, 255, 255, .4); border-radius: 999px; box-shadow: var(--eva-shadow-small); backdrop-filter: blur(10px); font-size: 12px; font-weight: 600; transform: translateY(-190%); transition: transform .2s ease; }
.skip-link:focus { transform: translateY(0); }
.app-main { scroll-margin-top: 116px; }
.footer-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px 34px; padding-top: 46px; }
.footer-top p { margin-top: 0; }
.footer-top .social-links { margin-top: 0; }
.footer-col { display: flex; flex-direction: column; align-items: flex-start; }
.mobile-nav a.is-active { color: var(--stv-red); font-weight: 600; }
@media (max-width: 1100px) {
  .desktop-nav { gap: 14px; }
  .desktop-nav a { font-size: 11.5px; }
}
@media (max-width: 980px) {
  .header-inner { gap: 14px; }
  .desktop-nav { gap: 11px; }
  .desktop-nav a { font-size: 11.5px; }
}
@media (max-width: 820px) {
  .toast { bottom: calc(20px + env(safe-area-inset-bottom)); }
}
@media (max-width: 560px) {
  .header-inner { gap: 8px; }
  .header-actions { gap: 0; }
  .header-actions .favorite-header, .header-actions .cart-button { display: inline-flex; }
}
@media (max-width: 400px) {
  .header-inner { gap: 6px; }
  .logo-copy strong { font-size: 13px; }
  .logo-copy small { font-size: 9px; }
  .cart-button { padding: 7px 10px; }
}
  @media (prefers-reduced-motion: reduce) {
  .skip-link, .site-header, .site-header *, .site-footer, .site-footer *, .modal-layer, .modal-layer *, .toast, .toast * { transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
`

const PAGE_SEO: Record<string, { title: string; desc: string }> = {
  '/': { title: 'STV Shop | تجهيزات رياضية من كركوك', desc: 'STV Shop — كل ما يحتاجه الرياضي: قمصان أندية، درستس، أحذية، إكسسوارات ومعدات رياضية. توصيل لكل المحافظات بـ ٥ آلاف دينار — كركوك مقابل بوليفارد.' },
  '/catalog': { title: 'كل المنتجات | STV Shop', desc: 'تصفّح تشكيلة STV Shop: قمصان أندية، درستس، أحذية رياضية، إكسسوارات ومعدات — بأسعار واضحة ومقاسات من S إلى XXL.' },
  '/cart': { title: 'سلة المشتريات | STV Shop', desc: 'راجعي منتجاتك المختارة وأسعارها قبل إتمام الطلب مع التوصيل لكل المحافظات.' },
  '/checkout': { title: 'إتمام الطلب | STV Shop', desc: 'أدخلي بياناتك لتأكيد طلبك من STV Shop مع الدفع عند الاستلام والتوصيل إلى جميع محافظات العراق.' },
  '/favorites': { title: 'المفضلة | STV Shop', desc: 'المنتجات التي حفظتها من STV Shop للرجوع إليها لاحقاً.' },
  '/about': { title: 'من نحن | STV Shop', desc: 'قصة STV Shop من كركوك — جودة تثق بها وخدمة تليق بك.' },
  '/fabric-guide': { title: 'دليل المقاسات | STV Shop', desc: 'كيف تختار المقاس المناسب؟ دليل عملي للجيرزي والدرستس والحذاء مع أسئلة شائعة.' },
  '/contact': { title: 'تواصلي معنا | STV Shop', desc: 'راسلنا عبر واتساب 07701871844 أو نموذج الموقع — STV Shop كركوك مقابل بوليفارد، يومياً ١٠ صباحاً حتى ١٠ ليلاً.' },
  '/policies': { title: 'السياسات والخصوصية | STV Shop', desc: 'سياسات الشحن والإرجاع والخصوصية الخاصة بمتجر STV Shop.' },
  '/order-tracking': { title: 'تتبع الطلب | STV Shop', desc: 'تتبع حالة طلبك برقم الطلب الخاص بك.' },
  '/order-confirmation': { title: 'تم تسجيل طلبك | STV Shop', desc: 'تم تسجيل طلبك بنجاح، سنتواصل معك قريباً لتأكيد التفاصيل.' },
}

const PAGE_SEO_EN: Record<string, { title: string; desc: string }> = {
  '/': { title: 'STV Shop | Sports gear from Kirkuk', desc: 'STV Shop — everything an athlete needs: club jerseys, tracksuits, shoes, accessories and fitness gear. Delivery across Iraq for 5,000 IQD.' },
  '/catalog': { title: 'All products | STV Shop', desc: 'Browse STV Shop: club jerseys, tracksuits, sports shoes, accessories and equipment — clear prices, sizes S to XXL.' },
  '/cart': { title: 'Shopping cart | STV Shop', desc: 'Review your selected items and prices before checkout with delivery across Iraq.' },
  '/checkout': { title: 'Checkout | STV Shop', desc: 'Enter your details to confirm your STV Shop order with cash on delivery across Iraq.' },
  '/favorites': { title: 'Favorites | STV Shop', desc: 'The STV Shop items you saved to come back to later.' },
  '/about': { title: 'About us | STV Shop', desc: 'The story of STV Shop from Kirkuk — quality you trust, service that fits.' },
  '/fabric-guide': { title: 'Size guide | STV Shop', desc: 'How to pick the right size? A practical guide for jerseys, tracksuits and shoes with FAQs.' },
  '/contact': { title: 'Contact us | STV Shop', desc: 'Reach us on WhatsApp 07701871844 or the site form — STV Shop, Kirkuk, daily 10am–10pm.' },
  '/policies': { title: 'Policies & privacy | STV Shop', desc: 'Shipping, returns and privacy policies for STV Shop.' },
  '/order-tracking': { title: 'Track order | STV Shop', desc: 'Track your order status using your order number.' },
  '/order-confirmation': { title: 'Order received | STV Shop', desc: 'Your order was registered successfully — we will contact you shortly to confirm the details.' },
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function AppShell() {
  const { products, categories, routes, status } = useStoreData()
  const { t, lang } = useT()
  const [location, setLocation] = useLocation()
  const [cart, setCart] = useState<CartItem[]>(() => getStoredCart(products))
  const [wishlist, setWishlist] = useState<string[]>(() => getStoredWishlist())
  const [notice, setNoticeState] = useState<{ text: string; link?: 'cart' | 'wishlist' } | null>(null)
  const setNotice = (text: string, link?: 'cart' | 'wishlist') => setNoticeState({ text, link })
  const pathname = location.split('?')[0]

  useEffect(() => {
    const seo = lang === 'en' ? PAGE_SEO_EN : PAGE_SEO
    const product = pathname.startsWith('/product/')
      ? products.find((item) => `/product/${item.slug}` === pathname)
      : undefined
    const fallback = pathname.startsWith('/order-confirmation') ? seo['/order-confirmation'] : undefined
    const entry = product
      ? { title: `${product.name} | ${lang === 'en' ? 'STV Shop' : 'STV Shop'}`, desc: product.description || seo['/catalog'].desc }
      : seo[pathname] ?? fallback
    document.title = entry?.title ?? seo['/'].title
    if (entry?.desc) document.querySelector('meta[name="description"]')?.setAttribute('content', entry.desc)
  }, [pathname, products, lang])

  useEffect(() => {
    if (status === 'loading') return
    setCart((current) => reconcileCart(current, products))
  }, [products, status])

  useEffect(() => {
    if (status === 'loading') return
    setStoredCart(cart)
  }, [cart, status])

  useEffect(() => {
    setStoredWishlist(wishlist)
  }, [wishlist])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNoticeState(null), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const addToCart = (product: Product, color: ProductColor, size: string, quantity: number) => {
    const result = addCartItem(cart, product, color, size, quantity)
    if (!result.available) {
      setNotice(t('core.noticeUnavailable'))
      return
    }
    setCart(result.cart)
    setNotice(result.capped
      ? t('core.noticeCapped').replace('{name}', product.name)
      : t('core.noticeAdded').replace('{name}', product.name), 'cart')
  }

  const toggleWishlist = (slug: string) => {
    setWishlist((current) => {
      const exists = current.includes(slug)
      setNotice(exists ? t('core.noticeWishRemoved') : t('core.noticeWishAdded'), 'wishlist')
      return exists ? current.filter((item) => item !== slug) : [...current, slug]
    })
  }

  const updateCart = (key: string, quantity: number) => setCart((current) => updateCartItem(current, key, quantity))
  const deleteCart = (key: string) => setCart((current) => removeCartItem(current, key))
  const completeOrder = (orderNumber: string) => {
    setCart([])
    setStoredCart([])
    setNotice(t('core.noticeOrderSaved'))
    setLocation(`/order-confirmation/${encodeURIComponent(orderNumber)}`)
  }
  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('main-content')?.focus()
  }
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)
  const pageProps = { products, categories, wishlist, onWish: toggleWishlist, onAdd: addToCart }

  return (
    <div className="app-shell" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <style>{shellStyles}</style>
      <a className="skip-link" href="#main-content" onClick={skipToContent}>{t('core.skipLink')}</a>
      <SiteHeader routes={routes} products={products} cartQuantity={cartQuantity} wishlistCount={wishlist.length} />
      <div id="main-content" className="app-main" tabIndex={-1}>
        <Switch>
          <Route path="/" component={() => <HomePage {...pageProps} />} />
          <Route path="/catalog" component={() => <CatalogPage {...pageProps} status={status} />} />
          <Route path="/product/:slug">{(params) => <ProductPage {...pageProps} slug={params.slug} />}</Route>
          <Route path="/cart" component={() => <CartPage cart={cart} onUpdate={updateCart} onRemove={deleteCart} />} />
          <Route path="/checkout" component={() => <CheckoutPage cart={cart} onComplete={completeOrder} />} />
          <Route path="/favorites" component={() => <FavoritesPage {...pageProps} />} />
          <Route path="/about" component={AboutPage} />
          <Route path="/fabric-guide" component={FabricGuidePage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/policies" component={PoliciesPage} />
          <Route path="/order-tracking" component={OrderTrackingPage} />
          <Route path="/order-confirmation/:orderNumber">{(params) => <OrderConfirmationPage orderNumber={safeDecode(params.orderNumber)} />}</Route>
          <Route path="/admin" component={() => null} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <SiteFooter routes={routes} categories={categories} />
      <AdminSecret products={products} categories={categories} />
      <div className="toast-container">
        {notice && (
          <div className="toast" role="status" aria-live="polite">
            <span className="toast-icon"><Check size={15} /></span>
            <span>{notice.text}</span>
            {notice.link === 'cart' && <Link href="/cart" className="toast-link"><ShoppingBag size={14} />{t('core.toastCart')}</Link>}
            {notice.link === 'wishlist' && <Link href="/favorites" className="toast-link">{t('core.toastWishlist')}</Link>}
            <button type="button" className="toast-close" onClick={() => setNoticeState(null)} aria-label={t('core.toastClose')}><ArrowLeft size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AppShell />
    </LangProvider>
  )
}
