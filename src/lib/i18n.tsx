'use client'

// ============================================================
// ДВОМОВНИЙ ШАР: українська (за замовчуванням) та російська.
//   L(uk, ru)  — вибрати рядок за поточною мовою (у компонентах)
//   <Bi>       — тип двомовного поля в даних { uk, ru }
// Мова зберігається в localStorage та URL (?lang=ru), змінюється
// перемикачем у шапці. Зміна мови перемальовує всі компоненти,
// підписані на useLang().
// ============================================================

import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Lang = 'uk' | 'ru'

const STORAGE_KEY = 'bravo-lang'

let current: Lang = 'uk'

if (typeof window !== 'undefined') {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('lang')
    const saved = localStorage.getItem(STORAGE_KEY)
    if (fromUrl === 'uk' || fromUrl === 'ru') current = fromUrl
    else if (saved === 'uk' || saved === 'ru') current = saved
  } catch {
    /* приватний режим — лишається uk */
  }
}

const listeners = new Set<() => void>()

export function getLang(): Lang {
  return current
}

export function setLang(l: Lang): void {
  current = l
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, l)
      const u = new URL(window.location.href)
      u.searchParams.set('lang', l)
      window.history.replaceState(null, '', u.toString())
    } catch {
      /* приватний режим — просто перемалювати */
    }
  }
  listeners.forEach(f => f())
}

function subscribe(f: () => void): () => void {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'uk' as Lang)
}

/** Вибір рядка за мовою: L('Українською', 'По-русски') */
export function useL(): (uk: string, ru: string) => string {
  const lang = useLang()
  return useCallback((uk: string, ru: string) => (lang === 'uk' ? uk : ru), [lang])
}

/** Двомовне поле в даних */
export interface Bi {
  uk: string
  ru: string
}

/** Вибір двомовного поля даних: const B = useBi(); B(x.name) */
export function useBi(): (b: Bi) => string {
  const lang = useLang()
  return useCallback((b: Bi) => b[lang], [lang])
}

/** Перемикач УКР | РУС */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang()
  const btn = (active: boolean) =>
    `rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
      active
        ? 'bg-zinc-900 text-white'
        : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
    }`
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 ${className ?? ''}`}
      role="group"
      aria-label="Мова / Язык"
    >
      <button type="button" onClick={() => setLang('uk')} className={btn(lang === 'uk')} aria-pressed={lang === 'uk'}>
        УКР
      </button>
      <button type="button" onClick={() => setLang('ru')} className={btn(lang === 'ru')} aria-pressed={lang === 'ru'}>
        РУС
      </button>
    </span>
  )
}

/** Заголовок вкладки браузера мовою інтерфейсу (укр за замовчуванням) */
export function useTitle(uk: string, ru: string): void {
  const lang = useLang()
  useEffect(() => {
    document.title = lang === 'uk' ? uk : ru
  }, [lang, uk, ru])
}
