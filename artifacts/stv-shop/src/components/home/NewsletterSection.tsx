import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react'
import { Link } from 'wouter'
import { sendSimpleEmail } from '@/lib/email'
import { useT } from '@/lib/i18n'
import { useSiteContent } from '@/lib/site-content'

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)

export function NewsletterSection() {
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'error' | 'sent'>('idle')
  const content = useSiteContent()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = email.trim()
    if (!isValidEmail(value)) {
      setStatus('error')
      return
    }
    setStatus('sent')
    void sendSimpleEmail({
      to: content.emailOrdersTo || 'wealiahmad.ali@gmail.com',
      action: content.emailFormSubmitAction || undefined,
      subject: t('home.newsletter.subject'),
      body: t('home.newsletter.body').replace('{email}', value),
      fields: { email: value },
    })
  }

  return (
    <section className="container-stv section-block" aria-label={t('home.newsletter.aria')}>
      <div className="newsletter-card">
        <div>
          <span className="eyebrow"><Mail size={14} />{content.newsletterEyebrow}</span>
          <h2>{content.newsletterTitle}</h2>
          <p>{content.newsletterText}</p>
        </div>
        <form className="newsletter-form" onSubmit={handleSubmit}>
          <label htmlFor="newsletter-email" className="sr-only">{t('home.newsletter.emailLabel')}</label>
          <input
            id="newsletter-email"
            className="glass-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('home.newsletter.emailPlaceholder')}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setStatus('idle')
            }}
            aria-invalid={status === 'error'}
            aria-describedby="newsletter-status"
          />
          <button type="submit" className="button button-primary">
            {t('home.newsletter.submit')} <ArrowLeft size={15} />
          </button>
        </form>
        <div id="newsletter-status" role="status" aria-live="polite" style={{ minHeight: 18, fontSize: 11.5 }}>
          {status === 'error' && t('home.newsletter.error')}
          {status === 'sent' && t('home.newsletter.sent')}
        </div>
        <p className="newsletter-note">
          {t('home.newsletter.noteLead')}{' '}
          <Link href="/contact">
            {t('home.newsletter.noteLink')} <MessageCircle size={13} />
          </Link>
        </p>
      </div>
    </section>
  )
}
