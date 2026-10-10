import { useState } from 'react'
import { ArrowLeft, BadgeCheck, ChevronDown, MessageCircle, Sparkles, Truck, Wallet } from 'lucide-react'
import { Link } from 'wouter'
import type { Category, Product, ProductColor } from '@/types'
import { guideQuestions, homeStory, trustItems } from '@/lib/fallback-data'
import { contentLines, useSiteContent } from '@/lib/site-content'
import { runDiscovery, type DiscoveryMatch } from '@/lib/discover'
import { useT } from '@/lib/i18n'
import { discoveryEngineValues, guideQuestionsEn, homeStoryEn, trustItemsEn } from '@/lib/strings/header'
import { ProductCard } from '@/components/ProductCard'
import { HeroSection } from '@/components/home/HeroSection'
import { NewsletterSection } from '@/components/home/NewsletterSection'
import { PromoBar } from '@/components/home/PromoBar'
import { SectionHeading } from '@/components/home/SectionHeading'
import { StepsSection } from '@/components/home/StepsSection'
import { SmartImage } from '@/components/ui/SmartImage'

interface HomePageProps {
  products: Product[]
  categories: Category[]
  wishlist: string[]
  onWish: (slug: string) => void
  onAdd: (product: Product, color: ProductColor, size: string, quantity: number) => void
}

const discoveryQuestions = [
  { title: 'home.discovery.q1', options: ['home.discovery.q1.dress', 'home.discovery.q1.evening', 'home.discovery.q1.abaya', 'home.discovery.q1.practical'] },
  { title: 'home.discovery.q2', options: ['home.discovery.q2.yes', 'home.discovery.q2.no', 'home.discovery.q2.either'] },
  { title: 'home.discovery.q3', options: ['home.discovery.q3.dark', 'home.discovery.q3.light', 'home.discovery.q3.shiny', 'home.discovery.q3.neutral'] },
]

const engineValue = (key: string): string => discoveryEngineValues[key] || ''

const CATEGORY_IMAGES: Record<string, { src: string; w: number; h: number }> = {
  jerseys: { src: 'home/cat-jerseys.svg', w: 1440, h: 1920 },
  tracksuits: { src: 'home/cat-tracksuits.svg', w: 1440, h: 1440 },
  shoes: { src: 'home/cat-shoes.svg', w: 1440, h: 1440 },
  accessories: { src: 'home/cat-accessories.svg', w: 1440, h: 1440 },
  equipment: { src: 'home/cat-equipment.svg', w: 1440, h: 1440 },
  national: { src: 'home/cat-national.webp', w: 1024, h: 1365 },
}

export function HomePage({ products, categories, wishlist, onWish, onAdd }: HomePageProps) {
  const { lang, t } = useT()
  const content = useSiteContent()
  const story = lang === 'en' ? homeStoryEn : homeStory
  const trustSource: readonly { title: string; description: string; icon: string }[] = lang === 'en' ? trustItemsEn : trustItems
  const faqSource: { question: string; answer: string }[] = lang === 'en' ? guideQuestionsEn : guideQuestions
  const [discoveryStep, setDiscoveryStep] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const newProducts = products.filter((product) => product.isNew).slice(0, 4)
  const recentProducts = newProducts.length >= 4 ? newProducts : products.filter((product) => product.isFeatured).slice(0, 4)
  const [suggestions, setSuggestions] = useState<DiscoveryMatch[]>([])
  const discoveryHref = '/catalog'

  const chooseAnswer = (answer: string) => {
    const next = [...answers.slice(0, discoveryStep), answer]
    setAnswers(next)
    if (discoveryStep < discoveryQuestions.length - 1) {
      setDiscoveryStep((step) => step + 1)
      return
    }
    setSuggestions(runDiscovery(products, {
      garment: engineValue(next[0]),
      team: next[1] === 'home.discovery.q2.yes' ? 'clubs' : next[1] === 'home.discovery.q2.no' ? 'national' : '',
      tone: engineValue(next[2]),
      limit: 3,
    }))
  }

  return (
    <main>
      <HeroSection products={products} categories={categories} />

      <PromoBar />

      <StepsSection />

      <section className="container-stv section-block category-section" aria-label={t('home.categoriesAria')}>
        <SectionHeading eyebrow={content.categoriesEyebrow} title={content.categoriesTitle} linkLabel={t('home.showAllFabrics')} linkHref="/catalog" />
        <div className="category-grid">
          {categories.map((category) => {
            const override = CATEGORY_IMAGES[category.id]
            const image = override?.src ?? category.image
            return (
              <Link key={category.id} href={`/catalog?category=${encodeURIComponent(category.id)}`} className="category-card">
                {image && <SmartImage src={image} alt="" sizes="(max-width: 640px) 46vw, 23vw" intrinsicWidth={override?.w} intrinsicHeight={override?.h} />}
                <span className="category-shade" />
                <span className="category-copy"><small>{category.description}</small><strong>{category.name}</strong><b>{t('home.discover')} <ArrowLeft size={14} /></b></span>
              </Link>
            )
          })}
        </div>
      </section>

      {recentProducts.length > 0 && (
        <section className="container-stv section-block new-section" aria-label={t('home.newAria')}>
          <SectionHeading eyebrow={content.newEyebrow} title={content.newTitle} description={content.newDesc} linkLabel={t('home.seeNew')} linkHref="/catalog" />
          <div className="glass" style={{ padding: 'clamp(14px, 2.5vw, 28px)' }}>
            <div className="product-grid">{recentProducts.map((product) => <ProductCard key={product.id} product={product} wished={wishlist.includes(product.slug)} onWish={onWish} onAdd={onAdd} />)}</div>
          </div>
        </section>
      )}

      <section className="container-stv section-block discovery-section">
        <div className="discovery-intro"><span className="eyebrow"><Sparkles size={14} />{t('home.discovery.eyebrow')}</span><h2>{t('home.discovery.title1')}<br />{t('home.discovery.title2')}</h2><p>{t('home.discovery.intro')}</p></div>
        <div className="discovery-card">
          <div className="discovery-progress"><span>{t('home.discovery.progress').replace('{step}', String(discoveryStep + 1))}</span><div><i style={{ width: `${((discoveryStep + 1) / 3) * 100}%` }} /></div></div>
          <h3>{t(discoveryQuestions[discoveryStep].title)}</h3>
          <div className="discovery-options">{discoveryQuestions[discoveryStep].options.map((option) => <button type="button" key={option} onClick={() => chooseAnswer(option)}>{t(option)}<ArrowLeft size={15} /></button>)}</div>
          {discoveryStep > 0 && <button type="button" className="text-button" onClick={() => { setDiscoveryStep(0); setAnswers([]); setSuggestions([]) }}>{t('home.discovery.restart')}</button>}
          {suggestions.length > 0 && (
            <div className="discovery-result-list" role="status" aria-live="polite">
              <strong className="discovery-result-title">{t('home.discovery.resultsTitle')}</strong>
              {suggestions.map((match) => {
                const product = products.find((item) => item.slug === match.slug)
                if (!product) return null
                return (
                  <div className="discovery-result-item" key={match.slug}>
                    <Link href={`/product/${product.slug}`} className="discovery-result-thumb"><SmartImage src={product.image} alt="" sizes="72px" /></Link>
                    <div className="discovery-result-copy">
                      <Link href={`/product/${product.slug}`}><strong>{product.name}</strong></Link>
                      <span>{match.reasons.map((reason) => t(reason)).join(' · ') || t('home.discovery.matchFallback')}</span>
                    </div>
                    <Link href={`/product/${product.slug}`} className="button button-primary discovery-result" aria-label={t('home.discovery.viewProduct').replace('{name}', product.name)}>{t('home.discovery.view')} <ArrowLeft size={15} /></Link>
                  </div>
                )
              })}
              <Link href={discoveryHref} className="underlined-link discovery-all">{t('home.discovery.showAllMatches')} <ArrowLeft size={15} /></Link>
            </div>
          )}
          {!suggestions.length && discoveryStep === discoveryQuestions.length - 1 && answers.length === discoveryQuestions.length && (
            <Link href={discoveryHref} className="button button-primary discovery-result">{t('home.discovery.viewSuggestions')} <ArrowLeft size={16} /></Link>
          )}
        </div>
      </section>

      <section className="guide-preview-section">
        <div className="container-stv guide-preview-grid">
          <div className="guide-preview-copy">
            <span className="eyebrow"><BadgeCheck size={14} />{content.guideEyebrow}</span>
            <h2>
              {contentLines(content.guideTitle).map((line, index) => (
                <span key={`${index}-${line}`}>
                  {index > 0 && <br />}
                  {line}
                </span>
              ))}
            </h2>
            <p>{content.guideText}</p>
            <Link href="/fabric-guide" className="button button-light">{content.guideCta} <ArrowLeft size={16} /></Link>
          </div>
          <div className="guide-faq-list glass-dark">{faqSource.slice(0, 4).map((item, index) => <div className={`guide-faq ${openFaq === index ? 'is-open' : ''}`} key={item.question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{t('home.faq.questionNumber').replace('{n}', String(index + 1))}</span><strong>{item.question}</strong><ChevronDown size={17} /></button>{openFaq === index && <p>{item.answer}</p>}</div>)}</div>
        </div>
      </section>

      <section className="container-stv section-block story-section" aria-label={t('home.storyEyebrow')}>
        <div className="story-visual"><SmartImage src="home/hero-1.webp" alt={t('home.storyImageAlt')} sizes="(max-width: 820px) 92vw, 45vw" /><span>STV<br /><strong>SHOP</strong></span></div>
        <div className="story-copy"><span className="eyebrow">{t('home.storyEyebrow')}</span><h2>{story.title}</h2><p>{story.text}</p><p>{t('home.storyText2')}</p><Link href="/about" className="button button-outline">{t('home.storyCta')} <ArrowLeft size={16} /></Link></div>
      </section>

      <section className="trust-section" aria-label={t('home.trustAria')}><div className="container-stv trust-grid">{trustSource.map((item) => <div className="trust-item" key={item.title}>{item.icon === 'truck' ? <Truck /> : item.icon === 'wallet' ? <Wallet /> : item.icon === 'message' ? <MessageCircle /> : <BadgeCheck />}<strong>{item.title}</strong><span>{item.description}</span></div>)}</div></section>

      <NewsletterSection />
    </main>
  )
}
