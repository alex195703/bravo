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
// Кабинет министров (2.5): кризисы приходят из реальных портфелей
// украинского правительства — разведка предупреждает, а сеть
// лоббирует встречи через интертипные отношения с министрами.
// Логика и данные — в src/lib/bravo.ts, здесь только React.
// Прогресс хранится в localStorage.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { TYPES, QUADRAS, type QuadraId } from '@/lib/socionics-data'
import { QUADRA_COLORS } from '@/lib/relations'
import { typeByRu, label } from '@/lib/socionics-quiz'
import {
  POSTS, MARKET_MODES, PAYROLL_BUDGET,
  fitStars, profFit, postFit, overallFit,
  payroll, cohesion, fmtMoney, fmtValue, VACANCY_VALUE_PENALTY,
  normalizeCandidate, DEMAND_MODES, LIVE_MONTHS,
  SEVERANCE_MONTHS, SIGNING_BONUS_MONTHS,
  newLiveGame, liveValue, liveRevenue, liveVacancyFine, liveCabinet,
  hireCandidate, fireEmployee, closeMonth, liveGrade, vacancyFineFor,
  teamVsIdeal, idealCompare,
  companyProfile, assignPreview, promoteEmployee, promoteCost,
  PROMO_GRACE_MONTHS, FUNCTIONS, CRISIS_BASELINE,
  CRISES, requestLobby, cancelLobby, LOBBY_COST, lobbyBonusFor,
  ministerForPortfolio, ministerDemandBias, portfolioTitle,
  currentCabinet, crisesOfPortfolio, newGovernmentState, politicianById,
  CABINET_ALTERNATIVES, CABINET_PRESIDENT, RESHUFFLE_MONTH,
  type LiveGame, type MonthLog, type MonthEvent, type DemandMode,
  type MarketMode, type Candidate, type CrisisLog,
  type IdealState, type SlotState, type IdealCompare, type IdealLinePoint,
  type PromotionRequest, type AssignmentPreview, type CompanyProfile,
  type GovernmentState, type LobbyRequest,
} from '@/lib/bravo'

type Phase = 'intro' | 'manage' | 'final'

const GAME_KEY = 'bravo-live-game-v2'
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

const IDEAL_CHIP: Record<string, string> = {
  ahead: 'bg-amber-100 text-amber-800 border-amber-400',
  close: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  mid: 'bg-amber-50 text-amber-700 border-amber-300',
  far: 'bg-rose-100 text-rose-700 border-rose-300',
}

function idealChipClass(pct: number): string {
  return pct >= 100 ? IDEAL_CHIP.ahead : pct >= 90 ? IDEAL_CHIP.close : pct >= 70 ? IDEAL_CHIP.mid : IDEAL_CHIP.far
}

/** Вердикт финала: чем игрок закончил против линии идеала */
function idealVerdict(pct: number, gap: number): string {
  if (pct >= 100) return `🏅 Вы обогнали линию идеала на ${fmtValue(-gap)}: случайности мира были на вашей стороне. Такое удаётся немногим.`
  if (pct >= 90) return `Вы почти догнали идеал: отставание всего ${fmtValue(gap)}. Ещё пара верных решений — и линия ваша.`
  if (pct >= 75) return `Крепкая игра, но идеал в тех же условиях управил на ${fmtValue(gap)} лучше — посмотрите, где линии разошлись.`
  return `Идеал в тех же условиях успел на ${fmtValue(gap)} больше. Сравните линии по месяцам: там, где они разошлись, и сидят ваши деньги.`
}

/** «+2,6 млн грн» / «−1,2 млн грн» — деньги со знаком */
function signedMoney(n: number): string {
  return n >= 0 ? `+${fmtValue(n)}` : `−${fmtValue(Math.abs(n))}`
}

/** Восстановление теневой компании из сохранения: без неё партия не принимается */
function restoreIdeal(parsed: Partial<LiveGame>): IdealState | null {
  const i = parsed.ideal as Partial<IdealState> | undefined
  if (!i || typeof i !== 'object') return null
  const cash = Number(i.cash)
  if (!Number.isFinite(cash) || cash < 0) return null
  if (!i.slots || typeof i.slots !== 'object') return null
  const rawSlots = i.slots as Record<string, { ru?: unknown; vacantMonths?: unknown }>
  const slots: Record<string, SlotState> = {}
  for (const p of POSTS) {
    const s = rawSlots[p.id]
    if (!s) return null
    const ru = typeof s.ru === 'string' && TYPES.some((t) => t.ru === s.ru) ? s.ru : null
    const vacantMonths = Number.isFinite(Number(s.vacantMonths))
      ? Math.max(0, Math.floor(Number(s.vacantMonths)))
      : 0
    slots[p.id] = { ru, vacantMonths }
  }
  const roster = Array.isArray(i.roster)
    ? i.roster
      .filter((c) => c && typeof c.ru === 'string' && TYPES.some((t) => t.ru === c.ru))
      .map(normalizeCandidate)
    : []
  const history = Array.isArray(i.history)
    ? i.history
      .filter((h) => h && Number.isFinite(Number(h.value)) && Number(h.month) >= 1)
      .map((h) => ({ month: Number(h.month), value: Number(h.value) }))
    : []
  const moves = Array.isArray(i.moves) ? i.moves.filter((m): m is string => typeof m === 'string') : []
  const valueShift = Number.isFinite(Number(i.valueShift)) ? Number(i.valueShift) : 0
  return { cash, slots, roster, history, moves, valueShift }
}

/**
 * Кабинет министров из сохранения: старые сейвы не знают про gov —
 * считаем, что кабинет дефолтный и разведка спит.
 */
function restoreGov(parsed: Partial<LiveGame>, roster: Candidate[]): GovernmentState {
  const base = newGovernmentState()
  const g = parsed.gov as Partial<GovernmentState> | undefined
  if (!g || typeof g !== 'object') return base
  const sponsors = { ...base.sponsors }
  if (g.sponsors && typeof g.sponsors === 'object') {
    for (const key of Object.keys(base.sponsors)) {
      const pid = (g.sponsors as Record<string, unknown>)[key]
      if (typeof pid === 'string' && politicianById(pid)) sponsors[key] = pid
    }
  }
  let lobby: LobbyRequest | null = null
  if (g.lobby && typeof g.lobby === 'object') {
    const l = g.lobby as Partial<LobbyRequest>
    if (
      typeof l.ru === 'string' && roster.some((c) => c.ru === l.ru) &&
      typeof l.portfolio === 'string' && !!sponsors[l.portfolio] &&
      Number.isFinite(Number(l.cost)) && Number(l.cost) > 0
    ) {
      lobby = { portfolio: l.portfolio, ru: l.ru, cost: Number(l.cost) }
    }
  }
  const pendingCrisis =
    typeof g.pendingCrisis === 'string' && CRISES.some((c) => c.id === g.pendingCrisis)
      ? g.pendingCrisis
      : null
  const changes = Array.isArray(g.changes)
    ? g.changes.filter((x): x is string => typeof x === 'string')
    : []
  return { sponsors, lobby, pendingCrisis, reshuffled: g.reshuffled === true, changes }
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
    const ideal = restoreIdeal(parsed)
    if (!ideal) return null
    // Запросы карьерного роста: в старых сохранениях их нет — считаем, что их и не было
    const promotions = Array.isArray(parsed.promotions)
      ? (parsed.promotions as Partial<PromotionRequest>[])
        .filter((pr) => pr && typeof pr.ru === 'string' &&
          roster.some((c) => c.ru === pr.ru) &&
          Number.isFinite(Number(pr.since)) &&
          typeof pr.wantedPost === 'string' && POSTS.some((p) => p.id === pr.wantedPost))
        .map((pr) => ({
          ru: String(pr.ru),
          since: Math.max(1, Math.floor(Number(pr.since))),
          wantedPost: String(pr.wantedPost),
        }))
      : []
    const promotionsDone = Number.isFinite(Number(parsed.promotionsDone))
      ? Math.max(0, Math.floor(Number(parsed.promotionsDone)))
      : 0
    // Кризисы (2.4): в старых сохранениях репутации нет — считаем, что кризисов не было
    const valueShift = Number.isFinite(Number(parsed.valueShift)) ? Number(parsed.valueShift) : 0
    const lastCrisis = typeof parsed.lastCrisis === 'string' ? parsed.lastCrisis : null
    const gov = restoreGov(parsed, roster)
    return { month: Math.floor(month), cash, labor, demand, slots, roster, bench, history, startValue, ideal, promotions, promotionsDone, valueShift, lastCrisis, gov }
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
  // Карьерный рост: выбранное кресло для повышения (пусто — панель свёрнута)
  const [promoTarget, setPromoTarget] = useState('')
  // Кабинет министров: выбранный лоббист (до нажатия кнопки)
  const [lobbyPick, setLobbyPick] = useState('')
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
  // Линия идеального управления: теневой управляющий против игрока
  const cmp = useMemo(() => (game ? idealCompare(game) : null), [game])
  // Профиль компании: компетенции + соционика (для панели ниже)
  const profile = useMemo(() => (game ? companyProfile(game) : null), [game])
  // Карьерный рост: активный запрос и выбранная цель повышения
  const promoReq = game && game.promotions.length > 0 ? game.promotions[0] : null
  const promoCand = promoReq && game ? game.roster.find((c) => c.ru === promoReq.ru) ?? null : null
  const promoFromPost = promoReq && game
    ? POSTS.find((p) => game.slots[p.id]?.ru === promoReq.ru) ?? null
    : null
  const promoWantedPost = promoReq ? POSTS.find((p) => p.id === promoReq.wantedPost) ?? null : null
  const promoPv = game && promoReq && promoTarget ? assignPreview(game, promoReq.ru, promoTarget) : null
  const promoMonthsLeft = game && promoReq
    ? Math.max(1, PROMO_GRACE_MONTHS - (game.month - promoReq.since))
    : 0
  const benchStar = game && cab
    ? game.bench
      .map((ru) => game.roster.find((c) => c.ru === ru))
      .find((c) => c?.super) ?? null
    : null

  // Кабинет министров: разведка месяца и лоббирование (2.5)
  const pendingCrisisId = game && game.gov.pendingCrisis ? game.gov.pendingCrisis : null
  const pendingCrisis = pendingCrisisId ? CRISES.find((c) => c.id === pendingCrisisId) ?? null : null
  const pendingMinister = game && pendingCrisis
    ? ministerForPortfolio(game.gov, pendingCrisis.sponsor)
    : null
  const cabinetMinisters = game ? currentCabinet(game.gov) : []
  const lobbyInfo = game?.gov.lobby ?? null
  const lobbyCand = game && lobbyInfo ? game.roster.find((c) => c.ru === lobbyInfo.ru) ?? null : null
  const lobbyMinister = game && lobbyInfo ? ministerForPortfolio(game.gov, lobbyInfo.portfolio) : null
  const lobbyScore = lobbyCand && lobbyMinister ? lobbyBonusFor(typeByRu(lobbyCand.ru), lobbyMinister) : null
  const lobbyPickScore = game && lobbyPick && pendingMinister
    ? lobbyBonusFor(typeByRu(lobbyPick), pendingMinister)
    : null
  const staffOptions = useMemo(() => {
    if (!game || !pendingMinister) return []
    const opts = POSTS
      .map((p) => {
        const ru = game.slots[p.id]?.ru
        const emp = ru ? game.roster.find((c) => c.ru === ru) ?? null : null
        if (!emp) return null
        return { emp, post: p, lb: lobbyBonusFor(typeByRu(emp.ru), pendingMinister) }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    return opts.sort((a, b) => b.lb.bonus - a.lb.bonus)
  }, [game, pendingMinister])

  function acceptCompany(): void {
    setGame(newLiveGame())
    setNote(null)
    setSel(null)
    setPromoTarget('')
    setLobbyPick('')
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

  function doPromote(ru: string, postId: string): void {
    if (!game) return
    const res = promoteEmployee(game, ru, postId)
    setGame(res.game)
    setNote(res.event)
    setPromoTarget('')
  }

  function doFire(postId: string): void {
    if (!game) return
    const res = fireEmployee(game, postId)
    setGame(res.game)
    setNote(res.event)
  }

  function doLobby(ru: string): void {
    if (!game || !pendingCrisis) return
    const res = requestLobby(game, ru, pendingCrisis.sponsor)
    setGame(res.game)
    setNote(res.event)
    setLobbyPick('')
  }

  function doCancelLobby(): void {
    if (!game) return
    const res = cancelLobby(game)
    setGame(res.game)
    setNote(res.event)
  }

  function doClose(): void {
    if (!game || game.month > LIVE_MONTHS) return
    const res = closeMonth(game)
    setGame(res.game)
    setNote(null)
    setSel(null)
    setPromoTarget('')
    setLobbyPick('')
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
        emoji: '🥇', title: 'Линия идеального управления',
        text: 'Рядом с вами играет теневой суперуправленец: принял ту же сеть и живёт в тех же условиях, но ходит без ошибок. Его линия на графике — ваша цель; догоните её, а если повезёт — обгоните!',
      },
      {
        emoji: '🧬', title: 'Профиль компании и анализ назначения',
        text: 'Каждое назначение меняет и компетентностный, и соционический профиль сети. Перед ходом — анализ «до → после»: сильные функции, квадры, сплочённость и стоимость в гривнах, плюс совпадение кандидата с эталоном кресла.',
      },
      {
        emoji: '🚀', title: 'Карьерный рост',
        text: 'Сильные люди растут: сотрудник может попросить большее кресло. Повысите — его старое кресло опустеет: вакансия рождается и из повышения! Проигнорируете два месяца — человек уйдёт к конкурентам.',
      },
      {
        emoji: '🌪', title: 'Кризисы каждый месяц',
        text: 'Мир не ждёт: сорванная поставка, проверка, вставшие кассы приходят сами. Исход решает команда — тип × квалификация × должность × кризис: у каждого испытания свои функции и свои кресла. Справитесь — премия кассе и стоимости, провал — ущерб. Провал в одном кризисе — выигрыш в другом, и кризис гнёт даже линию идеала.',
      },
      {
        emoji: '🏛', title: 'Кабинет министров',
        text: 'Кризисы приносят реальные украинские министерства: у каждого кризиса — портфель-спонсор, а тип-версия министра добавляет кризису личный запрос. Разведка предупреждает заранее: отправьте сотрудника с подходящим типом на лоббистскую встречу — дуал министра договорится, конфликтник насорит. В середине года — политический сезон: возможны перестановки в Кабмине.',
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
              <li>🧬 Перед каждым назначением — анализ «до → после»: компетенции, соционика, сплочённость и стоимость сети.</li>
              <li>🚀 Карьерный рост: повышение рождает вакансию на старом кресле; нереагированный запрос — уход к конкурентам.</li>
              <li>🥇 Линия идеального управления: теневой управляющий играет те же условия без ошибок — его линия растёт на графике рядом с вашей.</li>
              <li>🦸 Раз в несколько месяцев на рынок может выйти суперуправленец — эталон во плоти, но в 1,45 раза дороже рынка.</li>
              <li>⏱ Автопилот закрывает месяцы сам: год проматывается за полминуты, пауза — чтобы думать.</li>
              <li>🌪 Кризисы приходят сами: исход = тип × квалификация × должность × кризис. Справились выше порога — премия, ниже — ущерб кассе и стоимости; кризис гнёт и линию идеала.</li>
              <li>🏛 Кабинет министров: кризисы приходят из реальных портфелей — следите за разведкой и лоббируйте встречи: тип сотрудника против тип-версии министра; в середине года возможны перестановки.</li>
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
            <a
              href="/puls-seti-demo.mp4"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            >
              🎬 Как играть — демо 2:03
            </a>
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
  const crisisMonths = game.history.filter((h) => h.crisis).map((h) => h.month)

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
    const finalCmp = idealCompare(game)
    const crisisLogs = game.history.map((h) => h.crisis).filter((c): c is CrisisLog => !!c)
    const crisisBest = crisisLogs.length > 0 ? crisisLogs.reduce((a, b) => (b.score > a.score ? b : a)) : null
    const crisisWorst = crisisLogs.length > 0 ? crisisLogs.reduce((a, b) => (b.score < a.score ? b : a)) : null
    const crisisCashSum = crisisLogs.reduce((a, c) => a + c.cashImpact, 0)
    const crisisValueSum = crisisLogs.reduce((a, c) => a + c.valueImpact, 0)
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
            {finalCmp && (
              <p className="mt-1 text-slate-500">
                🥇 от линии идеального управления: <b className={finalCmp.pct >= 100 ? 'text-amber-700' : 'text-slate-700'}>{finalCmp.pct}%</b>
              </p>
            )}
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
            <div className="flex gap-1.5 h-28">
              {game.history.map((h, i) => {
                const span = maxV - minV || 1
                const pct = 15 + 85 * ((h.value - minV) / span)
                const up = h.value >= game.startValue
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col justify-end"
                    title={`Месяц ${h.month}: ${fmtValue(h.value)} · ${DEMAND_MODES[h.demand].label}${h.crisis ? ` · 🌪 ${h.crisis.title}: ${h.crisis.score}%` : ''}`}
                  >
                    {h.crisis && <span className="mb-0.5 text-center text-[10px] leading-none">🌪</span>}
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

          {/* Кризисы года: что пережито и чем это обошлось */}
          {crisisLogs.length > 0 && (
            <section aria-label="Кризисы года" className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-800">🌪 Кризисы года: пережито {crisisLogs.length}</h2>
                <p className="text-sm text-slate-500">
                  средний балл{' '}
                  <b className="text-slate-700">{Math.round(crisisLogs.reduce((a, c) => a + c.score, 0) / crisisLogs.length)}%</b>
                  {' '}против идеала{' '}
                  <b className="text-slate-700">{Math.round(crisisLogs.reduce((a, c) => a + c.idealScore, 0) / crisisLogs.length)}%</b>
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-center">
                {crisisBest && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-xs text-emerald-700">Лучший кризис</p>
                    <p className="font-bold text-emerald-800"><span aria-hidden>{crisisBest.emoji}</span> {crisisBest.title}</p>
                    <p className="text-xs text-emerald-700">{crisisBest.score}% против {crisisBest.idealScore}% у идеала</p>
                  </div>
                )}
                {crisisWorst && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                    <p className="text-xs text-rose-700">Худший кризис</p>
                    <p className="font-bold text-rose-800"><span aria-hidden>{crisisWorst.emoji}</span> {crisisWorst.title}</p>
                    <p className="text-xs text-rose-700">{crisisWorst.score}% против {crisisWorst.idealScore}% у идеала</p>
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Последствия за год</p>
                  <p className={`font-bold ${crisisCashSum >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    касса {crisisCashSum >= 0 ? '+' : '−'}{fmtValue(Math.abs(crisisCashSum))}
                  </p>
                  <p className={`text-xs ${crisisValueSum >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    стоимость {crisisValueSum >= 0 ? '+' : '−'}{fmtValue(Math.abs(crisisValueSum))}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                У каждого кризиса свои функции и свои кресла: провал в первом — выигрыш во втором.
                Кризис гнул и линию идеала — смотрите отметки 🌪 на графике.
              </p>
            </section>
          )}

          {/* Линия идеального управления: итоговая дуэль с теневым управляющим */}
          {finalCmp && (
            <section aria-label="Линия идеального управления" className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-800">🥇 Линия идеального управления: вы против суперуправленца</h2>
                <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${idealChipClass(finalCmp.pct)}`}>
                  {finalCmp.pct >= 100 ? `🏅 ${finalCmp.pct}% — выше идеала` : `${finalCmp.pct}% от идеала`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 mb-1">
                теневой управляющий принял ту же сеть и прожил те же 12 месяцев условий — но только с верными ходами
              </p>
              <IdealLineChart line={finalCmp.line} height={190} crisisMonths={crisisMonths} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                <span><b className="text-emerald-700">— вы</b> · <b className="text-amber-700">- - идеал</b> · серый пунктир — цена при приёмке</span>
                <span>{finalCmp.pct >= 100 ? `преимущество ${fmtValue(-finalCmp.gap)}` : `отставание ${fmtValue(finalCmp.gap)}`}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{idealVerdict(finalCmp.pct, finalCmp.gap)}</p>
            </section>
          )}

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
              {game.promotionsDone > 0 && (
                <> · 🚀 карьерных повышений: <b className="text-slate-700">{game.promotionsDone}</b></>
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
                {pulse.parts.some((p) => p.label === 'Репутация кризисов') && (
                  <> · кризисы {signedMoney(pulse.parts.find((p) => p.label === 'Репутация кризисов')!.amount)}</>
                )}
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

        {/* Линия идеального управления: теневой управляющий против игрока */}
        {cmp && (
          <section aria-label="Линия идеального управления" className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">🥇 Линия идеального управления</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  Вы: <b className="text-emerald-700">{fmtValue(cmp.playerValue)}</b>
                  <span className="text-slate-300 mx-1.5">·</span>
                  Идеал: <b className="text-amber-700">{fmtValue(cmp.idealValue)}</b>
                </p>
              </div>
              <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${idealChipClass(cmp.pct)}`}>
                {cmp.pct >= 100 ? `🏅 ${cmp.pct}% — вы опережаете идеал!` : `${cmp.pct}% от линии идеала`}
              </span>
            </div>
            <IdealLineChart line={cmp.line} crisisMonths={crisisMonths} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span>
                <b className="text-emerald-700">— вы</b> · <b className="text-amber-700">- - идеал</b> · серый пунктир — цена при приёмке
              </span>
              <span>
                {cmp.pct >= 100 ? `преимущество ${fmtValue(-cmp.gap)}` : `отставание ${fmtValue(cmp.gap)}`}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Теневой суперуправленец принял ту же сеть «как есть» и играет те же месяцы без ошибок:
              те же спрос, рынок и скамейка — только верные ходы. Кризисы гнут и его линию: один и тот же кризис —
              сверяйте баллы в итогах месяца. Догоните линию, а удача иногда выносит и выше неё.
              {cmp.moves.length > 0 && <> В этом месяце идеал: {cmp.moves.join('; ')}.</>}
            </p>
          </section>
        )}

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

        {/* Профиль компании: компетентностный и соционический слепок сети */}
        {profile && (
          <details className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
            <summary className="cursor-pointer select-none font-semibold text-slate-800">
              🧬 Профиль компании — компетенции и соционика{' '}
              <b className={profile.avgFit >= 75 ? 'text-emerald-700' : profile.avgFit >= 55 ? 'text-amber-600' : 'text-rose-600'}>
                {profile.avgFit}%
              </b>{' '}средний итог
              <span className="ml-2 text-xs font-normal text-slate-400">нажмите, чтобы развернуть</span>
            </summary>
            <p className="mt-2 text-sm text-slate-500">
              Каждое назначение меняет профиль сети целиком. Средние по {profile.filled} занятым креслам:
              итог {profile.avgFit}% · профпригодность {profile.avgProf}% · соционика {profile.avgSoc}%.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Сильные функции команды (топ-2 модели А)
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profile.functions.map((f) => (
                <span
                  key={f.fn}
                  title={FUNCTIONS[f.fn].name}
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                    f.strong >= 2
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : f.strong === 1
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  {f.fn} · {f.strong}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Число — сколько сотрудников держат аспект в топ-2 функции. Кризисы спрашивают именно эти мышцы.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Квадры</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(profile.quadras) as QuadraId[]).map((q) => (
                <span key={q} className={`rounded-md border px-2 py-0.5 text-xs ${quadraChip(q)}`}>
                  {QUADRAS[q].name}: {profile.quadras[q]}
                </span>
              ))}
            </div>
            {profile.quadraImbalance && (
              <p className="mt-1 text-xs font-medium text-amber-700">⚖️ {profile.quadraImbalance}</p>
            )}
            {profile.duals.length > 0 && (
              <p className="mt-1 text-xs text-emerald-700">🤝 Дуальные пары: {profile.duals.join(', ')}</p>
            )}
            {profile.conflicts.length > 0 && (
              <p className="mt-1 text-xs text-rose-700">⚡ Конфликтные пары: {profile.conflicts.join(', ')}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">Сплочённость команды: {profile.cohesion}%.</p>
          </details>
        )}

        {/* Кабинет министров: политический слой кризисов (2.5) */}
        {game && (
          <details
            className={`rounded-2xl p-4 shadow-sm border mb-4 ${
              pendingMinister ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
            }`}
          >
            <summary className="cursor-pointer select-none font-semibold text-slate-800">
              🏛 Кабинет министров —{' '}
              {pendingMinister
                ? <span className="text-amber-700">⚡ разведка: {pendingMinister.name} готовит решение</span>
                : 'месяц без правительственных решений'}
              <span className="ml-2 text-xs font-normal text-slate-400">нажмите, чтобы развернуть</span>
            </summary>

            {/* Разведка месяца + лоббирование */}
            {pendingMinister && pendingCrisis ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-white p-3.5">
                <p className="text-sm text-slate-700">
                  Разведка: <b>{pendingMinister.name}</b> ({pendingMinister.role}) готовит решение по портфелю
                  «{portfolioTitle(pendingCrisis.sponsor)}» — тип-версия <b>{pendingMinister.typeRu}</b>{' '}
                  ({label(typeByRu(pendingMinister.typeRu), intl)}, {pendingMinister.note}).
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Возможное испытание: <b>{pendingCrisis.emoji} {pendingCrisis.title}</b>. Кресла:{' '}
                  {pendingCrisis.involved.map((id) => POSTS.find((p) => p.id === id)?.title ?? id).join(', ')}.
                  Запрос министра: <b>{ministerDemandBias(pendingMinister)}</b>{' '}
                  ({FUNCTIONS[ministerDemandBias(pendingMinister)].name}).
                </p>
                {!lobbyInfo ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <select
                      value={lobbyPick}
                      onChange={(e) => setLobbyPick(e.target.value)}
                      aria-label="Кого отправить на встречу с министром"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                    >
                      <option value="">— кого отправить на встречу —</option>
                      {staffOptions.map((o) => (
                        <option key={o.emp.ru} value={o.emp.ru}>
                          {o.emp.name} ({o.emp.ru}) · «{o.lb.kind}» {o.lb.bonus >= 0 ? '+' : ''}{o.lb.bonus}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!lobbyPick || game.cash < LOBBY_COST}
                      onClick={() => lobbyPick && doLobby(lobbyPick)}
                      className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      🤝 Назначить встречу (−{fmtMoney(LOBBY_COST)})
                    </button>
                    {lobbyPickScore && (
                      <span className={`text-xs ${lobbyPickScore.bonus > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        «{lobbyPickScore.kind}» → {lobbyPickScore.bonus >= 0 ? '+' : ''}{lobbyPickScore.bonus} к решению кризиса
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-medium text-sky-800">
                      🤝 Встреча назначена: {lobbyCand ? `${lobbyCand.name} (${lobbyCand.ru})` : '—'} →{' '}
                      {lobbyMinister?.name ?? '—'}
                      {lobbyScore ? ` · «${lobbyScore.kind}» ${lobbyScore.bonus >= 0 ? '+' : ''}${lobbyScore.bonus}` : ''}
                    </span>
                    <button
                      onClick={doCancelLobby}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Отменить (вернуть {fmtMoney(lobbyInfo.cost)})
                    </button>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  Встреча сработает, только если кризис придёт из этого портфеля. Отношения лоббиста с тип-версией
                  министра решают всё: дуал добавит до +15, конфликтник отнимет 5. Одна встреча в месяц.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                🌤 Разведка спит: Кабмин не готовит решений по сети — можно спокойно копить силы.
              </p>
            )}

            {/* Действующий кабинет */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Действующий кабинет (утверждён Радой 16.07.2026)
            </p>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {cabinetMinisters.map((m) => (
                <article
                  key={m.id}
                  className={`rounded-xl border p-3 ${
                    pendingMinister?.id === m.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="font-semibold text-slate-800">{m.name}</p>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                      {m.typeRu} · {label(typeByRu(m.typeRu), intl)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{m.role}</p>
                  <p className="text-xs text-slate-400">{m.note}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.bio}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Портфель «{portfolioTitle(m.portfolio ?? '')}» · кризисы:{' '}
                    {crisesOfPortfolio(m.portfolio ?? '').map((c) => `${c.emoji} ${c.title}`).join(' · ') || '—'}
                  </p>
                </article>
              ))}
            </div>

            {/* Президент: фон политического поля */}
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="font-semibold text-slate-800">{CABINET_PRESIDENT.name}</p>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {CABINET_PRESIDENT.typeRu} · {label(typeByRu(CABINET_PRESIDENT.typeRu), intl)}
                </span>
              </div>
              <p className="text-xs text-slate-500">{CABINET_PRESIDENT.role}</p>
              <p className="text-xs text-slate-400">{CABINET_PRESIDENT.note}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{CABINET_PRESIDENT.bio}</p>
            </div>

            {/* Политическая погода: проверяемые факты */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Политическая погода — факты (ноябрь 2026)
            </p>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-500">
              <li>• Кабмин июля 2026: после отставки правительства Свыриденко премьером стал Сергей Корецкий.</li>
              <li>• Военное положение продлено до 29.01.2027 (21-е продление): выборы не назначены — возможны после его отмены.</li>
              <li>• Опрос «Рейтинга» (октябрь 2026): в первом туре президентских выборов лидируют Зеленский и Залужный.</li>
              <li>• Месяц {RESHUFFLE_MONTH} — политический сезон: с шансом 55% портфели уходят политикам из альтернативного пула.</li>
            </ul>

            {/* Возможные конфигурации: альтернативный пул */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Возможные конфигурации: альтернативный пул
            </p>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {CABINET_ALTERNATIVES.map((m) => (
                <article key={m.id} className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="font-semibold text-slate-800">{m.name}</p>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                      {m.typeRu} · {label(typeByRu(m.typeRu), intl)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{m.role}</p>
                  <p className="text-xs text-slate-400">{m.note}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.bio}</p>
                </article>
              ))}
            </div>

            {/* Журнал перестановок */}
            {game.gov.changes.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Журнал Кабмина</p>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-500">
                  {game.gov.changes.map((ch, i) => (
                    <li key={i}>• {ch}</li>
                  ))}
                </ul>
              </>
            )}

            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Персонажи — реальные публичные политики; досье собраны из открытых источников (июль—октябрь 2026).
              Соционические типы — версии: для части фигур есть типирования сообщества (typuvannia.info,
              социофорумы), остальные — авторские игровые версии. Игровые эффекты — условность симуляции,
              а не характеристика или оценка реальных людей.
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

        {/* Карьерный рост: активный запрос сотрудника */}
        {promoReq && promoCand && promoFromPost && (
          <section aria-label="Карьерный рост" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-sky-900">🚀 Карьерный рост: {promoCand.name} ({promoCand.ru})</h2>
              <span className="rounded-lg border border-sky-400 bg-white px-3 py-1 text-xs font-bold text-sky-800">
                уйдёт к конкурентам через {promoMonthsLeft} мес
              </span>
            </div>
            <p className="mt-1 text-sm text-sky-900">
              Сейчас — «{promoFromPost.title}» (итог {overallFit(promoCand, promoFromPost)}%).
              {promoWantedPost && <> Просит «{promoWantedPost.title}» (там итог {overallFit(promoCand, promoWantedPost)}%).</>}
              {' '}Повышение освободит старое кресло — вакансия родится из карьерного роста; отказ — потеря человека насовсем.
            </p>
            <select
              aria-label={`Куда повысить ${promoCand.name}`}
              value={promoTarget}
              onChange={(e) => {
                // Начали решать — автопилот встаёт на паузу
                if (e.target.value && speed !== 0) setSpeed(0)
                setPromoTarget(e.target.value)
              }}
              className="mt-2 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">— куда повысить? —</option>
              {POSTS.filter((p) => p.id !== promoFromPost.id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.title} · {game.slots[p.id].ru ? 'замена' : 'вакансия'} · итог {overallFit(promoCand, p)}%
                </option>
              ))}
            </select>
            {promoPv && promoReq && (
              <AssignmentPreviewCard
                pv={promoPv}
                confirmLabel="🚀 Повысить →"
                onConfirm={() => doPromote(promoReq.ru, promoTarget)}
              />
            )}
          </section>
        )}

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
            // Анализ ДО назначения: рейтинги, деньги и изменение профиля компании
            const pv: AssignmentPreview | null = selPost ? assignPreview(game, c.ru, selPost.id) : null
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
                {selPost && pv && (
                  <AssignmentPreviewCard
                    pv={pv}
                    confirmLabel="Предложить работу →"
                    onConfirm={() => doHire(c.ru, pv.post.id)}
                  />
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
            </div>
            {lastLog.crisis && <CrisisCard c={lastLog.crisis} month={lastLog.month} intl={intl} />}
            <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
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
                aria-label={`Автопилот: ${s.title}`}
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

/**
 * Карточка кризиса месяца: что случилось, как справилась команда
 * против теневого идеала, кто вытянул и кто просел — сводка после
 * каждого испытания.
 */
function CrisisCard({ c, month, intl }: { c: CrisisLog; month: number; intl: boolean }) {
  const scoreClass =
    c.score >= 80 ? 'text-emerald-700' : c.score >= CRISIS_BASELINE ? 'text-slate-800' : c.score >= 45 ? 'text-amber-600' : 'text-rose-600'
  const pulled = c.contributions.slice(0, 2)
  const worst = c.contributions.length >= 2 ? c.contributions[c.contributions.length - 1] : null
  return (
    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-800">
          <span aria-hidden>{c.emoji}</span> {c.title}
          <span className="ml-2 text-xs font-normal text-slate-400">
            кризис месяца {month}{c.sponsorName ? ` · решение: ${c.sponsorName}` : ''}
          </span>
        </p>
        <span className="flex items-center gap-2 text-sm">
          <b className={scoreClass}>вы: {c.score}%</b>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">идеал: {c.idealScore}%</span>
        </span>
      </div>
      <p className="mt-1.5 text-sm text-slate-600">{c.narrative}</p>
      {c.lobbyBonus ? (
        <p className={`mt-0.5 text-sm ${c.lobbyBonus > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
          🤝 Лоббист: {c.lobbyBonus > 0 ? '+' : ''}{c.lobbyBonus} к решению · отношения «{c.lobbyKind}»
        </p>
      ) : null}
      <p className="mt-1.5 text-sm">
        <span className={c.cashImpact >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
          💵 касса {c.cashImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(c.cashImpact))}
        </span>
        <span className="text-slate-300 mx-2">·</span>
        <span className={c.valueImpact >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
          📈 стоимость {c.valueImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(c.valueImpact))}
        </span>
      </p>
      {pulled.length > 0 && (
        <p className="mt-1.5 text-sm text-slate-600">
          💪 Вытянули: {pulled.map((k) => `${k.postTitle} — ${label(k.type, intl)} (${k.fn} ${Math.round(k.fnWeight / 10)}/10)`).join(' · ')}
        </p>
      )}
      {worst && (
        <p className="mt-0.5 text-sm text-slate-500">
          😓 Просел: {worst.postTitle} — {label(worst.type, intl)} ({worst.fn} {Math.round(worst.fnWeight / 10)}/10, проф {worst.prof}%)
        </p>
      )}
      {c.score < CRISIS_BASELINE && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          У каждого кризиса свой набор функций и кресел: провал здесь — ещё не приговор,
          а шанс для других людей. Смотрите, какие роли требовались, и усиливайте эти кресла —
          следующий кризис потребует другого.
        </p>
      )}
    </div>
  )
}

function quadraChip(q: QuadraId): string {
  const c = QUADRA_COLORS[q]
  return `${c.fill} ${c.text} border-slate-200`
}

const QUADRA_LABEL: Record<QuadraId, string> = {
  alpha: 'Альфа', beta: 'Бета', gamma: 'Гамма', delta: 'Дельта',
}

/** Квадры: только изменившиеся, строкой «Гамма 2→3» */
function quadraDeltaText(before: Record<QuadraId, number>, after: Record<QuadraId, number>): string[] {
  return (Object.keys(before) as QuadraId[])
    .filter((q) => before[q] !== after[q])
    .map((q) => `${QUADRA_LABEL[q]} ${before[q]}→${after[q]}`)
}

/**
 * Анализ назначения ДО хода: рейтинги кандидата против эталона,
 * деньги хода — и как изменится профиль компании: стоимость,
 * сплочённость, ФОТ, квадры, сильные функции, связи с коллегами.
 */
function AssignmentPreviewCard({ pv, confirmLabel, onConfirm }: {
  pv: AssignmentPreview
  confirmLabel: string
  onConfirm: () => void
}) {
  const valueDelta = pv.valueAfter - pv.valueBefore
  const quadraChanges = quadraDeltaText(pv.quadrasBefore, pv.quadrasAfter)
  const socParts: string[] = []
  if (quadraChanges.length > 0) socParts.push(`Квадры: ${quadraChanges.join(', ')}`)
  if (pv.fnChanges.length > 0) {
    socParts.push(`Сильные функции: ${pv.fnChanges.map((f) => `${f.fn} ${f.before}→${f.after}`).join(', ')}`)
  }
  const tense = pv.relations.filter((r) => r.tense).slice(0, 3)
  const friendly = pv.relations
    .filter((r) => !r.tense && (r.kind === 'дуальность' || r.kind === 'активация' || r.kind === 'деловые'))
    .slice(0, 2)
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex flex-wrap items-center gap-x-2 rounded-lg border px-2.5 py-1 ${fitBadgeClass(pv.fit)}`}>
          <b>{fitStars(pv.fit)}</b>
          <span>итог {pv.fit}%</span>
          <span className="text-xs opacity-70">проф {pv.prof}% · соционика {pv.soc}%</span>
        </span>
        <span className="text-xs text-slate-500">
          эталон кресла: {pv.idealFit}% · совпадение <b className="text-slate-700">{pv.pctOfIdeal}%</b>
        </span>
      </div>

      {/* Профиль компании: до → после */}
      <div className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
        <p className="text-slate-600">
          💰 Стоимость: {fmtValue(pv.valueBefore)} →{' '}
          <b className={valueDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{fmtValue(pv.valueAfter)}</b>{' '}
          ({signedMoney(valueDelta)})
        </p>
        <p className="text-slate-600">
          🤝 Сплочённость: {pv.cohesionBefore}% →{' '}
          <b className={pv.cohesionAfter >= pv.cohesionBefore ? 'text-emerald-700' : 'text-rose-600'}>{pv.cohesionAfter}%</b>
        </p>
        <p className="text-slate-600">📊 Средний итог штата: {pv.avgFitBefore}% → {pv.avgFitAfter}%</p>
        <p className="text-slate-600">💼 ФОТ: {fmtMoney(pv.payrollBefore)} → {fmtMoney(pv.payrollAfter)}/мес</p>
      </div>

      {/* Деньги хода */}
      {pv.promotion ? (
        <p className="mt-1.5 text-slate-600">
          🚀 Внутренний переход — подъёмных нет · новый оклад: <b>{fmtMoney(pv.salaryAfter)}/мес</b>
          {pv.severance > 0 && <> · секверанс снятому: <b>{fmtMoney(pv.severance)}</b></>}
        </p>
      ) : (
        <p className="mt-1.5 text-slate-600">
          Подъёмные: <b>{fmtMoney(pv.bonus)}</b>
          {pv.severance > 0 && <> · секверанс: <b>{fmtMoney(pv.severance)}</b></>}
          {' '}· всего из кассы: <b className="text-slate-800">{fmtMoney(pv.total)}</b>
        </p>
      )}
      {pv.displaced && (
        <p className="mt-1 text-xs text-slate-500">
          Кресло займёт место {pv.displaced.name} — выплачивается секверанс {SEVERANCE_MONTHS} оклада
        </p>
      )}
      {pv.freeingPost && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          ⚠️ Освободится «{pv.freeingPost.title}» — там начнётся простой: вакансия рождается и из повышения
        </p>
      )}

      {/* Соционический профиль: до → после */}
      {socParts.length > 0 ? (
        <p className="mt-1 text-slate-600">🧬 {socParts.join(' · ')}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">
          🧬 Соционический профиль сети не изменится: квадры и сильные функции те же
        </p>
      )}
      {tense.length > 0 ? (
        <p className="mt-1 text-rose-700">
          ⚡ Напряжённые связи: {tense.map((r) => `${r.kind} — ${r.name} (${r.postTitle})`).join(' · ')}
        </p>
      ) : (
        <p className="mt-1 text-xs text-emerald-700">⚡ Конфликтных связей с будущими коллегами нет</p>
      )}
      {friendly.length > 0 && (
        <p className="mt-0.5 text-xs text-emerald-700">
          🤝 Сильные союзы: {friendly.map((r) => `${r.kind} — ${r.name} (${r.postTitle})`).join(' · ')}
        </p>
      )}

      {pv.ok ? (
        <button
          onClick={onConfirm}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {confirmLabel}
        </button>
      ) : (
        <p className="mt-2 text-sm font-medium text-rose-600">{pv.reason}</p>
      )}
    </div>
  )
}

/**
 * График «Линия идеального управления»: зелёная линия — компания игрока,
 * золотой пунктир — теневой идеальный управляющий в тех же условиях,
 * серая горизонталь — цена сети на момент приёмки.
 */
function IdealLineChart({ line, height = 140, crisisMonths = [] }: { line: IdealLinePoint[]; height?: number; crisisMonths?: number[] }) {
  const W = 640
  const PL = 10
  const PR = 10
  const PT = 12
  const PB = 20
  const all = line.flatMap((p) => [p.player, p.ideal])
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const x = (i: number) => (line.length > 1 ? PL + (W - PL - PR) * (i / (line.length - 1)) : PL)
  const y = (v: number) => PT + (height - PT - PB) * (1 - (v - min) / span)
  const path = (key: 'player' | 'ideal') =>
    line.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const last = line[line.length - 1]
  const ahead = last.player >= last.ideal
  const monthIndex = new Map(line.map((p, i) => [p.month, i]))
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="mt-3 mx-auto w-full max-w-3xl h-auto"
      role="img"
      aria-label="График: ваша стоимость против линии идеального управления"
    >
      {/* горизонталь приёмки: всё, что выше — рост, что ниже — потеря */}
      <line
        x1={PL} x2={W - PR} y1={y(line[0].player)} y2={y(line[0].player)}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 4"
      />
      {/* кризисы: розовые вертикали месяцев с испытанием */}
      {crisisMonths.map((m) => {
        const i = monthIndex.get(m)
        return i === undefined ? null : (
          <line
            key={m} x1={x(i)} x2={x(i)} y1={PT} y2={height - PB}
            stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 3" opacity="0.4"
          />
        )
      })}
      <path d={path('ideal')} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path('player')} fill="none" stroke="#047857" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(line.length - 1)} cy={y(last.ideal)} r="3.5" fill="#d97706" />
      <circle cx={x(line.length - 1)} cy={y(last.player)} r="4" fill="#047857" />
      {/* подписи последней точки */}
      <text
        x={Math.min(x(line.length - 1) + 6, W - 120)} y={y(last.ideal) - 5}
        fontSize="11" fill="#b45309"
      >
        идеал {fmtValue(last.ideal)}
      </text>
      <text
        x={Math.min(x(line.length - 1) + 6, W - 120)}
        y={ahead ? y(last.player) + 14 : y(last.player) - 5}
        fontSize="11" fontWeight="bold" fill="#047857"
      >
        вы {fmtValue(last.player)}
      </text>
      {/* месяцы */}
      {line.map((p, i) => (
        <text key={p.month} x={x(i)} y={height - 6} fontSize="10" fill="#94a3b8" textAnchor="middle">
          {p.month}
        </text>
      ))}
    </svg>
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
