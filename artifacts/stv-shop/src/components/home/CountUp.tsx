import { useEffect, useState } from 'react'

interface CountUpProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
}

const isReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function CountUp({ value, duration = 1500, prefix = '', suffix = '' }: CountUpProps) {
  const [current, setCurrent] = useState(() => (isReducedMotion() ? value : 0))

  useEffect(() => {
    if (isReducedMotion()) {
      setCurrent(value)
      return undefined
    }
    let frame = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span>{prefix}{current.toLocaleString('ar-IQ')}{suffix}</span>
}
