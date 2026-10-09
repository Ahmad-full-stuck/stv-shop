import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useT } from '@/lib/i18n'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  variant?: 'center' | 'top' | 'drawer' | 'bottom'
  className?: string
}

export function Modal({ open, onClose, title, children, variant = 'center', className = '' }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const restoreRef = useRef<HTMLElement | null>(null)
  const { t } = useT()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('.modal-layer')) return
      restoreRef.current = target
    }
    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      panel.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      const target = restoreRef.current
      if (target && document.contains(target)) {
        window.requestAnimationFrame(() => target.focus({ preventScroll: true }))
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div className={`modal-layer modal-${variant}`}>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label={t('core.modalClose').replace('{title}', title)} />
      <div ref={panelRef} className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="sr-only">{title}</h2>
        {children}
      </div>
    </div>
  )
}
