'use client'

// ============================================================
// ТОРГОВАЯ СЕТЬ «БРАВО» — интерфейс
// ------------------------------------------------------------
// Четвёртый учебный проект. Логика и данные — в src/lib/
// (bravo.ts + relations.ts), здесь только React.
// Экраны: рынок труда → собеседования → штаб сети
// (карта отношений + кризисы) → итоговый отчёт.
// Реалистичный найм: сначала компетентность и опыт
// (65% итогового рейтинга), потом психология (35%).
// И на рынке доступны НЕ все 16 типов — команда
// набирается из того, что есть.
// Прогресс хранится в localStorage.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { TYPES, QUADRAS, FUNCTIONS, type QuadraId } from '@/lib/socionics-data'
import { typeByRu, label } from '@/lib/socionics-quiz'
import {
  relationBetween, RELATION_INFO_14, RELATION_CATEGORY,
  CATEGORY_COLORS, PAIR_SCORE, QUADRA_COLORS,
} from '@/lib/relations'
import {
  POSTS, CRISES, MARKET_MODES, EMPTY_TEAM, PAYROLL_BUDGET,
  postFit, fitStars, profFit, overallFit, bestPostForCandidate,
  payroll, simulateCrisis, buildReport, cohesion, fmtMoney,
  generateMarket, rerollBench, absentTypes, autoAssemble, normalizeCandidate,
  type Candidate, type MarketMode, type Cabinet, type CrisisResult, type RankInfo,
} from '@/lib/bravo'

type Phase = 'market' | 'hiring' | 'governing' | 'report'

const GAME_KEY = 'bravo-game'
const BEST_KEY = 'bravo-best'
// Старые ключи от версии, когда сеть называлась «Чудо»:
// если под новым ключом пусто, читаем оттуда и переносим.
const LEGACY_GAME_KEY = 'chudo-game'
const LEGACY_BEST_KEY = 'chudo-best'

interface SavedGame {
  mode: MarketMode
  pool: Candidate[]
  team: Cabinet
  hunterUsed: boolean
  phase: Phase
}

const RANK_STYLE: Record<string, { bg: string; ring: string; text: string }> = {
  S: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  A: { bg: 'bg-sky-500', ring: 'ring-sky-200', text: 'text-sky-700' },
  B: { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700' },
  C: { bg: 'bg-orange-500', ring: 'ring-orange-200', text: 'text-orange-700' },
  D: { bg: 'bg-rose-500', ring: 'ring-rose-200', text: 'text-rose-700' },
}

const FIT_BADGE: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  mid: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-rose-100 text-rose-700 border-rose-300',
}

function fitBadgeClass(fit: number): string {
  return fit >= 75 ? FIT_BADGE.high : fit >= 55 ? FIT_BADGE.mid : FIT_BADGE.low
}

export default function BravoSimulator() {
  const [phase, setPhase] = useState<Phase>('market')
  const [intl, setIntl] = useState(false)
  const [mode, setMode] = useState<MarketMode>('normal')
  const [pool, setPool] = useState<Candidate[]>([])
  const [team, setTeam] = useState<Cabinet>({ ...EMPTY_TEAM })
  const [hunterUsed, setHunterUsed] = useState(false)
  const [results, setResults] = useState<Record<string, CrisisResult>>({})
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null)
  const [report, setReport] = useState<RankInfo | null>(null)
  const [best, setBest] = useState<{ overall: number; rank: string } | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)
  const hydrated = useRef(false)

  // Читаем сохранённую игру после монтирования (иначе гидратация расходится)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(GAME_KEY) ?? localStorage.getItem(LEGACY_GAME_KEY)
        const ruSet = new Set(TYPES.map((t) => t.ru))
        let restored = false
        if (raw) {
          const saved = JSON.parse(raw) as Partial<SavedGame>
          const validMode: MarketMode = saved.mode && saved.mode in MARKET_MODES ? saved.mode : 'normal'
          const validPhase: Phase =
            saved.phase === 'hiring' || saved.phase === 'governing' || saved.phase === 'market'
              ? saved.phase
              : 'governing' // «отчёт» не сохраняется (результаты кризисов стираются) — возвращаем в штаб
          const validPool = Array.isArray(saved.pool)
            ? saved.pool
              .filter((c) => c && ruSet.has(c.ru) && typeof c.name === 'string')
              .map(normalizeCandidate)
            : []
          if (validPool.length > 0) {
            setMode(validMode)
            setPool(validPool)
            const restoredTeam: Cabinet = { ...EMPTY_TEAM }
            if (saved.team) {
              for (const p of POSTS) {
                const ru = saved.team[p.id]
                if (ru && ruSet.has(ru)) restoredTeam[p.id] = ru
              }
            }
            setTeam(restoredTeam)
            setHunterUsed(!!saved.hunterUsed)
            setPhase(validPhase)
            restored = true
          }
        }
        if (!restored) setPool(generateMarket('normal'))
        const rawBest = localStorage.getItem(BEST_KEY) ?? localStorage.getItem(LEGACY_BEST_KEY)
        if (rawBest) setBest(JSON.parse(rawBest) as { overall: number; rank: string })
        // Зачищаем ключи старой версии («Чудо»): рекорд переносим под новый
        // ключ, партия при первом же изменении перезапишется автосохранением
        try {
          if (rawBest) localStorage.setItem(BEST_KEY, rawBest)
          localStorage.removeItem(LEGACY_BEST_KEY)
          localStorage.removeItem(LEGACY_GAME_KEY)
        } catch { /* приватный режим — не критично */ }
      } catch {
        setPool(generateMarket('normal'))
      }
      hydrated.current = true
    })
  }, [])

  // Игра автосохраняется, но только после восстановления
  useEffect(() => {
    if (!hydrated.current) return
    try {
      const snapshot: SavedGame = { mode, pool, team, hunterUsed, phase }
      localStorage.setItem(GAME_KEY, JSON.stringify(snapshot))
    } catch { /* приватный режим — работаем без сохранений */ }
  }, [mode, pool, team, hunterUsed, phase])

  const assigned = useMemo(
    () => POSTS.filter((p) => team[p.id]).map((p) => ({ post: p, type: typeByRu(team[p.id]!) })),
    [team],
  )
  const usedTypes = useMemo(() => new Set(assigned.map((a) => a.type.ru)), [assigned])
  const bench = useMemo(() => pool.filter((c) => !usedTypes.has(c.ru)), [pool, usedTypes])
  const vacantCount = POSTS.length - assigned.length
  const absent = useMemo(() => absentTypes(pool), [pool])

  function newMarket(m: MarketMode): void {
    setMode(m)
    setPool(generateMarket(m))
    setTeam({ ...EMPTY_TEAM })
    setHunterUsed(false)
    setResults({})
    setSelectedPair(null)
  }

  function refreshMarket(): void {
    setPool(generateMarket(mode))
    setHunterUsed(false)
    setResults({})
  }

  function useHunter(): void {
    if (hunterUsed) return
    setPool(rerollBench(pool, team))
    setHunterUsed(true)
  }

  function assign(postId: string, ru: string): void {
    setTeam((prev) => ({ ...prev, [postId]: ru || null }))
    setResults({}) // состав изменился — кризисы надо переигрывать
    setSelectedPair(null)
  }

  function autoHire(): void {
    setTeam(autoAssemble(pool))
    setResults({})
    setSelectedPair(null)
  }

  function clearHiring(): void {
    setTeam({ ...EMPTY_TEAM })
    setResults({})
    setSelectedPair(null)
  }

  function playCrisis(crisisId: string): void {
    const crisis = CRISES.find((c) => c.id === crisisId)!
    const result = simulateCrisis(team, crisis, pool)
    setResults((prev) => ({ ...prev, [crisisId]: result }))
  }

  function finishReport(): void {
    const rep = buildReport(team, results, {
      mode, poolSize: pool.length, absent: absentTypes(pool), benchCount: bench.length,
    }, pool)
    setReport(rep)
    const newBest = !best || rep.overall > best.overall
    setIsNewBest(newBest)
    if (newBest) {
      const record = { overall: rep.overall, rank: rep.rank }
      setBest(record)
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(record))
      } catch { /* приватный режим */ }
    }
    setPhase('report')
  }

  function startNewGame(): void {
    newMarket(mode)
    setReport(null)
    setIsNewBest(false)
    setPhase('market')
  }

  function goGoverning(): void {
    setSelectedPair(null)
    setPhase('governing')
  }

  // ---------- Данные для графа ----------
  const graph = useMemo(() => {
    const N = POSTS.length
    const cx = 340
    const cy = 340
    const r = 252
    const nodes = POSTS.map((p, i) => {
      const angle = ((-90 + (360 / N) * i) * Math.PI) / 180
      return { post: p, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
    })
    const edges: { i: number; j: number; kind: string; category: string; score: number }[] = []
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const ruA = team[POSTS[i].id]
        const ruB = team[POSTS[j].id]
        if (!ruA || !ruB) continue
        const rel = relationBetween(typeByRu(ruA), typeByRu(ruB))
        edges.push({
          i, j, kind: rel.kind,
          category: RELATION_CATEGORY[rel.kind],
          score: PAIR_SCORE[rel.kind],
        })
      }
    }
    return { nodes, edges }
  }, [team])

  const pairStats = useMemo(() => {
    let comfy = 0, neutral = 0, tense = 0
    for (const e of graph.edges) {
      if (e.category === 'comfy') comfy++
      else if (e.category === 'neutral') neutral++
      else tense++
    }
    return { comfy, neutral, tense }
  }, [graph.edges])

  const cohesionValue = useMemo(() => cohesion(team), [team])

  const selectedRel = useMemo(() => {
    if (!selectedPair) return null
    const a = typeByRu(selectedPair[0])
    const b = typeByRu(selectedPair[1])
    const rel = relationBetween(a, b)
    const postA = POSTS.find((p) => team[p.id] === a.ru)!
    const postB = POSTS.find((p) => team[p.id] === b.ru)!
    return { a, b, rel, postA, postB }
  }, [selectedPair, team])

  function personName(ru: string): string {
    const c = pool.find((x) => x.ru === ru)
    return c ? c.name : typeByRu(ru).name
  }

  const intlBtn = (
    <button
      onClick={() => setIntl(!intl)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
    >
      {intl ? 'ILE → ИЛЭ' : 'ИЛЭ → ILE'}
    </button>
  )

  // ============ ЭКРАН 1: РЫНОК ТРУДА ============
  if (phase === 'market') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                🛒 Сеть магазинов «Браво»
              </h1>
              <p className="text-slate-500 mt-1 text-sm sm:text-base">
                Симулятор управления коммерческой организацией: набираем команду из того, что есть
              </p>
            </div>
            {intlBtn}
          </header>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <p className="text-sm sm:text-base text-slate-600">
              Вы — владелец сети продуктовых магазинов <b>«Браво»</b>: четыре точки и план на пятую.
              Нанимаем как рациональный работодатель: <b>сначала компетентность и опыт</b>,
              и лишь потом психологические особенности. Итоговый рейтинг кандидата
              = <b>65% профпригодность + 35% соответствие типа должности</b>. Но рынок труда
              живёт по своим правилам: соискатели не покрывают всю палитру из 16 типов —
              <b> приходится набирать из того, что есть</b>.
            </p>
          </section>

          <section className="mb-5">
            <h2 className="font-semibold text-slate-800 mb-2 px-1">Ситуация на рынке труда</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(MARKET_MODES) as MarketMode[]).map((m) => {
                const info = MARKET_MODES[m]
                const active = m === mode
                return (
                  <button
                    key={m}
                    onClick={() => newMarket(m)}
                    aria-pressed={active}
                    className={`text-left rounded-2xl border-2 p-4 transition ${active
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                  >
                    <p className="font-semibold text-slate-800">
                      <span aria-hidden>{info.emoji}</span> {info.label}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">{info.hint}</p>
                  </button>
                )
              })}
            </div>
          </section>

          {pool.length === 0 ? (
            <p className="text-slate-400 py-8 text-center">Формируем рынок труда…</p>
          ) : (
            <>
              <h2 className="font-semibold text-slate-800 mb-3 px-1">Кандидаты ({pool.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-5">
                {pool.map((c) => {
                  const t = typeByRu(c.ru)
                  const field = POSTS.find((p) => p.id === c.profession)?.field ?? c.profession
                  return (
                    <article key={c.ru} className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 flex flex-col">
                      <p className="font-semibold text-slate-800 leading-tight">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.age} лет</p>
                      <p className="text-sm font-medium text-slate-700 mt-2">
                        {field} · стаж {c.years} лет
                      </p>
                      <p className="text-xs text-slate-500">Образование: {c.education}</p>
                      <p className="text-sm text-slate-600 mt-1.5 flex-1">«{c.achievement}»</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-1.5">
                        от {fmtMoney(c.salary)}/мес
                      </p>
                      <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                        тип {label(t, intl)} — {c.tagline}
                      </p>
                    </article>
                  )
                })}
              </div>

              <section className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm mb-5">
                <p className="text-sm text-slate-500">
                  <b className="text-slate-700">На рынке сейчас нет:</b>{' '}
                  {absent.length === 0 ? '— повезло, вся палитра доступна!' : absent.join(', ')}
                  <span className="text-slate-400"> · этих специалистов придётся ждать или обходиться без них</span>
                </p>
              </section>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setPhase('hiring')}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-emerald-500"
                >
                  К собеседованиям →
                </button>
                <button
                  onClick={refreshMarket}
                  title="Пересобрать рынок заново"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  🔄 Обновить рынок
                </button>
                <button
                  onClick={useHunter}
                  disabled={hunterUsed}
                  title="Один раз за игру: заменит двух кандидатов новыми типами, которых ещё не было"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🧲 Хедхантер {hunterUsed ? '— использован' : '(1 раз)'}
                </button>
                {best && (
                  <span className="ml-auto text-sm text-slate-500">
                    Рекорд: <b>{best.overall}%</b> (ранг {best.rank})
                  </span>
                )}
              </div>
            </>
          )}
        </main>
        <Disclaimer />
      </div>
    )
  }

  // ============ ЭКРАН 4: ИТОГОВЫЙ ОТЧЁТ ============
  if (phase === 'report' && report) {
    const style = RANK_STYLE[report.rank]
    const playedCount = CRISES.filter((c) => results[c.id]).length
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Итоговый отчёт для владельца</h1>
            {isNewBest && (
              <p className="mt-1 inline-block rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-sm font-semibold text-amber-700">
                🏆 Новый рекорд!
              </p>
            )}
          </div>

          <section className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 text-center mb-5">
            <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full ${style.bg} ring-8 ${style.ring} text-white text-5xl font-black`}>
              {report.rank}
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-800">{report.overall}%</p>
            <p className="text-slate-500">общая оценка команды</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-left">
              <Bar title="Кризисы (среднее)" value={report.avgCrisis} hint={`${playedCount} из ${CRISES.length} отыграно`} color="bg-sky-500" />
              <Bar title="Профессиональный уровень" value={report.avgProf} hint="средняя профпригодность нанятых" color="bg-teal-500" />
              <Bar title="Итог назначений" value={report.avgFit} hint="65% проф + 35% соционика" color="bg-emerald-500" />
              <Bar title="Сплочённость" value={report.cohesionValue} hint="по парам менеджеров" color="bg-amber-500" />
            </div>
          </section>

          {report.mode && (
            <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
              <h2 className="font-semibold text-slate-800 mb-2">Кадровый контекст</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                <span>Рынок: <b>{MARKET_MODES[report.mode].label}</b></span>
                <span>Кандидатов было: <b>{report.poolSize}</b> из 16 типов</span>
                <span>В запасе осталось: <b>{report.benchCount}</b></span>
                {report.payroll > 0 && (
                  <span>
                    ФОТ: <b>{fmtMoney(report.payroll)}</b>
                    {report.payrollOver > 0
                      ? <span className="text-rose-600"> (+{report.payrollOver}% к бюджету)</span>
                      : <span className="text-slate-400"> из {fmtMoney(PAYROLL_BUDGET)}</span>}
                  </span>
                )}
              </div>
              {report.absent && report.absent.length > 0 && (
                <p className="text-sm text-slate-500 mt-2">
                  Не хватало типов: <span className="text-slate-700 font-medium">{report.absent.join(', ')}</span>
                </p>
              )}
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 mb-5">
            <section className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
              <h2 className="font-semibold text-emerald-700 mb-2">✅ Сильные стороны</h2>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-slate-600 leading-snug">{s}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
              <h2 className="font-semibold text-amber-700 mb-2">⚠️ Риски</h2>
              <ul className="space-y-2">
                {report.risks.map((s, i) => (
                  <li key={i} className="text-sm text-slate-600 leading-snug">{s}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-6">
            <h2 className="font-semibold text-slate-800 mb-3">Состав команды</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Должность</th>
                    <th className="py-2 pr-3 font-medium">Человек</th>
                    <th className="py-2 pr-3 font-medium">Квадра</th>
                    <th className="py-2 pr-3 font-medium">Профиль</th>
                    <th className="py-2 font-medium">Итог</th>
                  </tr>
                </thead>
                <tbody>
                  {POSTS.map((p) => {
                    const ru = team[p.id]
                    const t = ru ? typeByRu(ru) : null
                    const cand = ru ? pool.find((c) => c.ru === ru) : null
                    const prof = cand ? profFit(cand, p) : 0
                    const soc = t ? postFit(t, p) : 0
                    const blended = cand ? overallFit(cand, p) : 0
                    const field = cand
                      ? POSTS.find((f) => f.id === cand.profession)?.field ?? cand.profession
                      : ''
                    return (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-700">{p.emoji} {p.title}</td>
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {t ? `${personName(ru!)} · ${label(t, intl)}` : '— вакансия —'}
                        </td>
                        <td className="py-2 pr-3">
                          {t && (
                            <span className={`rounded-md px-2 py-0.5 text-xs border ${quadraChip(t.quadra)}`}>
                              {QUADRAS[t.quadra].name}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {cand ? `${field} · стаж ${cand.years} лет` : '—'}
                        </td>
                        <td className="py-2">
                          {cand ? `${fitStars(blended)} ${blended}% (проф ${prof} · соц ${soc})` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setPhase('governing')}
              className="rounded-xl bg-slate-800 px-5 py-2.5 font-semibold text-white hover:bg-slate-700"
            >
              ← Вернуться в штаб
            </button>
            <button
              onClick={startNewGame}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              🔄 Новый рынок
            </button>
          </div>
        </main>
        <Disclaimer />
      </div>
    )
  }

  // ============ ЭКРАН 2: СОБЕСЕДОВАНИЯ ============
  if (phase === 'hiring') {
    const filled = assigned.length
    const hiringPayroll = payroll(team, pool)
    const payrollOverPct = hiringPayroll > PAYROLL_BUDGET
      ? Math.round((hiringPayroll / PAYROLL_BUDGET - 1) * 100)
      : 0
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">🧑‍💼 Собеседования</h1>
              <p className="text-slate-500 mt-1 text-sm sm:text-base">
                Распределите кандидатов по 8 должностям: итоговый рейтинг = 65% профпригодность +
                35% соционика. Пустое кресло — тоже вариант, но за него команда заплатит в кризисах.
              </p>
            </div>
            {intlBtn}
          </header>

          <section className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-600">Команда: <b className="text-slate-800">{filled}/{POSTS.length}</b></span>
              <span className="text-slate-600">В запасе: <b className="text-slate-800">{bench.length}</b></span>
              <span className="text-slate-600">Рынок: <b className="text-slate-800">{MARKET_MODES[mode].label}</b></span>
              <span className="text-slate-600">
                ФОТ: <b className={payrollOverPct > 0 ? 'text-rose-600' : 'text-slate-800'}>{fmtMoney(hiringPayroll)}</b>
                <span className="text-slate-400"> из {fmtMoney(PAYROLL_BUDGET)}</span>
              </span>
              {payrollOverPct > 0 && (
                <span className="rounded-lg bg-rose-100 border border-rose-300 text-rose-700 px-2.5 py-1 text-xs font-medium">
                  Перерасход ФОТ: +{payrollOverPct}% к бюджету
                </span>
              )}
              {vacantCount > 0 && (
                <span className="rounded-lg bg-amber-100 border border-amber-300 text-amber-700 px-2.5 py-1 text-xs font-medium">
                  Внимание: {vacantCount === 1 ? 'должность останется пустой' : `${vacantCount} должностей останутся пустыми`}
                </span>
              )}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 mb-5">
            {POSTS.map((post) => {
              const ru = team[post.id]
              const t = ru ? typeByRu(ru) : null
              const cand = ru ? pool.find((c) => c.ru === ru) : null
              const prof = cand ? profFit(cand, post) : 0
              const soc = t ? postFit(t, post) : 0
              const blended = cand ? overallFit(cand, post) : 0
              const top = pool
                .map((c) => ({ c, fit: overallFit(c, post) }))
                .sort((a, b) => b.fit - a.fit)
                .slice(0, 3)
              return (
                <article key={post.id} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200">
                  <h2 className="font-semibold text-slate-800 text-base sm:text-lg">
                    <span aria-hidden>{post.emoji}</span> {post.title}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">{post.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[post.primary, post.secondary].map((fn) => (
                      <span key={fn}
                        className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-600"
                        title={FUNCTIONS[fn].name}>
                        {fn} · {FUNCTIONS[fn].name}
                      </span>
                    ))}
                  </div>
                  <select
                    aria-label={`Назначить кандидата на должность «${post.title}»`}
                    value={ru ?? ''}
                    onChange={(e) => assign(post.id, e.target.value)}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">— вакансия —</option>
                    {POSTS.map((fieldPost) => {
                      const inField = pool
                        .filter((c) => c.profession === fieldPost.id)
                        .sort((a, b) => overallFit(b, post) - overallFit(a, post))
                      if (inField.length === 0) return null
                      return (
                        <optgroup key={fieldPost.id} label={`Сфера «${fieldPost.field}»`}>
                          {inField.map((candidate) => {
                            const busy = usedTypes.has(candidate.ru) && candidate.ru !== ru
                            return (
                              <option key={candidate.ru} value={candidate.ru} disabled={busy}>
                                {candidate.name} ({label(typeByRu(candidate.ru), intl)}) — итог {overallFit(candidate, post)}%{busy ? ' — нанят' : ''}
                              </option>
                            )
                          })}
                        </optgroup>
                      )
                    })}
                  </select>
                  {cand ? (
                    <div className={`mt-2 inline-flex flex-wrap items-center gap-x-2 rounded-lg border px-2.5 py-1 text-sm ${fitBadgeClass(blended)}`}>
                      <b>{fitStars(blended)}</b>
                      <span>итог {blended}%</span>
                      <span className="text-xs opacity-70">проф {prof}% · соционика {soc}%</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      Лучшие по итоговому рейтингу: {top.map((x) => `${x.c.name} ${x.fit}%`).join(' · ')}
                    </p>
                  )}
                </article>
              )
            })}
          </div>

          {bench.length > 0 && (
            <section className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 mb-5">
              <h2 className="font-semibold text-slate-800 mb-2">Скамейка запасных ({bench.length})</h2>
              <div className="flex flex-wrap gap-2">
                {bench.map((c) => {
                  const t = typeByRu(c.ru)
                  const suggestion = bestPostForCandidate(c)
                  const field = POSTS.find((p) => p.id === c.profession)?.field ?? c.profession
                  return (
                    <span key={c.ru}
                      title={`${c.name}, ${c.age} лет · ${field}, стаж ${c.years} лет · «${c.achievement}» · тип ${label(t, intl)} — ${c.tagline}`}
                      className={`rounded-lg border px-2.5 py-1 text-sm ${quadraChip(t.quadra)}`}>
                      {c.name} → {suggestion.post.emoji} {suggestion.post.title} ({suggestion.fit}%)
                    </span>
                  )
                })}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={goGoverning}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-emerald-500"
            >
              Открыть офис → {filled}/{POSTS.length}
            </button>
            <button
              onClick={autoHire}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              🤖 Подобрать автоматически
            </button>
            <button
              onClick={clearHiring}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              🧹 Сбросить назначения
            </button>
            {best && (
              <span className="ml-auto text-sm text-slate-500">
                Рекорд: <b>{best.overall}%</b> (ранг {best.rank})
              </span>
            )}
          </div>
        </main>
        <Disclaimer />
      </div>
    )
  }

  // ============ ЭКРАН 3: ШТАБ СЕТИ (ГРАФ + КРИЗИСЫ) ============
  const played = CRISES.filter((c) => results[c.id]).length
  const hqPayroll = payroll(team, pool)
  const hqPayrollOver = hqPayroll > PAYROLL_BUDGET
    ? Math.round((hqPayroll / PAYROLL_BUDGET - 1) * 100)
    : 0
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">🏪 Штаб сети «Браво»</h1>
          <div className="flex items-center gap-2">
            {intlBtn}
            <button
              onClick={() => setPhase('hiring')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ← Изменить состав
            </button>
          </div>
        </header>

        {/* Полоска команды */}
        <section className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
          <div className="flex flex-wrap gap-2">
            {POSTS.map((p) => {
              const t = team[p.id] ? typeByRu(team[p.id]!) : null
              return (
                <span key={p.id}
                  className={`rounded-lg border px-2.5 py-1 text-sm ${t ? quadraChip(t.quadra) : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {p.emoji} {t ? label(t, intl) : 'вакансия'}
                </span>
              )
            })}
          </div>
          <p className={`mt-2 text-xs ${hqPayrollOver > 0 ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
            ФОТ команды: {fmtMoney(hqPayroll)} из бюджета {fmtMoney(PAYROLL_BUDGET)}/мес
            {hqPayrollOver > 0 && <> — перерасход +{hqPayrollOver}%</>}
          </p>
        </section>
        <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-4">
          <h2 className="font-semibold text-slate-800 mb-1">Карта отношений</h2>
          <p className="text-sm text-slate-500 mb-3">Нажмите на линию между менеджерами, чтобы узнать тип отношений.</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_260px] items-start">
            <div className="w-full max-w-[560px] mx-auto">
              <svg viewBox="0 0 680 680" className="w-full h-auto" role="img" aria-label="Граф отношений между менеджерами сети">
                {graph.edges.map((e, idx) => {
                  const a = graph.nodes[e.i]
                  const b = graph.nodes[e.j]
                  const selected = selectedPair && (
                    (team[POSTS[e.i].id] === selectedPair[0] && team[POSTS[e.j].id] === selectedPair[1]) ||
                    (team[POSTS[e.i].id] === selectedPair[1] && team[POSTS[e.j].id] === selectedPair[0])
                  )
                  const color = CATEGORY_COLORS[e.category as keyof typeof CATEGORY_COLORS]
                  return (
                    <g key={idx}>
                      <line
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={color}
                        strokeWidth={selected ? 5 : 1.6 + Math.abs(e.score) * 0.9}
                        strokeOpacity={selected ? 1 : 0.55}
                        strokeDasharray={e.category === 'tense' ? '7 5' : undefined}
                      />
                      <line
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="transparent"
                        strokeWidth={16}
                        className="cursor-pointer"
                        onClick={() => setSelectedPair([team[POSTS[e.i].id]!, team[POSTS[e.j].id]!])}
                      >
                        <title>{`${relationBetween(typeByRu(team[POSTS[e.i].id]!), typeByRu(team[POSTS[e.j].id]!)).kind}`}</title>
                      </line>
                    </g>
                  )
                })}
                {graph.nodes.map(({ post, x, y }) => {
                  const t = team[post.id] ? typeByRu(team[post.id]!) : null
                  const colors = t ? QUADRA_COLORS[t.quadra] : { stroke: '#cbd5e1', fill: '#f8fafc', text: '#94a3b8' }
                  return (
                    <g key={post.id}>
                      <circle cx={x} cy={y} r={38} fill={colors.fill} stroke={colors.stroke} strokeWidth={2.5} />
                      <text x={x} y={y - 2} textAnchor="middle" fontSize={20} aria-hidden>{post.emoji}</text>
                      <text x={x} y={y + 18} textAnchor="middle" fontSize={14} fontWeight={700} fill={colors.text}>
                        {t ? (intl ? t.intl : t.ru) : 'вак.'}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 p-3 text-sm space-y-1.5">
                <LegendRow color={CATEGORY_COLORS.comfy} label="Комфортные" count={pairStats.comfy} />
                <LegendRow color={CATEGORY_COLORS.neutral} label="Нейтральные" count={pairStats.neutral} />
                <LegendRow color={CATEGORY_COLORS.tense} label="Напряжённые" count={pairStats.tense} dashed />
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-700">Сплочённость команды</p>
                <div className="mt-2 h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${cohesionValue}%` }} />
                </div>
                <p className="mt-1 text-sm text-slate-500"><b>{cohesionValue}%</b> из 100</p>
              </div>
            </div>
          </div>

          {selectedRel && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-slate-800">{selectedRel.postA.emoji} {label(selectedRel.a, intl)}</span>
                <span className="text-slate-400">↔</span>
                <span className="font-semibold text-slate-800">{selectedRel.postB.emoji} {label(selectedRel.b, intl)}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold text-white ${selectedRel.rel.kind === 'дуальность' || selectedRel.rel.kind === 'активация' ? 'bg-emerald-500' : RELATION_CATEGORY[selectedRel.rel.kind] === 'tense' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                  {selectedRel.rel.kind}
                </span>
              </div>
              {selectedRel.rel.roleA && (
                <p className="text-sm text-slate-500 mb-1">
                  {label(selectedRel.a, intl)} — <b>{selectedRel.rel.roleA}</b>, {label(selectedRel.b, intl)} — <b>{selectedRel.rel.roleB}</b>
                </p>
              )}
              <p className="text-sm text-slate-600">{RELATION_INFO_14[selectedRel.rel.kind]}</p>
            </div>
          )}
        </section>

        {/* Кризисы */}
        <h2 className="font-semibold text-slate-800 mb-3 px-1">Бизнес-кризисы ({played}/{CRISES.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          {CRISES.map((crisis) => {
            const res = results[crisis.id]
            return (
              <article key={crisis.id} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col">
                <h3 className="font-semibold text-slate-800 text-base sm:text-lg">
                  <span aria-hidden>{crisis.emoji}</span> {crisis.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 flex-1">{crisis.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {crisis.involved.map((id) => {
                    const p = POSTS.find((x) => x.id === id)!
                    const t = team[id] ? typeByRu(team[id]!) : null
                    return (
                      <span key={id} className={`rounded-md px-2 py-0.5 text-xs border ${t ? quadraChip(t.quadra) : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                        {p.emoji} {t ? (intl ? t.intl : t.ru) : 'вакансия'}
                      </span>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(Object.entries(crisis.demands) as [keyof typeof FUNCTIONS, number][]).map(([fn, w]) => (
                    <span key={fn} className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      {fn} ×{w}
                    </span>
                  ))}
                </div>
                {res ? (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-2xl font-bold text-slate-800">{res.score}%</p>
                      <p className="text-xs text-slate-400">
                        {res.relationPenalty !== 0 && `отношения: ${res.relationPenalty > 0 ? '+' : ''}${res.relationPenalty} `}
                        {res.emptyPenalty > 0 && `вакансии: −${res.emptyPenalty}`}
                      </p>
                    </div>
                    <div className="mt-1 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${res.score >= 80 ? 'bg-emerald-500' : res.score >= 60 ? 'bg-sky-500' : res.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${res.score}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{res.narrative}</p>
                    <ul className="mt-2 space-y-1">
                      {res.contributions.slice(0, 4).map((c, i) => (
                        <li key={i} className="text-xs text-slate-500">
                          <b className="text-slate-700">{c.postTitle}</b> · {label(c.type, intl)}:{' '}
                          {FUNCTIONS[c.fn].name} — {c.position}-я функция · проф {c.prof}%
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <button
                    onClick={() => playCrisis(crisis.id)}
                    className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    ⚡ Решить вопрос
                  </button>
                )}
              </article>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 pb-2">
          <button
            onClick={finishReport}
            disabled={played === 0}
            className="rounded-xl bg-slate-800 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📋 Итоговый отчёт ({played}/{CRISES.length})
          </button>
          {played < CRISES.length && (
            <span className="text-sm text-slate-500">Отыграйте хотя бы один кризис</span>
          )}
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

function Bar({ title, value, hint, color }: { title: string; value: number; hint: string; color: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="mt-1.5 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{value}% · {hint}</p>
    </div>
  )
}

function LegendRow({ color, label, count, dashed }: { color: string; label: string; count: number; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="30" height="8" aria-hidden>
        <line x1="0" y1="4" x2="30" y2="4" stroke={color} strokeWidth="3" strokeDasharray={dashed ? '5 4' : undefined} />
      </svg>
      <span className="text-slate-600">{label}</span>
      <span className="ml-auto font-semibold text-slate-800">{count}</span>
    </div>
  )
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
