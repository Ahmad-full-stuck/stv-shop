import { useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, Heart, Home, Info, Languages, Menu, MessageCircle, PackageSearch, Search, ShieldCheck, ShoppingBag, Shirt, X } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import type { Product, SiteRoute } from '@/types'
import { useSiteContent } from '@/lib/site-content'
import { useT } from '@/lib/i18n'
import { routeLabelsEn } from '@/lib/strings/header'
import { Logo } from './Logo'
import { Modal } from './Modal'
import { SearchDialog } from './SearchDialog'

interface SiteHeaderProps {
  routes: SiteRoute[]
  products: Product[]
  cartQuantity: number
  wishlistCount: number
}

interface NavItem {
  id: string
  label: string
  path: string
}

const primaryNav: NavItem[] = [
  { id: 'home', label: 'header.nav.home', path: '/' },
  { id: 'catalog', label: 'header.nav.catalog', path: '/catalog' },
  { id: 'favorites', label: 'header.nav.favorites', path: '/favorites' },
  { id: 'guide', label: 'header.nav.guide', path: '/fabric-guide' },
  { id: 'about', label: 'header.nav.about', path: '/about' },
  { id: 'contact', label: 'header.nav.contact', path: '/contact' },
]

interface IconNavItem extends NavItem {
  Icon: typeof Home
}

const quickNav: IconNavItem[] = [
  { id: 'home', label: 'header.nav.home', path: '/', Icon: Home },
  { id: 'catalog', label: 'header.nav.catalog', path: '/catalog', Icon: Shirt },
  { id: 'favorites', label: 'header.nav.favorites', path: '/favorites', Icon: Heart },
  { id: 'guide', label: 'header.nav.guide', path: '/fabric-guide', Icon: BookOpen },
  { id: 'tracking', label: 'header.nav.tracking', path: '/order-tracking', Icon: PackageSearch },
  { id: 'about', label: 'header.nav.about', path: '/about', Icon: Info },
  { id: 'contact', label: 'header.nav.contact', path: '/contact', Icon: MessageCircle },
  { id: 'policies', label: 'header.nav.policies', path: '/policies', Icon: ShieldCheck },
]

const drawerGroups: { label: string; items: IconNavItem[] }[] = [
  {
    label: 'header.group.shopping',
    items: [
      { id: 'home', label: 'header.nav.home', path: '/', Icon: Home },
      { id: 'catalog', label: 'header.nav.allFabrics', path: '/catalog', Icon: Shirt },
      { id: 'favorites', label: 'header.nav.favorites', path: '/favorites', Icon: Heart },
      { id: 'cart', label: 'header.nav.cart', path: '/cart', Icon: ShoppingBag },
    ],
  },
  {
    label: 'header.group.service',
    items: [
      { id: 'guide', label: 'header.nav.guide', path: '/fabric-guide', Icon: BookOpen },
      { id: 'tracking', label: 'header.nav.tracking', path: '/order-tracking', Icon: PackageSearch },
      { id: 'contact', label: 'header.nav.contactUs', path: '/contact', Icon: MessageCircle },
      { id: 'about', label: 'header.nav.about', path: '/about', Icon: Info },
      { id: 'policies', label: 'header.nav.policiesShipping', path: '/policies', Icon: ShieldCheck },
    ],
  },
]

export function SiteHeader({ routes, products, cartQuantity, wishlistCount }: SiteHeaderProps) {
  const [location] = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const content = useSiteContent()
  const { lang, setLang, t } = useT()
  const pathname = location.split('?')[0]

  const withRoutes = <T extends NavItem>(items: T[]): T[] =>
    items.map((item) => {
      const matched = routes.find((route) => route.id === item.id)
      const path = matched ? matched.path : item.path
      const label = matched ? matched.label : t(item.label)
      return { ...item, path, label: lang === 'en' ? routeLabelsEn[item.id] ?? label : label }
    })

  const navItems = withRoutes(primaryNav)
  const quickItems = withRoutes(quickNav)
  const groups = drawerGroups.map((group) => ({ ...group, items: withRoutes(group.items) }))

  const isActive = (path: string): boolean => {
    const target = path.split('?')[0]
    if (target === pathname) return true
    if (target === '/catalog' && pathname.startsWith('/product/')) return true
    return false
  }

  const navigate = () => {
    setMenuOpen(false)
    setSearchOpen(false)
  }

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  return (
    <>
      <div className="announcement-bar" role="region" aria-label={t('header.announcementBar')}>
        <span className="announcement-msg announcement-msg-right">{content.announcementRight}</span>
        <span className="announcement-dot" />
        <Link href="/contact">{t('header.announceContact')}</Link>
        <span className="announcement-dot" />
        <span className="announcement-msg announcement-msg-left">{content.announcementLeft}</span>
      </div>
      <header className="site-header glass">
        <div className="container-stv header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label={t('header.mainNav')}>
            {navItems.map((route) => {
              const active = isActive(route.path)
              return (
                <Link key={route.id} href={route.path} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} onClick={navigate}>
                  {route.label}
                </Link>
              )
            })}
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-button" onClick={() => setSearchOpen(true)} aria-label={t('header.openSearch')} aria-haspopup="dialog" aria-expanded={searchOpen}>
              <Search size={19} />
            </button>
            <button
              type="button"
              className="icon-button lang-toggle"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              aria-label={t('core.langSwitchAria')}
              title={t('core.langSwitchAria')}
            >
              <Languages size={19} />
            </button>
            <Link href="/order-tracking" className="icon-button tracking-header" onClick={navigate} aria-label={t('header.nav.tracking')} title={t('header.nav.tracking')}>
              <PackageSearch size={19} />
            </Link>
            <Link href="/favorites" className="icon-button favorite-header" onClick={navigate} aria-label={t('header.favoritesAria').replace('{count}', String(wishlistCount))}>
              <Heart size={19} />
              {wishlistCount > 0 && <span>{wishlistCount}</span>}
            </Link>
            <Link href="/cart" className="cart-button" onClick={navigate} aria-label={t('header.cartAria').replace('{meters}', String(cartQuantity))}>
              <ShoppingBag size={17} />
              <span>{t('core.toastCart')}</span>
              {cartQuantity > 0 && <b>{cartQuantity}</b>}
            </Link>
            <button type="button" className="icon-button menu-toggle" onClick={() => setMenuOpen(true)} aria-label={t('header.openMenu')} aria-haspopup="dialog" aria-expanded={menuOpen}>
              <Menu size={20} />
            </button>
          </div>
        </div>
        <nav className="mobile-quick-nav" aria-label={t('header.quickNav')}>
          <div className="mobile-quick-nav-track">
            {quickItems.filter((i) => ["home","catalog","favorites","tracking"].includes(i.id)).map((item) => {
              const Icon = item.Icon
              const active = isActive(item.path)
              return (
                <Link key={item.id} href={item.path} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={navigate}>
                  <Icon size={14} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </header>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} products={products} />
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={t('header.menuTitle')} variant="drawer" className="mobile-drawer glass-strong">
        <div className="drawer-header">
          <Logo />
          <button type="button" className="icon-button drawer-close" onClick={() => setMenuOpen(false)} aria-label={t('header.closeMenu')}>
            <X size={20} />
          </button>
        </div>
        <div className="drawer-scroll">
          {groups.map((group) => (
            <div key={group.label} className="drawer-group">
              <p className="drawer-group-label">{t(group.label)}</p>
              <nav className="mobile-nav drawer-nav" aria-label={t(group.label)}>
                {group.items.map((route) => {
                  const Icon = route.Icon
                  const active = isActive(route.path)
                  return (
                    <Link key={route.id} href={route.path} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} onClick={navigate}>
                      <Icon size={18} aria-hidden="true" />
                      <span>{route.label}</span>
                      <ChevronLeft size={16} className="drawer-chevron" aria-hidden="true" />
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
          <div className="glass-divider" />
          <div className="drawer-contact">
            <Link className="chip drawer-chip drawer-chip-primary" href="/contact" onClick={navigate}>
              <MessageCircle size={17} />
              {t('header.announceContact')}
            </Link>
            <Link className="chip drawer-chip" href="/order-tracking" onClick={navigate}>
              <PackageSearch size={17} />
              {t('header.chip.trackOrder')}
            </Link>
          </div>
        </div>
      </Modal>
    </>
  )
}

