import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { coreStrings } from '@/lib/strings/core'
import { headerStrings } from '@/lib/strings/header'
import { catalogStrings } from '@/lib/strings/catalog'
import { productStrings } from '@/lib/strings/product'
import { infoStrings } from '@/lib/strings/info'

export type Lang = 'ar' | 'en'
export type StringEntry = { ar: string; en: string }

const MODULES: Record<string, StringEntry>[] = [coreStrings, headerStrings, catalogStrings, productStrings, infoStrings]

const DICT: Record<string, StringEntry> = {}
for (const module of MODULES) {
  for (const [key, entry] of Object.entries(module)) {
    if (import.meta.env.DEV && DICT[key]) console.warn(`[i18n] duplicate key: ${key}`)
    DICT[key] = entry
  }
}

const LANG_KEY = 'stv-lang'

const readStoredLang = (): Lang => {
  try {
    const value = window.localStorage.getItem(LANG_KEY)
    if (value === 'en' || value === 'ar') return value
  } catch {
    /* ignore */
  }
  return 'ar'
}

let currentLang: Lang = typeof window === 'undefined' ? 'ar' : readStoredLang()

/** Non-React access for plain helpers (formatPrice, metersLabel, …). */
export const getCurrentLang = (): Lang => currentLang

/** Non-React translation using the current language (for non-component code). */
export const tr = (key: string): string => {
  const entry = DICT[key]
  if (!entry) return key
  return entry[currentLang] || entry.ar || key
}

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang())

  useEffect(() => {
    currentLang = lang
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'
    try {
      window.localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next === 'en' ? 'en' : 'ar'), [])

  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang,
    t: (key: string) => {
      const entry = DICT[key]
      if (!entry) return key
      return entry[lang] || entry.ar || key
    },
  }), [lang, setLang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useT(): LangContextValue {
  const context = useContext(LangContext)
  if (!context) throw new Error('useT must be used inside <LangProvider>')
  return context
}
