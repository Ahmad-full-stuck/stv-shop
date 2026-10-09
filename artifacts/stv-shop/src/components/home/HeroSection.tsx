import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Layers, LayoutGrid, Sparkles, Truck, Wallet } from 'lucide-react'
import { Link } from 'wouter'
import type { Category, Product } from '@/types'
import { CountUp } from './CountUp'
import { SmartImage } from '@/components/ui/SmartImage'
import { contentLines, contentParts, useSiteContent } from '@/lib/site-content'
import { useT } from '@/lib/i18n'

interface HeroSectionProps {
  products: Product[]
  categories: Category[]
}

interface HeroStat {
  key: string
  icon: ReactNode
  value: number
  prefix: string
  suffix: string
  label: string
  trend: string
}

export function HeroSection({ products, categories }: HeroSectionProps) {
  const { t } = useT()
  const content = useSiteContent()
  const stats: HeroStat[] = [
    { key: 'fabrics', icon: <Layers size={16} />, value: products.length, prefix: '+', suffix: '', label: t('home.stats.fabricsLabel'), trend: t('home.stats.fabricsTrend') },
    { key: 'categories', icon: <LayoutGrid size={16} />, value: categories.length, prefix: '+', suffix: '', label: t('home.stats.categoriesLabel'), trend: t('home.stats.categoriesTrend') },
    { key: 'delivery', icon: <Truck size={16} />, value: 18, prefix: '', suffix: '', label: t('home.stats.deliveryLabel'), trend: t('home.stats.deliveryTrend') },
    { key: 'cash', icon: <Wallet size={16} />, value: 100, prefix: '', suffix: t('home.stats.percent'), label: t('home.stats.cashLabel'), trend: t('home.stats.cashTrend') },
  ]

  const slides = [
    { src: 'home/hero-1.svg', alt: t('home.slide.colorful') },
    { src: 'home/hero-2.svg', alt: t('home.slide.sequin') },
    { src: 'home/hero-3.svg', alt: t('home.slide.pearl') },
  ]
  const [activeSlide, setActiveSlide] = useState(0)
  const timerRef = useRef<number | undefined>(undefined)
  const slideMs = Math.max(1200, Number(content.heroSlideMs) || 2600)

  const restart = () => {
    window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length)
    }, slideMs)
  }

  const goSlide = (step: number) => {
    setActiveSlide((current) => (current + step + slides.length) % slides.length)
    restart()
  }

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduce.matches) return undefined
    restart()
    const onVisibility = () => {
      if (document.hidden) window.clearInterval(timerRef.current)
      else restart()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [slideMs])

  return (
    <>
      <section className="home-hero glass-hero container-stv">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} />{content.heroEyebrow}</span>
          <h1>
            {contentLines(content.heroTitle).map((line, lineIndex) => (
              <Fragment key={`${lineIndex}-${line}`}>
                {lineIndex > 0 && <br />}
                {contentParts(line).map((part, partIndex) => (partIndex % 2 ? <span key={`${lineIndex}-${partIndex}`}>{part}</span> : part))}
              </Fragment>
            ))}
          </h1>
          <p>{content.heroText}</p>
          <div className="hero-actions">
            <Link href="/catalog" className="button button-primary">{t('home.hero.browse')} <ArrowLeft size={16} /></Link>
            <Link href="/catalog" className="button button-outline">{t('home.hero.discoverNew')} <ArrowRight size={16} /></Link>
          </div>
          <div className="hero-note"><span className="note-dot" />{content.heroNote} <span className="note-divider" /><span className="note-alt">{content.heroNoteAlt}</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-slides" aria-live="off">
            {slides.map((slide, index) => (
              <div className={`hero-slide ${index === activeSlide ? 'is-active' : ''}`} key={slide.src} aria-hidden={index !== activeSlide}>
                <SmartImage src={slide.src} alt={slide.alt} sizes="(max-width: 820px) 92vw, 52vw" priority={index < 2} />
              </div>
            ))}
          </div>
          <div className="hero-visual-overlay" />
          {slides.length > 1 && <>
            <button type="button" className="hero-arrow hero-next" onClick={() => goSlide(1)} aria-label={t('home.hero.next')}><ChevronLeft size={18} /></button>
            <button type="button" className="hero-arrow hero-prev" onClick={() => goSlide(-1)} aria-label={t('home.hero.prev')}><ChevronRight size={18} /></button>
            <div className="hero-dots" role="tablist" aria-label={t('home.hero.dots')}>
              {slides.map((slide, index) => <button key={slide.src} type="button" role="tab" aria-selected={index === activeSlide} aria-label={slide.alt} className={index === activeSlide ? 'is-active' : ''} onClick={() => { setActiveSlide(index); restart() }} />)}
            </div>
          </>}
          <div className="hero-vertical-label" aria-hidden="true">STV · SHOP</div>
        </div>
      </section>

      <div className="container-stv hero-stats-band">
        <div className="glass-card hero-stats-card">
          <span className="glass-pill">{content.statsTitle}</span>
          <div className="stats-grid">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.key} role="group" aria-label={`${stat.prefix}${stat.value.toLocaleString('ar-IQ')}${stat.suffix} ${stat.label}`}>
                <span className="stat-icon" aria-hidden="true">{stat.icon}</span>
                <div className="stat-copy">
                  <strong className="stat-value"><CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} /></strong>
                  <span className="stat-label">{stat.label}</span>
                </div>
                <span className="stat-trend">{stat.trend}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
