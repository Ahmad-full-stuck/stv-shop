import { Link } from 'wouter'
import { useT } from '@/lib/i18n'

interface LogoProps {
  light?: boolean
  glass?: boolean
}

export function Logo({ light = false, glass = false }: LogoProps) {
  const { t } = useT()
  const classes = ['logo', light ? 'logo-light' : '', glass ? 'glass-pill' : ''].filter(Boolean).join(' ')
  return (
    <Link href="/" className={classes} aria-label={t('core.logoHome')}>
      <span className="logo-symbol" aria-hidden="true">
        <span />
      </span>
      <span className="logo-copy">
        <strong>{t('core.logoName')}</strong>
        <small>{t('core.logoTag')}</small>
      </span>
    </Link>
  )
}
