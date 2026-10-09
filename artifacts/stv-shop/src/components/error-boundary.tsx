import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { tr } from '@/lib/i18n'

export interface ErrorFallbackProps {
  error: Error
  resetError: () => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  FallbackComponent?: ComponentType<ErrorFallbackProps>
  resetKey?: unknown
}

interface ErrorBoundaryState {
  error: Error | null
}

const toError = (value: unknown): Error => {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  try {
    return new Error(JSON.stringify(value))
  } catch {
    return new Error(String(value))
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return <main className="error-page"><div className="error-mark">!</div><span className="eyebrow">{tr('core.errorEyebrow')}</span><h1>{tr('core.errorTitle')}</h1><p>{error.message || tr('core.errorHint')}</p><button type="button" className="button button-primary" onClick={resetError}>{tr('core.errorRetry')}</button></main>
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('STV Shop error:', toError(error), info.componentStack)
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error !== null && previous.resetKey !== this.props.resetKey) this.resetError()
  }

  resetError = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children
    const Fallback = this.props.FallbackComponent ?? DefaultFallback
    return <Fallback error={this.state.error} resetError={this.resetError} />
  }
}
