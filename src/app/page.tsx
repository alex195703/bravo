'use client'

// ============================================================
// ТОРГОВАЯ СЕТЬ «БРАВО» — интерфейс
// ------------------------------------------------------------
// Сценарий «Компания как есть»: вы принимаете сеть в текущем
// состоянии и ведёте её 12 месяцев. Каждый месяц — решения
// (нанять / заменить / уволить / ничего), конъюнктура спроса
// и рынка труда, скамейка кандидатов, которая уходит в конце
// месяца. Прокрастинация наказуема: вакансии капают деньгами,
// а счёт игры — стоимость компании в миллионах гривен.
// Логика и данные — в src/lib/bravo.ts, здесь только React.
// Прогресс хранится в localStorage.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { TYPES, type QuadraId } from '@/lib/socionics-data'
import { QUADRA_COLORS } from '@/lib/relations'
import { typeByRu, label } from '@/lib/socionics-quiz'
import {
  POSTS, MARKET_MODES, PAYROLL_BUDGET,
  fitStars, profFit, postFit, overallFit,
  payroll, cohesion, fmtMoney, fmtValue, VACANCY_VALUE_PENALTY,
  normalizeCandidate, DEMAND_MODES, LIVE_MONTHS,
  SEVERANCE_MONTHS, SIGNING_BONUS_MONTHS,
  newLiveGame, liveValue, liveRevenue, liveVacancyFine, liveCabinet,
  hireCost, hireCandidate, fireEmployee, closeMonth, liveGrade, vacancyFineFor,
  teamVsIdeal,
  type LiveGame, type MonthLog, type MonthEvent, type DemandMode,
  type MarketMode, type Candidate, type HireCost,
} from '@/lib/bravo'

type Phase = 'intro' | 'manage' | 'final'

const GAME_KEY = 'bravo-live-game'
const BEST_KEY = 'bravo-live-best'
const SPEED_KEY = 'bravo-live-speed'

/** Скорости автопилота: пауза и три темпа закрытия месяцев */
const SPEEDS = [
  { ms: 0, label: '⏸', title: 'Пауза: думаем без спешки' },
  { ms: 8000, label: '🐢', title: 'Медленно: месяц каждые 8 секунд' },
  { ms: 4000, label: '▶', title: 'Средне: месяц каждые 4 секунды' },
  { ms: 1500, label: '⏩', title: 'Быстро: месяц каждые 1,5 секунды' },
] as const

interface SavedBest { value: number; growth: number }

const FIT_BADGE: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  mid: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-rose-100 text-rose-700 border-rose-300',
}

function fitBadgeClass(fit: number): string {
  return fit >= 75 ? FIT_BADGE.high : fit >= 55 ? FIT_BADGE.mid : FIT_BADGE.low
}

/** «+2,6 млн грн» / «−1,2 млн грн» — деньги со знаком */
function signedMoney(n: number): string {
  return n >= 0 ? `+${fmtValue(n)}` : `−${fmtValue(Math.abs(n))}`
}

/** Восстановление партии из сохранения: битые данные отбрасываем */
function restoreLiveGame(parsed: Partial<LiveGame>): LiveGame | null {
  try {
    const month = Number(parsed.month)
    const cash = Number(parsed.cash)
    if (!(month >= 1 && month <= LIVE_MONTHS) || !(cash >= 0)) return null
    const labor: MarketMode = parsed.labor && parsed.labor in MARKET_MODES ? parsed.labor : 'normal'
    const demand: DemandMode = parsed.demand && parsed.demand in DEMAND_MODES ? parsed.demand : 'steady'
    if (!parsed.slots || typeof parsed.slots !== 'object') return null
    const rawSlots = parsed.slots as Record<string, { ru?: unknown; vacantMonths?: unknown }>
    const slots: LiveGame['slots'] = {}
    for (const p of POSTS) {
      const s = rawSlots[p.id]
      if (!s) return null
      const ru = typeof s.ru === 'string' && TYPES.some((t) => t.ru === s.ru) ? s.ru : null
      const vacantMonths = Number.isFinite(Number(s.vacantMonths))
        ? Math.max(0, Math.floor(Number(s.vacantMonths)))
        : 0
      slots[p.id] = { ru, vacantMonths }
    }
    const roster = Array.isArray(parsed.roster)
      ? parsed.roster
        .filter((c) => c && typeof c.ru === 'string' && TYPES.some((t) => t.ru === c.ru))
        .map(normalizeCandidate)
      : []
    if (roster.length === 0) return null
    const busyRus = Object.values(slots).map((s) => s.ru).filter((x): x is string => !!x)
    const bench = Array.isArray(parsed.bench)
      ? parsed.bench.filter((ru) =>
          typeof ru === 'string' &&
          roster.some((c) => c.ru === ru) &&
          !busyRus.includes(ru))
      : []
    const history = Array.isArray(parsed.history) ? parsed.history : []
    const startValue = Number(parsed.startValue) > 0 ? Number(parsed.startValue) : 0
    return { month: Math.floor(month), cash, labor, demand, slots, roster, bench, history, startValue }
  } catch {
    return null
  }
}

export default function BravoSimulator() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [game, setGame] = useState<LiveGame | null>(null)
  const [note, setNote] = useState<MonthEvent | null>(null)
  const [sel, setSel] = useState<{ ru: string; postId: string } | null>(null)
  const [best, setBest] = useState<SavedBest | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)
  const [intl, setIntl] = useState(false)
  const [speed, setSpeed] = useState(0)
  const hydrated = useRef(false)

  // Читаем сохранённую партию после монтирования (иначе гидратация расходится)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(GAME_KEY)
        if (raw) {
          const restored = restoreLiveGame(JSON.parse(raw) as Partial<LiveGame>)
          if (restored) {
            setGame(restored)
            setPhase('manage')
          }
        }
        const rawBest = localStorage.getItem(BEST_KEY)
        if (rawBest) setBest(JSON.parse(rawBest) as SavedBest)
        const rawSpeed = localStorage.getItem(SPEED_KEY)
        if (rawSpeed && SPEEDS.some((s) => s.ms === Number(rawSpeed))) setSpeed(Number(rawSpeed))
      } catch { /* приватный режим — играем без сохранений */ }
      hydrated.current = true
    })
  }, [])

  // Партия автосохраняется, но только после восстановления
  useEffect(() => {
    if (!hydrated.current || !game) return
    try {
      localStorage.setItem(GAME_KEY, JSON.stringify(game))
    } catch { /* приватный режим */ }
  }, [game])

  // Скорость автопилота запоминается между партиями
  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(SPEED_KEY, String(speed))
    } catch { /* приватный режим */ }
  }, [speed])

  const pulse = useMemo(() => (game ? liveValue(game) : null), [game])
  const cab = useMemo(() => (game ? liveCabinet(game) : null), [game])
  const pay = cab && game ? payroll(cab, game.roster) : 0
  const rev = game ? liveRevenue(game) : 0
  const fine = game ? liveVacancyFine(game) : 0
  const coh = cab ? cohesion(cab) : 0
  // Штат против эталона и суперуправленец на скамейке (для панелей ниже)
  const idealInfo = cab && game ? teamVsIdeal(cab, game.roster) : null
  const benchStar = game && cab
    ? game.bench
      .map((ru) => game.roster.find((c) => c.ru === ru))
      .find((c) => c?.super) ?? null
    : null

  function acceptCompany(): void {
    setGame(newLiveGame())
    setNote(null)
    setSel(null)
    setIsNewBest(false)
    setPhase('manage')
  }

  function doHire(ru: string, postId: string): void {
    if (!game) return
    const res = hireCandidate(game, ru, postId)
    setGame(res.game)
    setNote(res.event)
    setSel(null)
  }

  function doFire(postId: string): void {
    if (!game) return
    const res = fireEmployee(game, postId)
    setGame(res.game)
    setNote(res.event)
  }

  function doClose(): void {
    if (!game || game.month > LIVE_MONTHS) return
    const res = closeMonth(game)
    setGame(res.game)
    setNote(null)
    setSel(null)
    if (res.finished) {
      const last = res.game.history[res.game.history.length - 1]
      const record = { value: last.value, growth: last.value - res.game.startValue }
      const better = !best || record.growth > best.growth
      setIsNewBest(better)
      if (better) {
        setBest(record)
        try {
          localStorage.setItem(BEST_KEY, JSON.stringify(record))
        } catch { /* приватный режим */ }
      }
      setPhase('final')
    }
  }

  // Автопилот: месяцы закрываются сами с выбранной скоростью.
  // doClose живёт в ref — интервал всегда зовёт свежую версию.
  const doCloseRef = useRef(doClose)
  useEffect(() => {
    doCloseRef.current = doClose
  })
  useEffect(() => {
    if (phase !== 'manage' || speed === 0 || (game && game.month > LIVE_MONTHS)) return
    const id = window.setInterval(() => doCloseRef.current(), speed)
    return () => window.clearInterval(id)
  }, [phase, speed, game?.month])

  const intlBtn = (
    <button
      onClick={() => setIntl(!intl)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
    >
      {intl ? 'ILE → ИЛЭ' : 'ИЛЭ → ILE'}
    </button>
  )

  // ============ ЭКРАН 1: ПРИЁМКА КОМПАНИИ ============
  if (phase === 'intro' || !game || !pulse) {
    const rules: { emoji: string; title: string; text: string }[] = [
      {
        emoji: '🏚', title: 'Компания как есть',
        text: 'Штат — чужое наследие: сильные профессионалы, середняки, слабые (кого-то ещё и переоплачивают) и пустые кресла со стажем простоя.',
      },
      {
        emoji: '⚖️', title: 'Ресурсов не хватает',
        text: 'Касса конечна, сильные кандидаты дороги, идеальных людей на рынке нет. Удовлетворить все критерии сразу невозможно — выбирать, что горит сильнее.',
      },
      {
        emoji: '⏳', title: 'Прокрастинация стоит денег',
        text: 'Кандидаты уходят в конце месяца. Пустое кресло капает кассе каждый месяц и всё дороже — тянуть нельзя.',
      },
      {
        emoji: '💰', title: 'Счёт — стоимость компании',
        text: 'Каждое решение видно в гривнах сразу: слабый руководитель, ссоры в команде и простой бьют по цене сети. Рекорд — рост за год.',
      },
      {
        emoji: '🦸', title: 'Эталон: суперуправленец',
        text: 'У каждой должности есть эталон — сильнейший тип, 20 лет в профессии и MBA (панель «🎯 Эталон»). Иногда на рынок выходит живой эталон — суперуправленец: стоит в 1,45 раза дороже рынка, но тянет команду к мечте.',
      },
      {
        emoji: '⏱', title: 'Скорость моделирования',
        text: 'Не ждите месяц за месяцем по кнопке: включите автопилот 🐢/▶/⏩ — месяцы закроются сами. Пауза — чтобы думать; выбор кандидата ставит автопилот на паузу.',
      },
    ]
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                🛒 Сеть магазинов «Браво»
              </h1>
              <p className="text-slate-500 mt-1 text-sm sm:text-base">
                Сценарий «Компания как есть»: живой менеджмент на {LIVE_MONTHS} месяцев
              </p>
            </div>
            {intlBtn}
          </header>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <p className="text-sm sm:text-base text-slate-600">
              Вы принимаете сеть из четырёх магазинов <b>в текущем состоянии</b>: часть кресел занята
              сильными профессионалами, часть — случайными людьми, пара должностей пустует.
              Нанимаем по-прежнему как рациональный работодатель: <b>сначала компетентность и опыт</b>
              {' '}(65% итогового рейтинга), потом психология (35%). Но теперь время идёт: рынок труда
              и спрос покупателей меняются каждый месяц, а решения приходится принимать
              в условиях, когда <b>денег хватает не на всё</b>.
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 mb-5">
            {rules.map((r) => (
              <section key={r.title} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200">
                <h2 className="font-semibold text-slate-800">
                  <span aria-hidden>{r.emoji}</span> {r.title}
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{r.text}</p>
              </section>
            ))}
          </div>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-6">
            <h2 className="font-semibold text-slate-800 mb-2">Правила за 30 секунд</h2>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li>📅 <b>{LIVE_MONTHS} месяцев</b> — месяц закрывается кнопкой «Закрыть месяц» или автопилотом на выбранной скорости.</li>
              <li>🧑‍💼 Кандидаты приходят на рынок труда и <b>уходят в конце месяца</b> — решение нельзя откладывать навсегда.</li>
              <li>💼 Приём на работу стоит <b>подъёмных ({SIGNING_BONUS_MONTHS} оклад)</b>, увольнение — <b>секверанса ({SEVERANCE_MONTHS} оклада)</b>; всё платится из кассы.</li>
              <li>🕳 Пустое кресло <b>капает каждый месяц</b>: штраф кассе растёт со временем простоя, а стоимость компании теряет {fmtValue(VACANCY_VALUE_PENALTY)} за каждую вакансию.</li>
              <li>🌤 Конъюнктура гуляет: спрос покупателей и рынок труда меняются каждый месяц — выручка то растёт, то проседает.</li>
              <li>🎯 У каждой должности есть эталон — сравнивайте штат с идеалом в панели «Эталон».</li>
              <li>🦸 Раз в несколько месяцев на рынок может выйти суперуправленец — эталон во плоти, но в 1,45 раза дороже рынка.</li>
              <li>⏱ Автопилот закрывает месяцы сам: год проматывается за полминуты, пауза — чтобы думать.</li>
              <li>🏆 Финал: сколько миллионов гривен вы добавили к стоимости сети — это ваш счёт и рекорд.</li>
            </ul>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={acceptCompany}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow hover:bg-emerald-500"
            >
              🏢 Принять сеть
            </button>
            {best && (
              <span className="text-sm text-slate-500">
                Рекорд сценария: <b>{fmtValue(best.value)}</b>{' '}
                ({best.growth >= 0 ? '+' : '−'}{fmtValue(Math.abs(best.growth))} за год)
              </span>
            )}
          </div>
        </main>
        <Disclaimer />
      </div>
    )
  }

  const lastLog: MonthLog | null = game.history.length > 0 ? game.history[game.history.length - 1] : null

  // ============ ЭКРАН 3: ОТЧЁТ ВЛАДЕЛЬЦУ (12 месяцев) ============
  if (phase === 'final') {
    const finalLog = game.history[game.history.length - 1]
    const finalValue = finalLog.value
    const growth = finalValue - game.startValue
    const grade = liveGrade(growth)
    const idealFinal = cab ? teamVsIdeal(cab, game.roster) : null
    const starsHired = POSTS.filter((p) => {
      const ru = game.slots[p.id]?.ru
      return ru ? game.roster.find((c) => c.ru === ru)?.super : false
    }).length
    const values = game.history.map((h) => h.value)
    const minV = Math.min(...values, game.startValue)
    const maxV = Math.max(...values, game.startValue)
    const totalRevenue = game.history.reduce((a, h) => a + h.revenue, 0)
    const totalPayroll = game.history.reduce((a, h) => a + h.payroll, 0)
    const totalOpex = game.history.reduce((a, h) => a + h.opex, 0)
    const totalFine = game.history.reduce((a, h) => a + h.vacancyFine, 0)
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">🏁 Год закончен — отчёт владельцу</h1>
            {isNewBest && (
              <p className="mt-1 inline-block rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-sm font-semibold text-amber-700">
                🏆 Новый рекорд сценария!
              </p>
            )}
          </div>

          <section className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 text-center mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Стоимость компании</p>
            <p className="mt-1 text-4xl sm:text-5xl font-black text-slate-800">{fmtValue(finalValue)}</p>
            <p className={`mt-2 text-xl font-bold ${growth >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {signedMoney(growth)} за год
            </p>
            <p className="mt-1 text-slate-500">
              <b className="text-slate-700">{grade.word}</b> — {grade.note}
            </p>
            {best && (
              <p className="mt-2 text-sm text-slate-400">
                Рекорд сценария: {fmtValue(best.value)} ({best.growth >= 0 ? '+' : '−'}{fmtValue(Math.abs(best.growth))})
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <h2 className="font-semibold text-slate-800 mb-1">История года: стоимость по месяцам</h2>
            <p className="text-xs text-slate-400 mb-3">
              столбики выше линии старта — компания дорожает, ниже — дешевеет
            </p>
            <div className="flex items-end gap-1.5 h-28">
              {game.history.map((h, i) => {
                const span = maxV - minV || 1
                const pct = 15 + 85 * ((h.value - minV) / span)
                const up = h.value >= game.startValue
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col justify-end"
                    title={`Месяц ${h.month}: ${fmtValue(h.value)} · ${DEMAND_MODES[h.demand].label}`}
                  >
                    <div className={`w-full rounded-t ${up ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ height: `${pct}%` }} />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-1.5 text-xs text-slate-400 mt-1">
              {game.history.map((h, i) => (
                <span key={i} className="flex-1 text-center">{h.month}</span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <h2 className="font-semibold text-slate-800 mb-3">Куда утекали деньги за год</h2>
            <div className="grid gap-3 sm:grid-cols-4 text-center">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs text-emerald-700">Выручка</p>
                <p className="font-bold text-emerald-800">+{fmtValue(totalRevenue)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700">ФОТ</p>
                <p className="font-bold text-rose-800">−{fmtValue(totalPayroll)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700">Операционные</p>
                <p className="font-bold text-rose-800">−{fmtValue(totalOpex)}</p>
              </div>
              <div className={`rounded-xl border p-3 ${totalFine > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs text-slate-500">Простои вакансий</p>
                <p className={`font-bold ${totalFine > 0 ? 'text-rose-800' : 'text-slate-600'}`}>
                  {totalFine > 0 ? `−${fmtValue(totalFine)}` : '0 грн'}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Разбивка стоимости компании" className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-800">💹 Пульс сети — из чего сложилась цена</h2>
              <p className="text-2xl font-black text-slate-800">{fmtValue(pulse.total)}</p>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {pulse.parts.map((part) => (
                <li key={part.label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="text-slate-600">
                    {part.label}
                    {part.hint && <span className="text-slate-400"> · {part.hint}</span>}
                  </span>
                  <b className={part.label === 'База сети' ? 'text-slate-800' : part.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    {part.label === 'База сети' ? fmtValue(part.amount) : signedMoney(part.amount)}
                  </b>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-6">
            <h2 className="font-semibold text-slate-800 mb-3">Состав команды на конец года</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Должность</th>
                    <th className="py-2 pr-3 font-medium">Человек</th>
                    <th className="py-2 pr-3 font-medium">Зарплата</th>
                    <th className="py-2 pr-3 font-medium">Итог</th>
                    <th className="py-2 font-medium">Вклад в стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {POSTS.map((p) => {
                    const s = game.slots[p.id]
                    const ru = s?.ru ?? null
                    const emp = ru ? game.roster.find((c) => c.ru === ru) ?? null : null
                    const t = ru ? typeByRu(ru) : null
                    const fit = emp ? overallFit(emp, p) : 0
                    const contrib = pulse.perPost.find((x) => x.post.id === p.id)?.contribution ?? 0
                    return (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-700">{p.emoji} {p.title}</td>
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {emp && t ? `${emp.name} · ${label(t, intl)}` : '— вакансия —'}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{emp ? `${fmtMoney(emp.salary)}/мес` : '—'}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {emp ? `${fitStars(fit)} ${fit}% (проф ${profFit(emp, p)} · соц ${t ? postFit(t, p) : 0})` : '—'}
                        </td>
                        <td className="py-2">
                          {emp
                            ? <b className="text-emerald-700">{signedMoney(contrib)}</b>
                            : <b className="text-rose-500">{signedMoney(-VACANCY_VALUE_PENALTY)}</b>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {idealFinal && (
            <p className="text-center text-sm text-slate-500 mb-6">
              🎯 Команда к эталону: <b className="text-slate-700">{idealFinal.avgPct}%</b>
              {starsHired > 0 && (
                <> · 🦸 суперуправленцев в штате: <b className="text-slate-700">{starsHired}</b></>
              )}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center pb-2">
            <button
              onClick={() => setPhase('manage')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Посмотреть штат
            </button>
            <button
              onClick={acceptCompany}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-emerald-500"
            >
              🔄 Новая компания
            </button>
          </div>
        </main>
        <Disclaimer />
      </div>
    )
  }

  // ============ ЭКРАН 2: ШТАБ СЕТИ — МЕСЯЦ ЗА МЕСЯЦЕМ ============
  const filled = POSTS.filter((p) => game.slots[p.id].ru).length
  const growthNow = pulse.total - game.startValue
  const payrollOver = pay > PAYROLL_BUDGET ? Math.round((pay / PAYROLL_BUDGET - 1) * 100) : 0
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              🏪 Штаб сети — месяц {game.month} из {LIVE_MONTHS}
            </h1>
            <p className="text-sm text-slate-500">
              Сценарий «Компания как есть» · решения можно принимать в любой момент месяца
            </p>
          </div>
          <div className="flex items-center gap-2">
            {intlBtn}
            <button
              onClick={() => {
                if (confirm('Начать новую компанию? Текущий прогресс сотрётся.')) acceptCompany()
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              🔄 Новая компания
            </button>
          </div>
        </header>

        {/* Конъюнктура месяца */}
        <section className="grid gap-3 sm:grid-cols-3 mb-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200" title={DEMAND_MODES[game.demand].hint}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Спрос покупателей</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              <span aria-hidden>{DEMAND_MODES[game.demand].emoji}</span> {DEMAND_MODES[game.demand].label}
            </p>
            <p className="text-xs text-slate-400 mt-1">{DEMAND_MODES[game.demand].hint}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200" title={MARKET_MODES[game.labor].hint}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Рынок труда</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              <span aria-hidden>{MARKET_MODES[game.labor].emoji}</span> {MARKET_MODES[game.labor].label}
            </p>
            <p className="text-xs text-slate-400 mt-1">{MARKET_MODES[game.labor].hint}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">💵 Касса</p>
            <p className="mt-0.5 font-semibold text-slate-800">{fmtMoney(game.cash)}</p>
            <p className="text-xs text-slate-400 mt-1">подъёмные, секверансы и простой платятся из неё</p>
          </div>
        </section>

        {/* Пульс сети */}
        <section aria-label="Пульс сети: стоимость компании" className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">💹 Пульс сети — стоимость компании</p>
              <p className="mt-0.5 text-3xl sm:text-4xl font-black text-slate-800">{fmtValue(pulse.total)}</p>
              <p className={`mt-1 text-sm font-semibold ${growthNow >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                с приёмки: {signedMoney(growthNow)}
                <span className="font-normal text-slate-400"> (приняли за {fmtValue(game.startValue)})</span>
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                команда {signedMoney(pulse.teamCapital)} · психология {signedMoney(pulse.combo)}
                {pulse.vacancyPenalty < 0 && <> · вакансии {signedMoney(pulse.vacancyPenalty)}</>}
                {pulse.payrollPenalty < 0 && <> · ФОТ {signedMoney(pulse.payrollPenalty)}</>}
              </p>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-slate-600">Ожидаемая выручка месяца: <b className="text-slate-800">{fmtMoney(rev)}</b></p>
              <p className="text-slate-600">
                ФОТ: <b className={payrollOver > 0 ? 'text-rose-600' : 'text-slate-800'}>{fmtMoney(pay)}</b>
                <span className="text-slate-400"> из {fmtMoney(PAYROLL_BUDGET)}</span>
                {payrollOver > 0 && <span className="text-rose-600"> (+{payrollOver}%)</span>}
              </p>
              <p className="text-slate-600">
                Простой вакансий: <b className={fine > 0 ? 'text-rose-600' : 'text-slate-800'}>{fine > 0 ? `−${fmtMoney(fine)}/мес` : '—'}</b>
              </p>
              <p className="text-slate-600">Сплочённость: <b className="text-slate-800">{coh}%</b></p>
            </div>
          </div>
        </section>

        {/* Эталон: команда мечты — сравнение штата с идеалом */}
        {idealInfo && (
          <details className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
            <summary className="cursor-pointer select-none font-semibold text-slate-800">
              🎯 Эталон: команда мечты — ваш штат{' '}
              <b className={idealInfo.avgPct >= 75 ? 'text-emerald-700' : idealInfo.avgPct >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                {idealInfo.avgPct}%
              </b>{' '}от идеала
              <span className="ml-2 text-xs font-normal text-slate-400">нажмите, чтобы развернуть</span>
            </summary>
            <p className="mt-2 text-sm text-slate-500">
              Эталон должности — сильнейший соционический тип, 20 лет в своей сфере и MBA.
              Раз в несколько месяцев на рынок может выйти «живой эталон» — 🦸 суперуправленец:
              берёт в 1,45 раза дороже рынка, но тянет штат к мечте.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Должность</th>
                    <th className="py-2 pr-3 font-medium">Эталон</th>
                    <th className="py-2 pr-3 font-medium">Эталон стоит</th>
                    <th className="py-2 pr-3 font-medium">У вас сейчас</th>
                    <th className="py-2 font-medium">% от эталона</th>
                  </tr>
                </thead>
                <tbody>
                  {idealInfo.rows.map((row) => {
                    const s = game.slots[row.post.id]
                    const ru = s?.ru ?? null
                    const emp = ru ? game.roster.find((c) => c.ru === ru) ?? null : null
                    return (
                      <tr key={row.post.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-700">{row.post.emoji} {row.post.title}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {row.idealType} · {fitStars(row.idealFit)} {row.idealFit}%
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{fmtMoney(row.idealSalary)}/мес</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {emp ? `${fitStars(row.curFit)} ${row.curFit}%` : '— вакансия —'}
                        </td>
                        <td className="py-2">
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${fitBadgeClass(row.pct)}`}>
                            {row.pct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              ФОТ мечты: <b>{fmtMoney(idealInfo.idealPayroll)}/мес</b> (у вас сейчас {fmtMoney(pay)}) —
              даже к идеалу приходится идти с оглядкой на бюджет.
            </p>
          </details>
        )}

        {/* Последнее кадровое решение */}
        {note && (
          <div
            className={`rounded-xl border px-4 py-2.5 mb-4 text-sm ${
              note.kind === 'good'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : note.kind === 'bad'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-slate-50 border-slate-300 text-slate-700'
            }`}
            role="status"
          >
            {note.text}
          </div>
        )}

        {/* Штат сети */}
        <h2 className="font-semibold text-slate-800 mb-3 px-1">Штат сети ({filled}/{POSTS.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          {POSTS.map((post) => {
            const s = game.slots[post.id]
            const ru = s?.ru ?? null
            const emp = ru ? game.roster.find((c) => c.ru === ru) ?? null : null
            const t = ru ? typeByRu(ru) : null
            const prof = emp ? profFit(emp, post) : 0
            const soc = t ? postFit(t, post) : 0
            const fit = emp ? overallFit(emp, post) : 0
            if (!emp || !t) {
              return (
                <article key={post.id} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border-2 border-rose-300">
                  <h3 className="font-semibold text-slate-800 text-base sm:text-lg">
                    <span aria-hidden>{post.emoji}</span> {post.title}
                  </h3>
                  <p className="mt-1 font-bold text-rose-600">— ВАКАНСИЯ —</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Простой: <b>{s?.vacantMonths ?? 0} мес</b> · кассе{' '}
                    <b className="text-rose-600">−{fmtMoney(vacancyFineFor(s?.vacantMonths ?? 0))}/мес</b>
                  </p>
                  <p className="text-sm text-slate-600">
                    Стоимости компании: <b className="text-rose-500">{signedMoney(-VACANCY_VALUE_PENALTY)}</b>
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Кандидатов ищите на рынке труда ниже — они уходят в конце месяца
                  </p>
                </article>
              )
            }
            const field = POSTS.find((f) => f.id === emp.profession)?.field ?? emp.profession
            return (
              <article key={post.id} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 text-base sm:text-lg">
                  <span aria-hidden>{post.emoji}</span> {post.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <p className="font-medium text-slate-800">{emp.name}</p>
                  <span className={`rounded-md px-2 py-0.5 text-xs border ${quadraChip(t.quadra)}`}>
                    {label(t, intl)}
                  </span>
                  {emp.super && (
                    <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">
                      🦸 эталон
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{emp.tagline}</p>
                <p className="text-sm text-slate-600 mt-2">
                  {field} · стаж {emp.years} лет · {emp.education}
                </p>
                <p className="text-sm text-slate-600">
                  Зарплата: <b>{fmtMoney(emp.salary)}/мес</b>
                  <span className="text-slate-400"> · «{emp.achievement}»</span>
                </p>
                <div className={`mt-2 inline-flex flex-wrap items-center gap-x-2 rounded-lg border px-2.5 py-1 text-sm ${fitBadgeClass(fit)}`}>
                  <b>{fitStars(fit)}</b>
                  <span>итог {fit}%</span>
                  <span className="text-xs opacity-70">проф {prof}% · соционика {soc}%</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => doFire(post.id)}
                    title={`Выплата ${SEVERANCE_MONTHS} окладов: ${fmtMoney(emp.salary * SEVERANCE_MONTHS)}`}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Уволить (−{fmtMoney(emp.salary * SEVERANCE_MONTHS)})
                  </button>
                  <span className="text-xs text-slate-400">замену ищите на рынке труда</span>
                </div>
              </article>
            )
          })}
        </div>

        {/* Экстренная новость: на рынке суперуправленец */}
        {benchStar && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 mb-4" role="status">
            <p className="font-semibold text-amber-800">
              🦸 Эталон на рынке: {benchStar.name} ({benchStar.ru}) претендует на «{POSTS.find((p) => p.id === benchStar.profession)?.title}»
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Просит {fmtMoney(benchStar.salary)}/мес — в 1,45 раза выше рынка. Кандидаты уходят в конце месяца: суперуправленцы не ждут.
            </p>
          </div>
        )}

        {/* Рынок труда месяца */}
        <h2 className="font-semibold text-slate-800 mb-1 px-1">🧑‍💼 Рынок труда ({game.bench.length})</h2>
        <p className="text-sm text-slate-500 mb-3 px-1">
          Эти люди уйдут при закрытии месяца. Выберите должность: свободную — или с заменой
          (придётся заплатить и подъёмные, и секверанс).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          {game.bench.map((ru) => {
            const c: Candidate | undefined = game.roster.find((x) => x.ru === ru)
            if (!c) return null
            const t = typeByRu(c.ru)
            const field = POSTS.find((p) => p.id === c.profession)?.field ?? c.profession
            const selPost = sel && sel.ru === c.ru ? POSTS.find((p) => p.id === sel.postId) ?? null : null
            const plan: HireCost | null = selPost ? hireCost(game, c.ru, selPost.id) : null
            const fit = selPost ? overallFit(c, selPost) : 0
            return (
              <article key={ru} className={`rounded-2xl p-4 shadow-sm flex flex-col ${c.super ? 'bg-amber-50 border-2 border-amber-400' : 'bg-white border border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <span className={`rounded-md px-2 py-0.5 text-xs border ${quadraChip(t.quadra)}`}>
                    {label(t, intl)}
                  </span>
                  {c.super && (
                    <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">🦸 ЭТАЛОН</span>
                  )}
                  <span className="text-xs text-slate-400">{c.age} лет</span>
                </div>
                <p className="text-xs text-slate-500">{c.tagline}</p>
                {c.super && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Суперуправленец: резюме уровня эталона для «{POSTS.find((p) => p.id === c.profession)?.title}».
                    Дорого, но такое бывает раз в год
                  </p>
                )}
                <p className="text-sm font-medium text-slate-700 mt-2">
                  {field} · стаж {c.years} лет
                </p>
                <p className="text-xs text-slate-500">Образование: {c.education}</p>
                <p className="text-sm text-slate-600 mt-1.5">«{c.achievement}»</p>
                <p className="text-sm font-semibold text-emerald-700 mt-1.5">
                  от {fmtMoney(c.salary)}/мес
                </p>
                <select
                  aria-label={`Должность для ${c.name}`}
                  value={sel && sel.ru === c.ru ? sel.postId : ''}
                  onChange={(e) => {
                    const postId = e.target.value
                    // Начали решать — автопилот встаёт на паузу
                    if (postId && speed !== 0) setSpeed(0)
                    setSel(postId ? { ru: c.ru, postId } : null)
                  }}
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">— куда определить? —</option>
                  {POSTS.map((p) => {
                    const occupied = !!game.slots[p.id].ru
                    return (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {p.title} · {occupied ? 'замена' : 'вакансия'}
                      </option>
                    )
                  })}
                </select>
                {selPost && plan && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm">
                    <div className={`inline-flex flex-wrap items-center gap-x-2 rounded-lg border px-2.5 py-1 ${fitBadgeClass(fit)}`}>
                      <b>{fitStars(fit)}</b>
                      <span>итог {fit}%</span>
                      <span className="text-xs opacity-70">
                        проф {profFit(c, selPost)}% · соционика {postFit(t, selPost)}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-slate-600">
                      Подъёмные: <b>{fmtMoney(plan.bonus)}</b>
                      {plan.replacing && <> · секверанс: <b>{fmtMoney(plan.severance)}</b></>}
                      {' '}· всего из кассы: <b className="text-slate-800">{fmtMoney(plan.total)}</b>
                    </p>
                    {plan.ok ? (
                      <button
                        onClick={() => doHire(c.ru, selPost.id)}
                        className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                      >
                        Предложить работу →
                      </button>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-rose-600">{plan.reason}</p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
        {game.bench.length === 0 && (
          <p className="text-sm text-slate-400 mb-5 px-1">На рынке никого нет — закрывайте месяц, придут новые люди.</p>
        )}

        {/* Итоги прошлого месяца */}
        {lastLog && (
          <section className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-800">📊 Итоги месяца {lastLog.month}</h2>
              <p className="text-sm text-slate-500">
                <span aria-hidden>{DEMAND_MODES[lastLog.demand].emoji}</span> {DEMAND_MODES[lastLog.demand].label}
              </p>
            </div>
            <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <p className="text-slate-600">Выручка: <b className="text-emerald-700">+{fmtMoney(lastLog.revenue)}</b></p>
              <p className="text-slate-600">ФОТ: <b className="text-rose-600">−{fmtMoney(lastLog.payroll)}</b></p>
              <p className="text-slate-600">Операционные: <b className="text-rose-600">−{fmtMoney(lastLog.opex)}</b></p>
              {lastLog.vacancyFine > 0 && (
                <p className="text-slate-600">Простой вакансий: <b className="text-rose-600">−{fmtMoney(lastLog.vacancyFine)}</b></p>
              )}
              <p className="text-slate-600">
                Итог кассы: <b className={lastLog.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {lastLog.net >= 0 ? '+' : '−'}{fmtMoney(Math.abs(lastLog.net))}
                </b>
              </p>
              <p className="text-slate-600">
                Стоимость: <b className={lastLog.valueDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {signedMoney(lastLog.valueDelta)}
                </b>{' '}→ {fmtValue(lastLog.value)}
              </p>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {lastLog.events.map((e, i) => (
                <li
                  key={i}
                  className={e.kind === 'good' ? 'text-emerald-700' : e.kind === 'bad' ? 'text-rose-600' : 'text-slate-500'}
                >
                  • {e.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Действие месяца: вручную или автопилотом */}
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <button
            onClick={() => (game.month > LIVE_MONTHS ? setPhase('final') : doClose())}
            className="rounded-xl bg-slate-800 px-5 py-2.5 font-semibold text-white shadow hover:bg-slate-700"
          >
            {game.month > LIVE_MONTHS
              ? '🏁 Открыть отчёт владельцу'
              : game.month >= LIVE_MONTHS
                ? '🏁 Закрыть год и сдать отчёт'
                : `▶ Закрыть месяц ${game.month} →`}
          </button>
          <div
            className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1"
            role="group"
            aria-label="Скорость моделирования: автопилот месяцев"
          >
            <span className="px-1.5 text-xs text-slate-400">⏱ Автопилот</span>
            {SPEEDS.map((s) => (
              <button
                key={s.ms}
                onClick={() => setSpeed(s.ms)}
                title={s.title}
                aria-pressed={speed === s.ms}
                className={`rounded-lg px-2.5 py-1.5 text-sm ${
                  speed === s.ms ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span aria-hidden>{s.label}</span>
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-500">
            {speed === 0
              ? 'не наняли — кандидаты уйдут · вакансии подорожают'
              : `месяц закроется сам через ${(speed / 1000).toString().replace('.', ',')} с · пауза — чтобы думать`}
          </span>
        </div>
      </main>
      <Disclaimer />
    </div>
  )
}

// ---------- Мелкие компоненты ----------

function quadraChip(q: QuadraId): string {
  const c = QUADRA_COLORS[q]
  return `${c.fill} ${c.text} border-slate-200`
}

function Disclaimer() {
  return (
    <footer className="mt-auto bg-white border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-4 py-3 text-center text-xs text-slate-400">
        Учебная модель: рациональный найм начинается с компетенций и опыта, а соционика —
        дискуссионная типология личности, не научный инструмент отбора персонала.
        Теория закрепляется в тренажёре «Соционика» (socionika.zip),
        кабинет министров живёт в ministerstvo.zip.
      </div>
    </footer>
  )
}
