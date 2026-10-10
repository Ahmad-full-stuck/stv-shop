import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Filter, Layers, Package, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import { Link, useLocation, useSearch } from 'wouter'
import type { Category, Product, ProductColor } from '@/types'
import { useT } from '@/lib/i18n'
import { formatPrice, isSoldOut, normalizeArabic } from '@/lib/catalog'
import { ProductCard, ProductGridSkeleton } from '@/components/ProductCard'
import { Modal } from '@/components/Modal'
import { prefetchImages, thumbUrl } from '@/lib/prefetch'

interface CatalogPageProps {
  products: Product[]
  categories: Category[]
  status: 'loading' | 'ready' | 'fallback'
  wishlist: string[]
  onWish: (slug: string) => void
  onAdd: (product: Product, color: ProductColor, size: string, quantity: number) => void
}

type SortKey = 'featured' | 'price-asc' | 'price-desc'
type ParamChanges = Record<string, string | null>

const SORT_OPTIONS: { value: SortKey; labelKey: string }[] = [
  { value: 'featured', labelKey: 'cat.sortFeatured' },
  { value: 'price-asc', labelKey: 'cat.sortPriceAsc' },
  { value: 'price-desc', labelKey: 'cat.sortPriceDesc' },
]

const STOP_WORDS = new Set(['قماش', 'القماش', 'اقمشه', 'الاقمشه', 'fabric'])

const PAGE_SIZE = 24

const catalogStyles = `
.chip-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 4px 2px 10px;
  margin-bottom: 14px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}
.chip-row::-webkit-scrollbar { display: none; }
.chip-row .chip { flex: 0 0 auto; min-height: 44px; padding: 10px 18px; font-size: 12px; font-weight: 600; scroll-snap-align: start; }
.chip-count {
  min-width: 24px;
  height: 21px;
  display: inline-grid;
  place-items: center;
  padding-inline: 7px;
  color: var(--stv-red);
  background: rgba(225, 29, 46, .12);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
}
.chip.chip-active .chip-count, .chip[aria-pressed="true"] .chip-count { color: #fff; background: rgba(255, 255, 255, .24); }
.stats-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 18px; margin-top: 18px; color: var(--stv-muted); font-size: 11.5px; }
.stats-bar.glass-card { padding: 14px 20px; }
.stats-bar.glass-card:hover { transform: none; box-shadow: var(--glass-shadow); }
.stat-item { display: inline-flex; align-items: center; gap: 7px; }
.stat-item svg { flex: 0 0 auto; color: var(--stv-red); }
.stat-item strong { color: var(--stv-red); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.stat-divider { width: 1px; height: 16px; background: rgba(15, 15, 20, .12); }
.empty-state.glass-card { padding: 62px 24px; margin-top: 4px; }
.empty-state.glass-card:hover { transform: none; box-shadow: var(--glass-shadow); }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 7px; margin-top: 30px; }
.pager-btn { min-width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 6px; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--stv-ink); background: rgba(255, 255, 255, .78); border: 1px solid rgba(255, 255, 255, .9); border-radius: 13px; box-shadow: 0 6px 16px -12px rgba(15, 15, 20, .3); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: pointer; font-variant-numeric: tabular-nums; transition: background .18s ease, color .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.pager-btn:hover:not(:disabled) { color: var(--stv-red); border-color: rgba(225, 29, 46, .35); transform: translateY(-1px); }
.pager-btn.is-active { color: #fff; background: var(--stv-red); border-color: var(--stv-red); box-shadow: 0 10px 22px -12px rgba(225, 29, 46, .55); }
.pager-btn.is-active:hover { color: #fff; transform: none; }
.pager-btn:focus-visible { outline: 2px solid var(--stv-red); outline-offset: 2px; }
.pager-gap { min-width: 24px; text-align: center; color: var(--stv-muted); font-size: 13px; letter-spacing: 1px; }
.filter-panel-title strong { display: inline-flex; align-items: center; gap: 7px; }
.filter-panel .filter-browse { width: 100%; min-height: 44px; justify-content: space-between; padding: 10px 0; border-top: 1px solid rgba(15, 15, 20, .08); }
.filter-drawer .filter-panel { padding: 4px 24px 0; background: transparent; border: 0; border-radius: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
.catalog-search input[type="search"] { -webkit-appearance: none; appearance: none; }
.catalog-search input[type="search"]::-webkit-search-cancel-button { display: none; }
@media (max-width: 560px) {
  .chip-row { gap: 7px; margin-bottom: 10px; }
  .chip-row .chip { padding: 9px 15px; font-size: 11.5px; }
  .stats-bar { justify-content: flex-start; gap: 6px 14px; }
  .stats-bar.glass-card { padding: 12px 14px; }
  .stat-item { font-size: 11.5px; }
  .stat-divider { display: none; }
  .empty-state.glass-card { padding: 48px 16px; }
}
`

const injectStyles = (id: string, css: string) => {
  if (typeof document === 'undefined' || document.getElementById(id)) return
  const node = document.createElement('style')
  node.id = id
  node.textContent = css
  document.head.appendChild(node)
}

injectStyles('stv-catalog-styles', catalogStyles)

const toWesternDigits = (value: string): string => value
  .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))

const parseAmount = (raw: string | null): number | null => {
  if (!raw) return null
  const western = toWesternDigits(raw).replace(/[^\d.]/g, '')
  if (!western) return null
  const value = Number(western)
  return Number.isFinite(value) && value >= 0 ? value : null
}

const readSort = (raw: string | null): SortKey => (SORT_OPTIONS.some((option) => option.value === raw) ? (raw as SortKey) : 'featured')

const belongsToCategory = (product: Product, category: Category): boolean =>
  product.categoryId === category.id || product.categoryId === category.name || product.categoryId === category.slug

const buildQuery = (location: string, browserSearch: string): string => {
  const inline = location.includes('?') ? location.slice(location.indexOf('?') + 1) : ''
  const merged = new URLSearchParams(inline)
  new URLSearchParams(browserSearch.replace(/^\?/, '')).forEach((value, key) => merged.set(key, value))
  return merged.toString()
}

const matchesQuery = (product: Product, query: string, categories: Category[]): boolean => {
  const clean = normalizeArabic(query)
  if (!clean) return true
  const words = clean.split(' ').filter((word) => word && !STOP_WORDS.has(word))
  if (words.length === 0) return true
  const category = categories.find((item) => item.id === product.categoryId)
  const text = normalizeArabic([
    product.name,
    product.type,
    product.description,
    product.slug,
    product.categoryId,
    product.specs.material,
    product.specs.brand,
    product.specs.use,
    product.specs.origin,
    product.sizes.join(' '),
    product.colors.map((color) => color.name).join(' '),
    category ? `${category.name} ${category.description} ${category.slug}` : '',
    ...product.colors.map((item) => item.name),
  ].join(' '))
  return words.every((word) => text.includes(word))
}

export function CatalogPage({ products, categories, status, wishlist, onWish, onAdd }: CatalogPageProps) {
  const { t } = useT()
  const [location, navigate] = useLocation()
  const browserSearch = useSearch()

  const query = useMemo(() => buildQuery(location, browserSearch), [browserSearch, location])
  const params = useMemo(() => new URLSearchParams(query), [query])

  const categoryId = params.get('category') || ''
  const search = params.get('search') || ''
  const inStock = params.get('stock') === '1'
  const minRaw = params.get('min') || ''
  const maxRaw = params.get('max') || ''
  const sort = readSort(params.get('sort'))
  const minPrice = parseAmount(minRaw)
  const maxPrice = parseAmount(maxRaw)

  const [searchInput, setSearchInput] = useState(search)
  const [minInput, setMinInput] = useState(minRaw)
  const [maxInput, setMaxInput] = useState(maxRaw)
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const resultsRef = useRef<HTMLElement | null>(null)

  useEffect(() => setSearchInput(search), [search])
  useEffect(() => setMinInput(minRaw), [minRaw])
  useEffect(() => setMaxInput(maxRaw), [maxRaw])

  const pathname = location.split('?')[0]
  useEffect(() => setFilterOpen(false), [pathname])

  const scrollToResults = () => {
    const el = resultsRef.current
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 118
    window.scrollTo({ top: Math.max(0, y), behavior: 'auto' })
  }

  const filterSig = [categoryId, inStock, minRaw, maxRaw, sort, search].join('|')
  const firstSigRef = useRef(true)
  useEffect(() => {
    if (firstSigRef.current) {
      firstSigRef.current = false
      return
    }
    setPage(1)
    scrollToResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig])

  const updateParams = (changes: ParamChanges, replace = false) => {
    const next = new URLSearchParams(query)
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    })
    const nextSearch = next.toString()
    navigate(nextSearch ? `/catalog?${nextSearch}` : '/catalog', { replace })
  }

  const clearFilters = () => {
    setSearchInput('')
    setMinInput('')
    setMaxInput('')
    updateParams({ category: null, search: null, stock: null, min: null, max: null })
  }

  const activeCategory = useMemo(
    () => categories.find((item) => item.id === categoryId || item.name === categoryId || item.slug === categoryId) || null,
    [categories, categoryId],
  )
  const activeCategoryId = activeCategory ? activeCategory.id : ''

  const priceRange = useMemo(() => {
    if (minPrice === null && maxPrice === null) return { min: null, max: null }
    if (minPrice === null) return { min: null, max: maxPrice }
    if (maxPrice === null) return { min: minPrice, max: null }
    return minPrice <= maxPrice ? { min: minPrice, max: maxPrice } : { min: maxPrice, max: minPrice }
  }, [maxPrice, minPrice])

  const shown = useMemo(() => {
    const list = products.filter((product) => {
      if (categoryId) {
        const categoryMatch = activeCategory
          ? belongsToCategory(product, activeCategory)
          : product.categoryId === categoryId
        if (!categoryMatch) return false
      }
      if (inStock && isSoldOut(product)) return false
      if (priceRange.min !== null && product.price < priceRange.min) return false
      if (priceRange.max !== null && product.price > priceRange.max) return false
      return matchesQuery(product, search, categories)
    })
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price || Number(b.isFeatured) - Number(a.isFeatured)
      if (sort === 'price-desc') return b.price - a.price || Number(b.isFeatured) - Number(a.isFeatured)
      return Number(b.isFeatured) - Number(a.isFeatured) || Number(b.isNew) - Number(a.isNew) || b.createdAt.localeCompare(a.createdAt)
    })
    return sorted
  }, [activeCategory, categoryId, categories, inStock, priceRange, products, search, sort])

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = useMemo(() => shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [shown, safePage])
  const pageItems = useMemo<(number | '…')[]>(() => {
    const items: (number | '…')[] = []
    const push = (n: number) => { if (n >= 1 && n <= pageCount && !items.includes(n)) items.push(n) }
    push(1)
    if (safePage > 3) items.push('…')
    for (let n = safePage - 1; n <= safePage + 1; n += 1) push(n)
    if (safePage < pageCount - 2) items.push('…')
    push(pageCount)
    return items
  }, [pageCount, safePage])
  const goPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), pageCount))
    scrollToResults()
  }
  const warmPage = (target: number) => {
    const start = (Math.min(Math.max(1, target), pageCount) - 1) * PAGE_SIZE
    prefetchImages(shown.slice(start, start + PAGE_SIZE).map((product) => product.image))
  }

  const availableCount = shown.filter((product) => !isSoldOut(product)).length
  const averagePrice = shown.length ? Math.round(shown.reduce((total, product) => total + product.price, 0) / shown.length) : 0
  const activeCount = Number(Boolean(categoryId)) + Number(inStock) + Number(minPrice !== null) + Number(maxPrice !== null) + Number(Boolean(search))
  const priceLabel = priceRange.min !== null && priceRange.max !== null
    ? `${formatPrice(priceRange.min)} — ${formatPrice(priceRange.max)}`
    : priceRange.min !== null
      ? t('cat.priceFromLabel').replace('{price}', formatPrice(priceRange.min))
      : priceRange.max !== null
        ? t('cat.priceUntilLabel').replace('{price}', formatPrice(priceRange.max))
        : ''
  const statusLabel = status === 'loading' ? t('cat.statusLoading') : status === 'fallback' ? t('cat.statusFallback') : t('cat.statusLive')

  const chips = useMemo(() => [
    { id: '', label: t('cat.chipAll'), count: products.length },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
      count: products.filter((product) => belongsToCategory(product, category)).length,
    })),
  ], [categories, products, t])

  const chipThumbs = useMemo(() => {
    const map = new Map<string, (string | null)[]>()
    map.set('', products.map((product) => thumbUrl(product.image)))
    for (const category of categories) {
      map.set(category.id, products.filter((product) => belongsToCategory(product, category)).map((product) => thumbUrl(product.image)))
    }
    return map
  }, [categories, products])

  useEffect(() => {
    if (shown.length === 0) return
    prefetchImages(shown.slice(0, 96).map((product) => product.image))
  }, [shown])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    updateParams({ search: searchInput.trim() || null })
  }

  const resetSearch = () => {
    setSearchInput('')
    updateParams({ search: null })
  }

  const changeMin = (value: string) => {
    setMinInput(value)
    updateParams({ min: value.trim() || null }, true)
  }

  const changeMax = (value: string) => {
    setMaxInput(value)
    updateParams({ max: value.trim() || null }, true)
  }

  const renderFilterPanel = (scope: string) => (
    <FilterPanel
      scope={scope}
      categories={categories}
      categoryId={categoryId}
      activeCategoryId={activeCategoryId}
      inStock={inStock}
      minInput={minInput}
      maxInput={maxInput}
      hasFilters={activeCount > 0}
      onChange={updateParams}
      onMin={changeMin}
      onMax={changeMax}
      onClear={clearFilters}
    />
  )

  const sidePanel = renderFilterPanel('side')
  const drawerPanel = renderFilterPanel('drawer')

  return (
    <main className="container-stv catalog-page">
      <div className="breadcrumbs">
        <Link href="/">{t('cat.breadcrumbHome')}</Link>
        <span>›</span>
        <span>{t('cat.breadcrumbFabrics')}</span>
        {activeCategory && <><span>›</span><span>{activeCategory.name}</span></>}
      </div>

      <div className="catalog-heading">
        <div>
          <span className="eyebrow">{t('cat.eyebrow')}</span>
          <h1>{activeCategory ? activeCategory.name : t('cat.allFabricsTitle')}</h1>
          <p>{t('cat.countFabrics').replace('{n}', String(products.length))} · {statusLabel}</p>
        </div>
        <div className="catalog-sort">
          <label htmlFor="catalog-sort">{t('cat.sortBy')}</label>
          <select
            id="catalog-sort"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value === 'featured' ? null : event.target.value })}
          >
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
          </select>
        </div>
      </div>

      <div className="chip-row" role="group" aria-label={t('cat.chipsAria')}>
        {chips.map((chip) => {
          const active = chip.id ? chip.id === activeCategoryId : !categoryId
          const warm = () => prefetchImages(chipThumbs.get(chip.id) || [])
          return (
            <button
              key={chip.id || 'all'}
              type="button"
              className={`chip ${active ? 'chip-active' : ''}`}
              aria-pressed={active}
              aria-label={t('cat.chipAria').replace('{label}', chip.label).replace('{n}', String(chip.count))}
              onClick={() => updateParams({ category: chip.id || null })}
              onPointerEnter={warm}
              onFocus={warm}
            >
              <span>{chip.label}</span>
              <span className="chip-count" aria-hidden="true">{chip.count}</span>
            </button>
          )
        })}
      </div>

      <div className="catalog-mobile-tools">
        <button
          type="button"
          className="filter-trigger"
          aria-haspopup="dialog"
          aria-label={activeCount > 0 ? t('cat.filterOpenActive').replace('{n}', String(activeCount)) : t('cat.filterOpen')}
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t('cat.filterBtn')}
          {activeCount > 0 && <b>{activeCount}</b>}
        </button>
      </div>

      <div className="catalog-layout">
        <aside className="filter-sidebar" aria-label={t('cat.filterFabrics')}>{sidePanel}</aside>
        <section ref={resultsRef} className="catalog-results" aria-label={t('cat.resultsAria')}>
          <form className="catalog-search" onSubmit={submitSearch} role="search">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="catalog-search">{t('cat.searchLabel')}</label>
            <input
              id="catalog-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('cat.searchPlaceholder')}
              autoComplete="off"
            />
            {searchInput && (
              <button type="button" onClick={resetSearch} aria-label={t('cat.clearSearch')}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
            <button type="submit" className="button button-primary button-small">{t('cat.searchBtn')}</button>
          </form>

          {activeCount > 0 && (
            <div className="active-filters">
              <span>{t('cat.activeFilters')}</span>
              {search && <FilterChip label={t('cat.filterSearch').replace('{q}', search)} onRemove={resetSearch} />}
              {activeCategory && <FilterChip label={activeCategory.name} onRemove={() => updateParams({ category: null })} />}
              {categoryId && !activeCategory && <FilterChip label={t('cat.filterCategory').replace('{name}', categoryId)} onRemove={() => updateParams({ category: null })} />}
              {inStock && <FilterChip label={t('cat.inStockOnly')} onRemove={() => updateParams({ stock: null })} />}
              {priceLabel && (
                <FilterChip
                  label={priceLabel}
                  onRemove={() => {
                    setMinInput('')
                    setMaxInput('')
                    updateParams({ min: null, max: null })
                  }}
                />
              )}
              <button type="button" className="clear-all" onClick={clearFilters}>{t('cat.clearAll')}</button>
            </div>
          )}

          <div className="stats-bar glass-card" role="status">
            <span className="stat-item"><Layers size={14} aria-hidden="true" />{t('cat.statShow')} <strong>{shown.length}</strong> {t('cat.statOfTotal').replace('{total}', String(products.length))}</span>
            <span className="stat-divider" aria-hidden="true" />
            <span className="stat-item"><Tag size={14} aria-hidden="true" />{t('cat.statAvgPrice')} <strong>{shown.length ? formatPrice(averagePrice) : '—'}</strong></span>
            <span className="stat-divider" aria-hidden="true" />
            <span className="stat-item"><Package size={14} aria-hidden="true" />{t('cat.statAvailable')} <strong>{availableCount}</strong></span>
            {pageCount > 1 && (
              <>
                <span className="stat-divider" aria-hidden="true" />
                <span className="stat-item">{t('cat.pageLabel').replace('{x}', String(safePage)).replace('{y}', String(pageCount))}</span>
              </>
            )}
          </div>

          {status === 'loading' && products.length === 0
            ? <ProductGridSkeleton />
            : shown.length === 0
              ? <EmptyResults onClear={clearFilters} />
              : (
                <>
                  <div className="product-grid">
                    {paged.map((product, index) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        wished={wishlist.includes(product.slug)}
                        onWish={onWish}
                        onAdd={onAdd}
                        priority={safePage === 1 && index < 8}
                      />
                    ))}
                  </div>
                  {pageCount > 1 && (
                    <nav className="pager" aria-label={t('cat.pagerAria')}>
                      <button type="button" className="pager-btn" disabled={safePage <= 1} onClick={() => goPage(safePage - 1)} onPointerEnter={() => warmPage(safePage - 1)} aria-label={t('cat.pagePrev')}>
                        <ChevronRight size={17} aria-hidden="true" />
                      </button>
                      {pageItems.map((item, index) => item === '…'
                        ? <span key={`gap-${index}`} className="pager-gap" aria-hidden="true">…</span>
                        : (
                          <button
                            key={item}
                            type="button"
                            className={`pager-btn${item === safePage ? ' is-active' : ''}`}
                            aria-current={item === safePage ? 'page' : undefined}
                            onClick={() => goPage(item)}
                            onPointerEnter={() => warmPage(item)}
                          >
                            {item}
                          </button>
                        ))}
                      <button type="button" className="pager-btn" disabled={safePage >= pageCount} onClick={() => goPage(safePage + 1)} onPointerEnter={() => warmPage(safePage + 1)} aria-label={t('cat.pageNext')}>
                        <ChevronLeft size={17} aria-hidden="true" />
                      </button>
                    </nav>
                  )}
                </>
              )}
        </section>
      </div>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title={t('cat.filterFabrics')} variant="bottom" className="filter-drawer">
        <div className="drawer-header">
          <h2>{t('cat.filterResultsTitle')}</h2>
          <button type="button" className="icon-button" onClick={() => setFilterOpen(false)} aria-label={t('cat.closeFilter')}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {drawerPanel}
        <button type="button" className="button button-primary drawer-submit" onClick={() => setFilterOpen(false)}>
          {t('cat.showResults').replace('{n}', String(shown.length))} <Check size={16} aria-hidden="true" />
        </button>
      </Modal>
    </main>
  )
}

interface FilterPanelProps {
  scope: string
  categories: Category[]
  categoryId: string
  activeCategoryId: string
  inStock: boolean
  minInput: string
  maxInput: string
  hasFilters: boolean
  onChange: (changes: ParamChanges, replace?: boolean) => void
  onMin: (value: string) => void
  onMax: (value: string) => void
  onClear: () => void
}

function FilterPanel({
  scope,
  categories,
  categoryId,
  activeCategoryId,
  inStock,
  minInput,
  maxInput,
  hasFilters,
  onChange,
  onMin,
  onMax,
  onClear,
}: FilterPanelProps) {
  const { t } = useT()
  return (
    <div className="filter-panel">
      <div className="filter-panel-title">
        <strong><Filter size={14} aria-hidden="true" />{t('cat.filterPanelTitle')}</strong>
        <button type="button" onClick={onClear} disabled={!hasFilters}>{t('cat.clearAll')}</button>
      </div>

      <fieldset>
        <legend>{t('cat.fabricType')}</legend>
        <label className="filter-option">
          <input type="radio" name={`category-${scope}`} checked={!categoryId} onChange={() => onChange({ category: null })} />
          <span>{t('cat.allCategories')}</span>
        </label>
        {categories.map((category) => (
          <label className="filter-option" key={`${scope}-${category.id}`}>
            <input
              type="radio"
              name={`category-${scope}`}
              checked={activeCategoryId === category.id}
              onChange={() => onChange({ category: category.id })}
            />
            <span>{category.name}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('cat.priceRange')}</legend>
        <div className="price-fields">
          <label>
            <span>{t('cat.priceFrom')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={minInput}
              onChange={(event) => onMin(event.target.value)}
              placeholder={t('cat.minPricePlaceholder')}
              aria-label={t('cat.minPriceAria')}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            <span>{t('cat.priceTo')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={maxInput}
              onChange={(event) => onMax(event.target.value)}
              placeholder={t('cat.maxPricePlaceholder')}
              aria-label={t('cat.maxPriceAria')}
            />
          </label>
        </div>
      </fieldset>

      <label className="filter-option filter-check">
        <input type="checkbox" checked={inStock} onChange={(event) => onChange({ stock: event.target.checked ? '1' : null })} />
        <span>{t('cat.stockOnly')}</span>
      </label>

      <button type="button" className="filter-browse" onClick={onClear} disabled={!hasFilters}>
        {t('cat.showAllFabrics')} <ArrowLeft size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useT()
  return (
    <span className="filter-chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={t('cat.removeFilter').replace('{label}', label)}>
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  )
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  const { t } = useT()
  return (
    <div className="empty-state glass-card" role="status">
      <div className="empty-icon"><Search size={23} aria-hidden="true" /></div>
      <h2>{t('cat.emptyTitle')}</h2>
      <p>{t('cat.emptyHint')}</p>
      <button type="button" className="button button-primary" onClick={onClear}>{t('cat.emptyAction')}</button>
    </div>
  )
}
