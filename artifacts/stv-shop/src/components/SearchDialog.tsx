import { useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import type { Product } from '@/types'
import { useT } from '@/lib/i18n'
import { matchesProductSearch, formatPrice } from '@/lib/catalog'
import { typeLabelEn } from '@/lib/strings/catalog'
import { Modal } from './Modal'
import { SmartImage } from '@/components/ui/SmartImage'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
  products: Product[]
}

const suggestions: { query: string; labelKey: string }[] = [
  { query: 'قماش مطاطي', labelKey: 'search.sugStretch' },
  { query: 'قماش أسود', labelKey: 'search.sugBlack' },
  { query: 'مطرز', labelKey: 'search.sugEmbroidered' },
  { query: 'ترتر', labelKey: 'search.sugSequined' },
  { query: 'فساتين سهرة', labelKey: 'search.sugEvening' },
  { query: 'غير مطاطي', labelKey: 'search.sugNonStretch' },
]

export function SearchDialog({ open, onClose, products }: SearchDialogProps) {
  const { t, lang } = useT()
  const [query, setQuery] = useState('')
  const [, setLocation] = useLocation()
  const results = query.trim().length > 1 ? products.filter((product) => matchesProductSearch(product, query)).slice(0, 7) : []

  const close = () => {
    setQuery('')
    onClose()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = query.trim()
    if (!clean) return
    setLocation(`/catalog?search=${encodeURIComponent(clean)}`)
    close()
  }

  const pickSuggestion = (suggestion: string) => {
    const first = products.find((product) => matchesProductSearch(product, suggestion))
    if (first) setLocation(`/product/${first.slug}`)
    else setLocation(`/catalog?search=${encodeURIComponent(suggestion)}`)
    close()
  }

  return (
    <Modal open={open} onClose={close} title={t('search.title')} variant="top" className="search-panel">
      <div className="search-panel-inner">
        <div className="search-panel-head">
          <strong>{t('search.title')}</strong>
          <button type="button" className="icon-button" onClick={close} aria-label={t('search.close')}><X size={19} aria-hidden="true" /></button>
        </div>
        <form className="search-form" onSubmit={submit} role="search">
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="global-search">{t('search.label')}</label>
          <input id="global-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search.placeholder')} autoComplete="off" />
          {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label={t('search.clear')}><X size={16} /></button>}
          <button type="submit" className="button button-primary button-small">{t('search.submit')}</button>
        </form>
        {!query && <div className="search-suggestions"><span>{t('search.popular')}</span>{suggestions.map((suggestion) => <button type="button" key={suggestion.query} onClick={() => pickSuggestion(suggestion.query)}>{t(suggestion.labelKey)}</button>)}</div>}
        {query && <div className="search-results" aria-live="polite">
          <p className="search-results-count">{results.length ? t('search.resultsCount').replace('{n}', String(results.length)) : t('search.noResults')}</p>
          {results.map((product) => <Link key={product.id} href={`/product/${product.slug}`} className="search-result-item" onClick={close}>
            <SmartImage src={product.image} alt="" sizes="64px" />
            <span><strong>{product.name}</strong><small>{lang === 'en' ? typeLabelEn(product.type) : product.type} · {product.specs.material}</small></span>
            <b>{formatPrice(product.price)}</b>
          </Link>)}
        </div>}
      </div>
    </Modal>
  )
}
