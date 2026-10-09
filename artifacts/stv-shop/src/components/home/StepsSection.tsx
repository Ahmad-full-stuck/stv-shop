import { ArrowLeft } from 'lucide-react'
import { Link } from 'wouter'
import { useT } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'

const orderSteps = [
  {
    index: 'home.steps.s1.index',
    title: 'home.steps.s1.title',
    text: 'home.steps.s1.text',
    hint: 'home.steps.s1.hint',
  },
  {
    index: 'home.steps.s2.index',
    title: 'home.steps.s2.title',
    text: 'home.steps.s2.text',
    hint: 'home.steps.s2.hint',
  },
  {
    index: 'home.steps.s3.index',
    title: 'home.steps.s3.title',
    text: 'home.steps.s3.text',
    hint: 'home.steps.s3.hint',
  },
]

export function StepsSection() {
  const { t } = useT()
  return (
    <section className="container-stv section-soft" aria-label={t('home.steps.title')} style={{ marginBlock: 'clamp(16px, 3vw, 32px)' }}>
      <SectionHeading eyebrow={t('home.steps.eyebrow')} title={t('home.steps.title')} description={t('home.steps.description')} linkLabel={t('home.steps.cta')} linkHref="/catalog" />
      <div className="steps-grid">
        {orderSteps.map((step) => (
          <article className="step-card glass-card" key={step.index}>
            <span className="step-index">{t(step.index)}</span>
            <div>
              <h3>{t(step.title)}</h3>
              <p>{t(step.text)}</p>
              <span className="chip" style={{ display: 'inline-flex', marginTop: 14 }}>{t(step.hint)}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="center-action">
        <Link href="/catalog" className="button button-primary">{t('home.steps.browseAll')} <ArrowLeft size={16} /></Link>
      </div>
    </section>
  )
}
