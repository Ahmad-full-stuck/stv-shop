import { ArrowLeft } from 'lucide-react'
import { Link } from 'wouter'

interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
  linkLabel?: string
  linkHref?: string
}

export function SectionHeading({ eyebrow, title, description, linkLabel, linkHref }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {linkLabel && linkHref && (
        <Link href={linkHref} className="underlined-link">
          {linkLabel} <ArrowLeft size={15} />
        </Link>
      )}
    </div>
  )
}
