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
// Интерфейс двуязычный: украинский по умолчанию, русский —
// переключателем <LangSwitch /> в шапке.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useL, useBi, useLang, LangSwitch, type Bi, useTitle } from '@/lib/i18n'
import { TYPES, QUADRAS, ukAbbr, type QuadraId } from '@/lib/socionics-data'
import { QUADRA_COLORS, RELATION_LABEL } from '@/lib/relations'
import { typeByRu, label } from '@/lib/socionics-quiz'
import {
  POSTS, MARKET_MODES, PAYROLL_BUDGET,
  fitStars, profFit, postFit, overallFit,
  payroll, cohesion, fmtMoney, fmtValue, VACANCY_VALUE_PENALTY,
  normalizeCandidate, DEMAND_MODES, LIVE_MONTHS, EDUCATIONS,
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
  { ms: 0, label: '⏸', title: { uk: 'Пауза: думаємо без поспіху', ru: 'Пауза: думаем без спешки' } },
  { ms: 8000, label: '🐢', title: { uk: 'Повільно: місяць кожні 8 секунд', ru: 'Медленно: месяц каждые 8 секунд' } },
  { ms: 4000, label: '▶', title: { uk: 'Середньо: місяць кожні 4 секунди', ru: 'Средне: месяц каждые 4 секунды' } },
  { ms: 1500, label: '⏩', title: { uk: 'Швидко: місяць кожні 1,5 секунди', ru: 'Быстро: месяц каждые 1,5 секунды' } },
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

type Picker = (uk: string, ru: string) => string

/** Вердикт финала: чем игрок закончил против линии идеала */
function idealVerdict(pct: number, gap: number, L: Picker): string {
  if (pct >= 100) return L(
    `🏅 Випередили лінію ідеалу на ${fmtValue(-gap)}: випадковості світу були на вашому боці. Таке вдається небагатьом.`,
    `🏅 Вы обогнали линию идеала на ${fmtValue(-gap)}: случайности мира были на вашей стороне. Такое удаётся немногим.`)
  if (pct >= 90) return L(
    `Майже наздогнали ідеал: відставання лише ${fmtValue(gap)}. Ще пара правильних рішень — і лінія ваша.`,
    `Вы почти догнали идеал: отставание всего ${fmtValue(gap)}. Ещё пара верных решений — и линия ваша.`)
  if (pct >= 75) return L(
    `Міцна гра, але ідеал у тих самих умовах упорався на ${fmtValue(gap)} краще — подивіться, де лінії розійшлися.`,
    `Крепкая игра, но идеал в тех же условиях управил на ${fmtValue(gap)} лучше — посмотрите, где линии разошлись.`)
  return L(
    `Ідеал у тих самих умовах устиг на ${fmtValue(gap)} більше. Порівняйте лінії за місяцями: там, де вони розійшлися, і сидять ваші гроші.`,
    `Идеал в тех же условиях успел на ${fmtValue(gap)} больше. Сравните линии по месяцам: там, где они разошлись, и сидят ваши деньги.`)
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
  // Ходы идеала: нові збереження зберігають Bi, старі — рядки (лишаємо як є)
  const moves = Array.isArray(i.moves)
    ? i.moves.flatMap((m): Bi[] => {
        if (m && typeof m === 'object' && typeof (m as Bi).uk === 'string' && typeof (m as Bi).ru === 'string') return [m as Bi]
        if (typeof m === 'string' && m) return [{ uk: m, ru: m }]
        return []
      })
    : []
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
    ? g.changes.flatMap((x): Bi[] => {
        if (x && typeof x === 'object' && typeof (x as Bi).uk === 'string' && typeof (x as Bi).ru === 'string') return [x as Bi]
        if (typeof x === 'string' && x) return [{ uk: x, ru: x }]
        return []
      })
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
  useTitle('«Браво» — соціонічний симулятор торгової мережі', '«Браво» — соционический симулятор торговой сети')

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

  // Двомовний шар: українська за замовчуванням, російська — перемикачем
  const lang = useLang()
  const L = useL()
  const B = useBi()
  /** Скорочення мовою інтерфейсу: ИЛЭ → ІЛЕ в українській версії */
  const K = (s: string) => (lang === 'uk' ? ukAbbr(s) : s)
  /** Гроші поточною мовою */
  const M = (n: number): string => fmtMoney(n, lang)
  /** Текст події: нові збереження — Bi, старі — рядки */
  const txt = (t: Bi | string): string => (typeof t === 'string' ? t : B(t))
  /** Освітній рядок резюме за ключем довідника */
  const eduText = (e: string): string => {
    const found = EDUCATIONS.find((x) => x.text === e)
    return found ? B(found.label) : e
  }

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
        emoji: '🏚', title: L('Компанія як є', 'Компания как есть'),
        text: L('Штат — чуже надбання: сильні професіонали, середняки, слабкі (когось ще й переплачують) та пусті крісла зі стажем простою.', 'Штат — чужое наследие: сильные профессионалы, середняки, слабые (кого-то ещё и переоплачивают) и пустые кресла со стажем простоя.'),
      },
      {
        emoji: '⚖️', title: L('Ресурсів не вистачає', 'Ресурсов не хватает'),
        text: L('Каса скінченна, сильні кандидати дорогі, ідеальних людей на ринку немає. Задовольнити всі критерії одразу неможливо — обирайте, що горить сильніше.', 'Касса конечна, сильные кандидаты дороги, идеальных людей на рынке нет. Удовлетворить все критерии сразу невозможно — выбирать, что горит сильнее.'),
      },
      {
        emoji: '⏳', title: L('Прокрастинація коштує грошей', 'Прокрастинация стоит денег'),
        text: L('Кандидати йдуть у кінці місяця. Пусте крісло капає касі щомісяця і все дорожче — тягнути не можна.', 'Кандидаты уходят в конце месяца. Пустое кресло капает кассе каждый месяц и всё дороже — тянуть нельзя.'),
      },
      {
        emoji: '💰', title: L('Рахунок — вартість компанії', 'Счёт — стоимость компании'),
        text: L('Кожне рішення видно в гривнях одразу: слабкий керівник, сварки в команді та простій б\'ють по ціні мережі. Рекорд — зростання за рік.', 'Каждое решение видно в гривнах сразу: слабый руководитель, ссоры в команде и простой бьют по цене сети. Рекорд — рост за год.'),
      },
      {
        emoji: '🦸', title: L('Еталон: суперкерівник', 'Эталон: суперуправленец'),
        text: L('У кожної посади є еталон — найсильніший тип, 20 років у професії та MBA (панель «🎯 Еталон»). Іноді на ринок виходить живий еталон — суперкерівник: коштує в 1,45 раза дорожче за ринок, але тягне команду до мрії.', 'У каждой должности есть эталон — сильнейший тип, 20 лет в профессии и MBA (панель «🎯 Эталон»). Иногда на рынок выходит живой эталон — суперуправленец: стоит в 1,45 раза дороже рынка, но тянет команду к мечте.'),
      },
      {
        emoji: '🥇', title: L('Лінія ідеального керування', 'Линия идеального управления'),
        text: L('Поруч із вами грає тіньовий суперкерівник: прийняв ту саму мережу і живе в тих самих умовах, але ходить без помилок. Його лінія на графіку — ваша ціль; наздоженете її, а якщо пощастить — випередите!', 'Рядом с вами играет теневой суперуправленец: принял ту же сеть и живёт в тех же условиях, но ходит без ошибок. Его линия на графике — ваша цель; догоните её, а если повезёт — обгоните!'),
      },
      {
        emoji: '🧬', title: L('Профіль компанії та аналіз призначення', 'Профиль компании и анализ назначения'),
        text: L('Кожне призначення змінює і компетентнісний, і соціонічний профіль мережі. Перед ходом — аналіз «до → після»: сильні функції, квадри, згуртованість і вартість у гривнях, плюс збіг кандидата з еталоном крісла.', 'Каждое назначение меняет и компетентностный, и соционический профиль сети. Перед ходом — анализ «до → после»: сильные функции, квадры, сплочённость и стоимость в гривнах, плюс совпадение кандидата с эталоном кресла.'),
      },
      {
        emoji: '🚀', title: L('Кар\'єрне зростання', 'Карьерный рост'),
        text: L('Сильні люди зростають: співробітник може попросити більше крісло. Підвищите — його старе крісло спорожніє: вакансія народжується і з підвищення! Проігноруєте два місяці — людина піде до конкурентів.', 'Сильные люди растут: сотрудник может попросить большее кресло. Повысите — его старое кресло опустеет: вакансия рождается и из повышения! Проигнорируете два месяца — человек уйдёт к конкурентам.'),
      },
      {
        emoji: '🌪', title: L('Кризи щомісяця', 'Кризисы каждый месяц'),
        text: L('Світ не чекає: зірвана поставка, перевірка, сталі каси приходять самі. Вихід вирішує команда — тип × кваліфікація × посада × криза: у кожного випробування свої функції і свої крісла. Впораєтеся — премія касі та вартості, провал — збиток. Провал в одній кризі — виграш в іншій, і криза гне навіть лінію ідеала.', 'Мир не ждёт: сорванная поставка, проверка, вставшие кассы приходят сами. Исход решает команда — тип × квалификация × должность × кризис: у каждого испытания свои функции и свои кресла. Справитесь — премия кассе и стоимости, провал — ущерб. Провал в одном кризисе — выигрыш в другом, и кризис гнёт даже линию идеала.'),
      },
      {
        emoji: '🏛', title: L('Кабінет міністрів', 'Кабинет министров'),
        text: L('Кризи приносять реальні українські міністерства: у кожної кризи — портфель-спонсор, а тип-версія міністра додає кризі особистий запит. Розвідка попереджає заздалегідь: відправте співробітника з відповідним типом на лобістську зустріч — дуал міністра домовиться, конфліктник насорить. У середині року — політичний сезон: можливі перестановки в Кабміні.', 'Кризисы приносят реальные украинские министерства: у каждого кризиса — портфель-спонсор, а тип-версия министра добавляет кризису личный запрос. Разведка предупреждает заранее: отправьте сотрудника с подходящим типом на лоббистскую встречу — дуал министра договорится, конфликтник насорит. В середине года — политический сезон: возможны перестановки в Кабмине.'),
      },
      {
        emoji: '⏱', title: L('Швидкість моделювання', 'Скорость моделирования'),
        text: L('Не чекайте місяць за місяцем на кнопку: увімкніть автопілот 🐢/▶/⏩ — місяці закриються самі. Пауза — щоб думати; вибір кандидата ставить автопілот на паузу.', 'Не ждите месяц за месяцем по кнопке: включите автопилот 🐢/▶/⏩ — месяцы закроются сами. Пауза — чтобы думать; выбор кандидата ставит автопилот на паузу.'),
      },
    ]
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                {L('🛒 Мережа магазинів «Браво»', '🛒 Сеть магазинов «Браво»')}
              </h1>
              <p className="text-slate-500 mt-1 text-sm sm:text-base">
                {L(`Сценарій «Компанія як є»: живий менеджмент на ${LIVE_MONTHS} місяців`, `Сценарий «Компания как есть»: живой менеджмент на ${LIVE_MONTHS} месяцев`)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {intlBtn}
              <LangSwitch />
            </div>
          </header>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <p className="text-sm sm:text-base text-slate-600">
              {L('Ви приймаєте мережу з чотирьох магазинів', 'Вы принимаете сеть из четырёх магазинов')} <b>{L('у поточному стані', 'в текущем состоянии')}</b>{L(': частина крісел зайнята', ': часть кресел занята')}{' '}
              {L('сильними професіоналами, частина — випадковими людьми, пара посад пустує.', 'сильными профессионалами, часть — случайными людьми, пара должностей пустует.')}
              {' '}{L('Наймаємо як і раніше як раціональний роботодавець:', 'Нанимаем по-прежнему как рациональный работодатель:')} <b>{L('спочатку компетентність і досвід', 'сначала компетентность и опыт')}</b>
              {' '}{L('(65% підсумкового рейтингу), потім психологія (35%). Але тепер час іде: ринок праці', '(65% итогового рейтинга), потом психология (35%). Но теперь время идёт: рынок труда')}
              {' '}{L('і попит покупців змінюються щомісяця —', 'и спрос покупателей меняются каждый месяц, а решения приходится принимать')}
              {' '}{L('далі рішення доводиться ухвалювати в умовах, коли', 'в условиях, когда')} <b>{L('грошей вистачає не на все', 'денег хватает не на всё')}</b>.
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
            <h2 className="font-semibold text-slate-800 mb-2">{L('Правила за 30 секунд', 'Правила за 30 секунд')}</h2>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li>📅 <b>{L(`${LIVE_MONTHS} місяців`, `${LIVE_MONTHS} месяцев`)}</b> — {L('місяць закривається кнопкою «Закрити місяць» або автопілотом на обраній швидкості.', 'месяц закрывается кнопкой «Закрыть месяц» или автопилотом на выбранной скорости.')}</li>
              <li>🧑‍💼 {L('Кандидати приходять на ринок праці й', 'Кандидаты приходят на рынок труда и')} <b>{L('йдуть у кінці місяця', 'уходят в конце месяца')}</b> — {L('рішення не можна відкладати назавжди.', 'решение нельзя откладывать навсегда.')}</li>
              <li>💼 {L('Приймання на роботу коштує', 'Приём на работу стоит')} <b>{L(`підйомних (${SIGNING_BONUS_MONTHS} оклад)`, `подъёмных (${SIGNING_BONUS_MONTHS} оклад)`)}</b>, {L('звільнення —', 'увольнение —')} <b>{L(`секверансу (${SEVERANCE_MONTHS} оклади)`, `секверанса (${SEVERANCE_MONTHS} оклада)`)}</b>; {L('все платиться з каси.', 'всё платится из кассы.')}</li>
              <li>🕳 {L('Пусте крісло', 'Пустое кресло')} <b>{L('капає щомісяця', 'капает каждый месяц')}</b>: {L('штраф касі зростає з часом простою, а вартість компанії втрачає', 'штраф кассе растёт со временем простоя, а стоимость компании теряет')} {fmtValue(VACANCY_VALUE_PENALTY)} {L('за кожну вакансію.', 'за каждую вакансию.')}</li>
              <li>🌤 {L('Кон\'юнктура гуляє: попит покупців і ринок праці змінюються щомісяця — виручка те зростає, те просідає.', 'Конъюнктура гуляет: спрос покупателей и рынок труда меняются каждый месяц — выручка то растёт, то проседает.')}</li>
              <li>🎯 {L('У кожної посади є еталон — порівнюйте штат з ідеалом у панелі «Еталон».', 'У каждой должности есть эталон — сравнивайте штат с идеалом в панели «Эталон».')}</li>
              <li>🧬 {L('Перед кожним призначенням — аналіз «до → після»: компетенції, соціоніка, згуртованість і вартість мережі.', 'Перед каждым назначением — анализ «до → после»: компетенции, соционика, сплочённость и стоимость сети.')}</li>
              <li>🚀 {L('Кар\'єрне зростання: підвищення народжує вакансію на старому кріслі; проігнорований запит — відхід до конкурентів.', 'Карьерный рост: повышение рождает вакансию на старом кресле; нереагированный запрос — уход к конкурентам.')}</li>
              <li>🥇 {L('Лінія ідеального керування: тіньовий керуючий грає ті самі умови без помилок — його лінія зростає на графіку поруч із вашою.', 'Линия идеального управления: теневой управляющий играет те же условия без ошибок — его линия растёт на графике рядом с вашей.')}</li>
              <li>🦸 {L('Раз на кілька місяців на ринок може вийти суперкерівник — еталон у плоті, але в 1,45 раза дорожчий за ринок.', 'Раз в несколько месяцев на рынок может выйти суперуправленец — эталон во плоти, но в 1,45 раза дороже рынка.')}</li>
              <li>⏱ {L('Автопілот закриває місяці сам: рік промотується за півхвилини, пауза — щоб думати.', 'Автопилот закрывает месяцы сам: год проматывается за полминуты, пауза — чтобы думать.')}</li>
              <li>🌪 {L('Кризи приходять самі: вихід = тип × кваліфікація × посада × криза. Впоралися вище порога — премія, нижче — збиток касі та вартості; криза гне й лінію ідеала.', 'Кризисы приходят сами: исход = тип × квалификация × должность × кризис. Справились выше порога — премия, ниже — ущерб кассе и стоимости; кризис гнёт и линию идеала.')}</li>
              <li>🏛 {L('Кабінет міністрів: кризи приходять із реальних портфелів — стежте за розвідкою та лобіюйте зустрічі: тип співробітника проти тип-версії міністра; у середині року можливі перестановки.', 'Кабинет министров: кризисы приходят из реальных портфелей — следите за разведкой и лоббируйте встречи: тип сотрудника против тип-версии министра; в середине года возможны перестановки.')}</li>
              <li>🏆 {L('Фінал: скільки мільйонів гривень ви додали до вартості мережі — це ваш рахунок і рекорд.', 'Финал: сколько миллионов гривен вы добавили к стоимости сети — это ваш счёт и рекорд.')}</li>
            </ul>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={acceptCompany}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow hover:bg-emerald-500"
            >
              {L('🏢 Прийняти мережу', '🏢 Принять сеть')}
            </button>
            <a
              href="/puls-seti-demo.mp4"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            >
              {L('🎬 Як грати — демо 2:03', '🎬 Как играть — демо 2:03')}
            </a>
            {best && (
              <span className="text-sm text-slate-500">
                {L('Рекорд сценарію:', 'Рекорд сценария:')} <b>{fmtValue(best.value)}</b>{' '}
                ({best.growth >= 0 ? '+' : '−'}{fmtValue(Math.abs(best.growth))} {L('за рік', 'за год')})
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
          <div className="mb-6 flex items-start justify-between gap-3">
            <span />
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{L('🏁 Рік завершено — звіт власнику', '🏁 Год закончен — отчёт владельцу')}</h1>
              {isNewBest && (
                <p className="mt-1 inline-block rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-sm font-semibold text-amber-700">
                  {L('🏆 Новий рекорд сценарію!', '🏆 Новый рекорд сценария!')}
                </p>
              )}
            </div>
            <LangSwitch />
          </div>

          <section className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 text-center mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L('Вартість компанії', 'Стоимость компании')}</p>
            <p className="mt-1 text-4xl sm:text-5xl font-black text-slate-800">{fmtValue(finalValue)}</p>
            <p className={`mt-2 text-xl font-bold ${growth >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {signedMoney(growth)} {L('за рік', 'за год')}
            </p>
            <p className="mt-1 text-slate-500">
              <b className="text-slate-700">{B(grade.word)}</b> — {B(grade.note)}
            </p>
            {finalCmp && (
              <p className="mt-1 text-slate-500">
                🥇 {L('від лінії ідеального керування:', 'от линии идеального управления:')} <b className={finalCmp.pct >= 100 ? 'text-amber-700' : 'text-slate-700'}>{finalCmp.pct}%</b>
              </p>
            )}
            {best && (
              <p className="mt-2 text-sm text-slate-400">
                {L('Рекорд сценарію:', 'Рекорд сценария:')} {fmtValue(best.value)} ({best.growth >= 0 ? '+' : '−'}{fmtValue(Math.abs(best.growth))})
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <h2 className="font-semibold text-slate-800 mb-1">{L('Історія року: вартість за місяцями', 'История года: стоимость по месяцам')}</h2>
            <p className="text-xs text-slate-400 mb-3">
              {L('стовпчики вище лінії старту — компанія дорожчає, нижче — дешевшає', 'столбики выше линии старта — компания дорожает, ниже — дешевеет')}
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
                    title={L(`Місяць ${h.month}: ${fmtValue(h.value)} · ${B(DEMAND_MODES[h.demand].label)}${h.crisis ? ` · 🌪 ${txt(h.crisis.title)}: ${h.crisis.score}%` : ''}`, `Месяц ${h.month}: ${fmtValue(h.value)} · ${B(DEMAND_MODES[h.demand].label)}${h.crisis ? ` · 🌪 ${txt(h.crisis.title)}: ${h.crisis.score}%` : ''}`)}
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
            <section aria-label={L('Кризи року', 'Кризисы года')} className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-800">{L(`🌪 Кризи року: пережито ${crisisLogs.length}`, `🌪 Кризисы года: пережито ${crisisLogs.length}`)}</h2>
                <p className="text-sm text-slate-500">
                  {L('середній бал', 'средний балл')}{' '}
                  <b className="text-slate-700">{Math.round(crisisLogs.reduce((a, c) => a + c.score, 0) / crisisLogs.length)}%</b>
                  {' '}{L('проти ідеалу', 'против идеала')}{' '}
                  <b className="text-slate-700">{Math.round(crisisLogs.reduce((a, c) => a + c.idealScore, 0) / crisisLogs.length)}%</b>
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-center">
                {crisisBest && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-xs text-emerald-700">{L('Найкраща криза', 'Лучший кризис')}</p>
                    <p className="font-bold text-emerald-800"><span aria-hidden>{crisisBest.emoji}</span> {txt(crisisBest.title)}</p>
                    <p className="text-xs text-emerald-700">{crisisBest.score}% {L('проти', 'против')} {crisisBest.idealScore}% {L('в ідеала', 'у идеала')}</p>
                  </div>
                )}
                {crisisWorst && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                    <p className="text-xs text-rose-700">{L('Найгірша криза', 'Худший кризис')}</p>
                    <p className="font-bold text-rose-800"><span aria-hidden>{crisisWorst.emoji}</span> {txt(crisisWorst.title)}</p>
                    <p className="text-xs text-rose-700">{crisisWorst.score}% {L('проти', 'против')} {crisisWorst.idealScore}% {L('в ідеала', 'у идеала')}</p>
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{L('Наслідки за рік', 'Последствия за год')}</p>
                  <p className={`font-bold ${crisisCashSum >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {L('каса', 'касса')} {crisisCashSum >= 0 ? '+' : '−'}{fmtValue(Math.abs(crisisCashSum))}
                  </p>
                  <p className={`text-xs ${crisisValueSum >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {L('вартість', 'стоимость')} {crisisValueSum >= 0 ? '+' : '−'}{fmtValue(Math.abs(crisisValueSum))}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {L('У кожної кризи свої функції і свої крісла: провал у першій — виграш у другій.', 'У каждого кризиса свои функции и свои кресла: провал в первом — выигрыш во втором.')}
                {' '}{L('Криза гнула й лінію ідеала — дивіться позначки 🌪 на графіку.', 'Кризис гнул и линию идеала — смотрите отметки 🌪 на графике.')}
              </p>
            </section>
          )}

          {/* Линия идеального управления: итоговая дуэль с теневым управляющим */}
          {finalCmp && (
            <section aria-label={L('Лінія ідеального керування', 'Линия идеального управления')} className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-800">{L('🥇 Лінія ідеального керування: ви проти суперкерівника', '🥇 Линия идеального управления: вы против суперуправленца')}</h2>
                <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${idealChipClass(finalCmp.pct)}`}>
                  {finalCmp.pct >= 100 ? L(`🏅 ${finalCmp.pct}% — вище ідеалу`, `🏅 ${finalCmp.pct}% — выше идеала`) : L(`${finalCmp.pct}% від ідеалу`, `${finalCmp.pct}% от идеала`)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 mb-1">
                {L('тіньовий керуючий прийняв ту саму мережу і прожив ті самі 12 місяців умов — але тільки з правильними ходами', 'теневой управляющий принял ту же сеть и прожил те же 12 месяцев условий — но только с верными ходами')}
              </p>
              <IdealLineChart line={finalCmp.line} height={190} crisisMonths={crisisMonths} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                <span><b className="text-emerald-700">{L('— ви', '— вы')}</b> · <b className="text-amber-700">{L('- - ідеал', '- - идеал')}</b> · {L('сірий пунктир — ціна на момент приймання', 'серый пунктир — цена при приёмке')}</span>
                <span>{finalCmp.pct >= 100 ? L(`перевага ${fmtValue(-finalCmp.gap)}`, `преимущество ${fmtValue(-finalCmp.gap)}`) : L(`відставання ${fmtValue(finalCmp.gap)}`, `отставание ${fmtValue(finalCmp.gap)}`)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{idealVerdict(finalCmp.pct, finalCmp.gap, L)}</p>
            </section>
          )}

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <h2 className="font-semibold text-slate-800 mb-3">{L('Куди витікали гроші за рік', 'Куда утекали деньги за год')}</h2>
            <div className="grid gap-3 sm:grid-cols-4 text-center">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs text-emerald-700">{L('Виручка', 'Выручка')}</p>
                <p className="font-bold text-emerald-800">+{fmtValue(totalRevenue)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700">{L('ФОТ', 'ФОТ')}</p>
                <p className="font-bold text-rose-800">−{fmtValue(totalPayroll)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700">{L('Операційні', 'Операционные')}</p>
                <p className="font-bold text-rose-800">−{fmtValue(totalOpex)}</p>
              </div>
              <div className={`rounded-xl border p-3 ${totalFine > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs text-slate-500">{L('Протої вакансій', 'Простои вакансий')}</p>
                <p className={`font-bold ${totalFine > 0 ? 'text-rose-800' : 'text-slate-600'}`}>
                  {totalFine > 0 ? `−${fmtValue(totalFine)}` : '0 грн'}
                </p>
              </div>
            </div>
          </section>

          <section aria-label={L('Розбивка вартості компанії', 'Разбивка стоимости компании')} className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-800">{L('💹 Пульс мережі — з чого склалася ціна', '💹 Пульс сети — из чего сложилась цена')}</h2>
              <p className="text-2xl font-black text-slate-800">{fmtValue(pulse.total)}</p>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {pulse.parts.map((part) => (
                <li key={part.label.ru} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="text-slate-600">
                    {B(part.label)}
                    {part.hint && <span className="text-slate-400"> · {B(part.hint)}</span>}
                  </span>
                  <b className={part.label.ru === 'База сети' ? 'text-slate-800' : part.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    {part.label.ru === 'База сети' ? fmtValue(part.amount) : signedMoney(part.amount)}
                  </b>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 mb-6">
            <h2 className="font-semibold text-slate-800 mb-3">{L('Склад команди на кінець року', 'Состав команды на конец года')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">{L('Посада', 'Должность')}</th>
                    <th className="py-2 pr-3 font-medium">{L('Людина', 'Человек')}</th>
                    <th className="py-2 pr-3 font-medium">{L('Зарплата', 'Зарплата')}</th>
                    <th className="py-2 pr-3 font-medium">{L('Підсумок', 'Итог')}</th>
                    <th className="py-2 font-medium">{L('Внесок у вартість', 'Вклад в стоимость')}</th>
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
                        <td className="py-2 pr-3 text-slate-700">{p.emoji} {B(p.title)}</td>
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {emp && t ? `${txt(emp.name)} · ${label(t, intl, lang)}` : L('— вакансія —', '— вакансия —')}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{emp ? `${M(emp.salary)}/${L('міс', 'мес')}` : '—'}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {emp ? `${fitStars(fit)} ${fit}% (${L('проф', 'проф')} ${profFit(emp, p)} · ${L('соц', 'соц')} ${t ? postFit(t, p) : 0})` : '—'}
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
              🎯 {L('Команда до еталона:', 'Команда к эталону:')} <b className="text-slate-700">{idealFinal.avgPct}%</b>
              {starsHired > 0 && (
                <> · 🦸 {L('суперкерівників у штаті:', 'суперуправленцев в штате:')} <b className="text-slate-700">{starsHired}</b></>
              )}
              {game.promotionsDone > 0 && (
                <> · 🚀 {L('кар\'єрних підвищень:', 'карьерных повышений:')} <b className="text-slate-700">{game.promotionsDone}</b></>
              )}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center pb-2">
            <button
              onClick={() => setPhase('manage')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              {L('← Переглянути штат', '← Посмотреть штат')}
            </button>
            <button
              onClick={acceptCompany}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-emerald-500"
            >
              {L('🔄 Нова гра', '🔄 Новая компания')}
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
              {L(`🏪 Штаб мережі — місяць ${game.month} з ${LIVE_MONTHS}`, `🏪 Штаб сети — месяц ${game.month} из ${LIVE_MONTHS}`)}
            </h1>
            <p className="text-sm text-slate-500">
              {L('Сценарій «Компанія як є» · рішення можна ухвалювати в будь-який момент місяця', 'Сценарий «Компания как есть» · решения можно принимать в любой момент месяца')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {intlBtn}
            <LangSwitch />
            <button
              onClick={() => {
                if (confirm(L('Почати нову компанію? Поточний прогрес зітреться.', 'Начать новую компанию? Текущий прогресс сотрётся.'))) acceptCompany()
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {L('🔄 Нова гра', '🔄 Новая компания')}
            </button>
          </div>
        </header>

        {/* Конъюнктура месяца */}
        <section className="grid gap-3 sm:grid-cols-3 mb-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200" title={B(DEMAND_MODES[game.demand].hint)}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L('Попит покупців', 'Спрос покупателей')}</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              <span aria-hidden>{DEMAND_MODES[game.demand].emoji}</span> {B(DEMAND_MODES[game.demand].label)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{B(DEMAND_MODES[game.demand].hint)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200" title={B(MARKET_MODES[game.labor].hint)}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L('Ринок праці', 'Рынок труда')}</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              <span aria-hidden>{MARKET_MODES[game.labor].emoji}</span> {B(MARKET_MODES[game.labor].label)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{B(MARKET_MODES[game.labor].hint)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L('💵 Каса', '💵 Касса')}</p>
            <p className="mt-0.5 font-semibold text-slate-800">{M(game.cash)}</p>
            <p className="text-xs text-slate-400 mt-1">{L('з неї платяться підйомні, секверанси і простій', 'подъёмные, секверансы и простой платятся из неё')}</p>
          </div>
        </section>

        {/* Пульс сети */}
        <section aria-label={L('Пульс мережі: вартість компанії', 'Пульс сети: стоимость компании')} className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L('💹 Пульс мережі — вартість компанії', '💹 Пульс сети — стоимость компании')}</p>
              <p className="mt-0.5 text-3xl sm:text-4xl font-black text-slate-800">{fmtValue(pulse.total)}</p>
              <p className={`mt-1 text-sm font-semibold ${growthNow >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {L('з приймання:', 'с приёмки:')} {signedMoney(growthNow)}
                <span className="font-normal text-slate-400"> ({L('прийняли за', 'приняли за')} {fmtValue(game.startValue)})</span>
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                {L('команда', 'команда')} {signedMoney(pulse.teamCapital)} · {L('психологія', 'психология')} {signedMoney(pulse.combo)}
                {pulse.vacancyPenalty < 0 && <> · {L('вакансії', 'вакансии')} {signedMoney(pulse.vacancyPenalty)}</>}
                {pulse.payrollPenalty < 0 && <> · ФОТ {signedMoney(pulse.payrollPenalty)}</>}
                {pulse.parts.some((p) => p.label.ru === 'Репутация кризисов') && (
                  <> · {L('кризи', 'кризисы')} {signedMoney(pulse.parts.find((p) => p.label.ru === 'Репутация кризисов')!.amount)}</>
                )}
              </p>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-slate-600">{L('Очікувана виручка місяця:', 'Ожидаемая выручка месяца:')} <b className="text-slate-800">{M(rev)}</b></p>
              <p className="text-slate-600">
                {L('ФОТ:', 'ФОТ:')} <b className={payrollOver > 0 ? 'text-rose-600' : 'text-slate-800'}>{M(pay)}</b>
                <span className="text-slate-400"> {L('з', 'из')} {fmtMoney(PAYROLL_BUDGET, lang)}</span>
                {payrollOver > 0 && <span className="text-rose-600"> (+{payrollOver}%)</span>}
              </p>
              <p className="text-slate-600">
                {L('Простій вакансій:', 'Простой вакансий:')} <b className={fine > 0 ? 'text-rose-600' : 'text-slate-800'}>{fine > 0 ? `−${M(fine)}/${L('міс', 'мес')}` : '—'}</b>
              </p>
              <p className="text-slate-600">{L('Згуртованість:', 'Сплочённость:')} <b className="text-slate-800">{coh}%</b></p>
            </div>
          </div>
        </section>

        {/* Линия идеального управления: теневой управляющий против игрока */}
        {cmp && (
          <section aria-label={L('Лінія ідеального керування', 'Линия идеального управления')} className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{L('🥇 Лінія ідеального керування', '🥇 Линия идеального управления')}</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {L('Ви:', 'Вы:')} <b className="text-emerald-700">{fmtValue(cmp.playerValue)}</b>
                  <span className="text-slate-300 mx-1.5">·</span>
                  {L('Ідеал:', 'Идеал:')} <b className="text-amber-700">{fmtValue(cmp.idealValue)}</b>
                </p>
              </div>
              <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${idealChipClass(cmp.pct)}`}>
                {cmp.pct >= 100 ? L(`🏅 ${cmp.pct}% — ви випереджаєте ідеал!`, `🏅 ${cmp.pct}% — вы опережаете идеал!`) : L(`${cmp.pct}% від лінії ідеалу`, `${cmp.pct}% от линии идеала`)}
              </span>
            </div>
            <IdealLineChart line={cmp.line} crisisMonths={crisisMonths} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span>
                <b className="text-emerald-700">{L('— ви', '— вы')}</b> · <b className="text-amber-700">{L('- - ідеал', '- - идеал')}</b> · {L('сірий пунктир — ціна на момент приймання', 'серый пунктир — цена при приёмке')}
              </span>
              <span>
                {cmp.pct >= 100 ? L(`перевага ${fmtValue(-cmp.gap)}`, `преимущество ${fmtValue(-cmp.gap)}`) : L(`відставання ${fmtValue(cmp.gap)}`, `отставание ${fmtValue(cmp.gap)}`)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {L('Тіньовий суперкерівник прийняв ту саму мережу «як є» і грає ті самі місяці без помилок:', 'Теневой суперуправленец принял ту же сеть «как есть» и играет те же месяцы без ошибок:')}
              {' '}{L('ті самі попит, ринок і лавка — тільки правильні ходи. Кризи гнуть і його лінію: та сама криза —', 'те же спрос, рынок и скамейка — только верные ходы. Кризисы гнут и его линию: один и тот же кризис —')}
              {' '}{L('звіряйте бали в підсумках місяця. Наздоженете лінію, а удача іноді виносить і вище неї.', 'сверяйте баллы в итогах месяца. Догоните линию, а удача иногда выносит и выше неё.')}
              {cmp.moves.length > 0 && <> {L('Цього місяця ідеал:', 'В этом месяце идеал:')} {cmp.moves.map((m) => txt(m)).join('; ')}.</>}
            </p>
          </section>
        )}

        {/* Эталон: команда мечты — сравнение штата с идеалом */}
        {idealInfo && (
          <details className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
            <summary className="cursor-pointer select-none font-semibold text-slate-800">
              {L('🎯 Еталон: команда мрії — ваш штат', '🎯 Эталон: команда мечты — ваш штат')}{' '}
              <b className={idealInfo.avgPct >= 75 ? 'text-emerald-700' : idealInfo.avgPct >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                {idealInfo.avgPct}%
              </b>{' '}{L('від ідеалу', 'от идеала')}
              <span className="ml-2 text-xs font-normal text-slate-400">{L('натисніть, щоб розгорнути', 'нажмите, чтобы развернуть')}</span>
            </summary>
            <p className="mt-2 text-sm text-slate-500">
              {L('Еталон посади — найсильніший соціонічний тип, 20 років у своїй сфері та MBA.', 'Эталон должности — сильнейший соционический тип, 20 лет в своей сфере и MBA.')}
              {' '}{L('Раз на кілька місяців на ринок може вийти «живий еталон» — 🦸 суперкерівник:', 'Раз в несколько месяцев на рынок может выйти «живой эталон» — 🦸 суперуправленец:')}
              {' '}{L('бере в 1,45 раза дорожче за ринок, але тягне штат до мрії.', 'берёт в 1,45 раза дороже рынка, но тянет штат к мечте.')}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">{L('Посада', 'Должность')}</th>
                    <th className="py-2 pr-3 font-medium">{L('Еталон', 'Эталон')}</th>
                    <th className="py-2 pr-3 font-medium">{L('Еталон коштує', 'Эталон стоит')}</th>
                    <th className="py-2 pr-3 font-medium">{L('У вас зараз', 'У вас сейчас')}</th>
                    <th className="py-2 font-medium">{L('% від еталона', '% от эталона')}</th>
                  </tr>
                </thead>
                <tbody>
                  {idealInfo.rows.map((row) => {
                    const s = game.slots[row.post.id]
                    const ru = s?.ru ?? null
                    const emp = ru ? game.roster.find((c) => c.ru === ru) ?? null : null
                    return (
                      <tr key={row.post.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-700">{row.post.emoji} {B(row.post.title)}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {row.idealType} · {fitStars(row.idealFit)} {row.idealFit}%
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{M(row.idealSalary)}/{L('міс', 'мес')}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {emp ? `${fitStars(row.curFit)} ${row.curFit}%` : L('— вакансія —', '— вакансия —')}
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
              {L('ФОТ мрії:', 'ФОТ мечты:')} <b>{M(idealInfo.idealPayroll)}/{L('міс', 'мес')}</b> ({L('у вас зараз', 'у вас сейчас')} {M(pay)}) —
              {' '}{L('навіть до ідеала доводиться йти з оглядкою на бюджет.', 'даже к идеалу приходится идти с оглядкой на бюджет.')}
            </p>
          </details>
        )}

        {/* Профиль компании: компетентностный и соционический слепок сети */}
        {profile && (
          <details className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mb-4">
            <summary className="cursor-pointer select-none font-semibold text-slate-800">
              {L('🧬 Профіль компанії — компетенції та соціоніка', '🧬 Профиль компании — компетенции и соционика')}{' '}
              <b className={profile.avgFit >= 75 ? 'text-emerald-700' : profile.avgFit >= 55 ? 'text-amber-600' : 'text-rose-600'}>
                {profile.avgFit}%
              </b>{' '}{L('середній підсумок', 'средний итог')}
              <span className="ml-2 text-xs font-normal text-slate-400">{L('натисніть, щоб розгорнути', 'нажмите, чтобы развернуть')}</span>
            </summary>
            <p className="mt-2 text-sm text-slate-500">
              {L('Кожне призначення змінює профіль мережі ціліком. Середні по', 'Каждое назначение меняет профиль сети целиком. Средние по')} {profile.filled} {L('зайнятим кріслам:', 'занятым креслам:')}
              {' '}{L('підсумок', 'итог')} {profile.avgFit}% · {L('профпридатність', 'профпригодность')} {profile.avgProf}% · {L('соціоніка', 'соционика')} {profile.avgSoc}%.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {L('Сильні функції команди (топ-2 моделі А)', 'Сильные функции команды (топ-2 модели А)')}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profile.functions.map((f) => (
                <span
                  key={f.fn}
                  title={B(FUNCTIONS[f.fn].name)}
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                    f.strong >= 2
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : f.strong === 1
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  {K(f.fn)} · {f.strong}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {L('Число — скільки співробітників тримають аспект у топ-2 функції. Кризи питають саме ці м\'язи.', 'Число — сколько сотрудников держат аспект в топ-2 функции. Кризисы спрашивают именно эти мышцы.')}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{L('Квадри', 'Квадры')}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(profile.quadras) as QuadraId[]).map((q) => (
                <span key={q} className={`rounded-md border px-2 py-0.5 text-xs ${quadraChip(q)}`}>
                  {B(QUADRAS[q].name)}: {profile.quadras[q]}
                </span>
              ))}
            </div>
            {profile.quadraImbalance && (
              <p className="mt-1 text-xs font-medium text-amber-700">⚖️ {B(profile.quadraImbalance)}</p>
            )}
            {profile.duals.length > 0 && (
              <p className="mt-1 text-xs text-emerald-700">🤝 {L('Дуальні пари:', 'Дуальные пары:')} {profile.duals.join(', ')}</p>
            )}
            {profile.conflicts.length > 0 && (
              <p className="mt-1 text-xs text-rose-700">⚡ {L('Конфліктні пари:', 'Конфликтные пары:')} {profile.conflicts.join(', ')}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">{L('Згуртованість команди:', 'Сплочённость команды:')} {profile.cohesion}%.</p>
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
              {L('🏛 Кабінет міністрів —', '🏛 Кабинет министров —')}{' '}
              {pendingMinister
                ? <span className="text-amber-700">⚡ {L('розвідка:', 'разведка:')} {B(pendingMinister.name)} {L('готує рішення', 'готовит решение')}</span>
                : L('місяць без урядових рішень', 'месяц без правительственных решений')}
              <span className="ml-2 text-xs font-normal text-slate-400">{L('натисніть, щоб розгорнути', 'нажмите, чтобы развернуть')}</span>
            </summary>

            {/* Разведка месяца + лоббирование */}
            {pendingMinister && pendingCrisis ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-white p-3.5">
                <p className="text-sm text-slate-700">
                  {L('Розвідка:', 'Разведка:')} <b>{B(pendingMinister.name)}</b> ({B(pendingMinister.role)}) {L('готує рішення за портфелем', 'готовит решение по портфелю')}
                  {' '}«{B(portfolioTitle(pendingCrisis.sponsor))}» — {L('тип-версія', 'тип-версия')} <b>{K(pendingMinister.typeRu)}</b>{' '}
                  ({intl ? typeByRu(pendingMinister.typeRu).intlName : B(typeByRu(pendingMinister.typeRu).name)}, {B(pendingMinister.note)}).
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {L('Можливе випробування:', 'Возможное испытание:')} <b>{pendingCrisis.emoji} {B(pendingCrisis.title)}</b>. {L('Крісла:', 'Кресла:')}{' '}
                  {pendingCrisis.involved.map((id) => POSTS.find((p) => p.id === id)?.title ? B(POSTS.find((p) => p.id === id)!.title) : id).join(', ')}.
                  {' '}{L('Запит міністра:', 'Запрос министра:')} <b>{ministerDemandBias(pendingMinister)}</b>{' '}
                  ({B(FUNCTIONS[ministerDemandBias(pendingMinister)].name)}).
                </p>
                {!lobbyInfo ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <select
                      value={lobbyPick}
                      onChange={(e) => setLobbyPick(e.target.value)}
                      aria-label={L('Кого відправити на зустріч із міністром', 'Кого отправить на встречу с министром')}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                    >
                      <option value="">{L('— кого відправити на зустріч —', '— кого отправить на встречу —')}</option>
                      {staffOptions.map((o) => (
                        <option key={o.emp.ru} value={o.emp.ru}>
                          {txt(o.emp.name)} ({o.emp.ru}) · «{B(RELATION_LABEL[o.lb.kind])}» {o.lb.bonus >= 0 ? '+' : ''}{o.lb.bonus}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!lobbyPick || game.cash < LOBBY_COST}
                      onClick={() => lobbyPick && doLobby(lobbyPick)}
                      className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {L(`🤝 Призначити зустріч (−${M(LOBBY_COST)})`, `🤝 Назначить встречу (−${M(LOBBY_COST)})`)}
                    </button>
                    {lobbyPickScore && (
                      <span className={`text-xs ${lobbyPickScore.bonus > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        «{B(RELATION_LABEL[lobbyPickScore.kind])}» → {lobbyPickScore.bonus >= 0 ? '+' : ''}{lobbyPickScore.bonus} {L('до рішення кризи', 'к решению кризиса')}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-medium text-sky-800">
                      🤝 {L('Зустріч призначена:', 'Встреча назначена:')} {lobbyCand ? `${txt(lobbyCand.name)} (${lobbyCand.ru})` : '—'} →{' '}
                      {lobbyMinister ? B(lobbyMinister.name) : '—'}
                      {lobbyScore ? ` · «${B(RELATION_LABEL[lobbyScore.kind])}» ${lobbyScore.bonus >= 0 ? '+' : ''}${lobbyScore.bonus}` : ''}
                    </span>
                    <button
                      onClick={doCancelLobby}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {L(`Скасувати (повернути ${M(lobbyInfo.cost)})`, `Отменить (вернуть ${M(lobbyInfo.cost)})`)}
                    </button>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  {L('Зустріч спрацює, тільки якщо криза прийде з цього портфеля. Стосунки лобіста з тип-версією', 'Встреча сработает, только если кризис придёт из этого портфеля. Отношения лоббиста с тип-версией')}
                  {' '}{L('міністра вирішують все: дуал додасть до +15, конфліктник відніме 5. Одна зустріч на місяць.', 'министра решают всё: дуал добавит до +15, конфликтник отнимет 5. Одна встреча в месяц.')}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {L('🌤 Розвідка спить: Кабмін не готує рішень по мережі — можна спокійно накопичувати сили.', '🌤 Разведка спит: Кабмин не готовит решений по сети — можно спокойно копить силы.')}
              </p>
            )}

            {/* Действующий кабинет */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {L('Чинний кабінет (затверджений Радою 16.07.2026)', 'Действующий кабинет (утверждён Радой 16.07.2026)')}
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
                    <p className="font-semibold text-slate-800">{B(m.name)}</p>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                      {K(m.typeRu)} · {intl ? typeByRu(m.typeRu).intlName : B(typeByRu(m.typeRu).name)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{B(m.role)}</p>
                  <p className="text-xs text-slate-400">{B(m.note)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{B(m.bio)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {L('Портфель', 'Портфель')} «{B(portfolioTitle(m.portfolio ?? ''))}» · {L('кризи:', 'кризисы:')}{' '}
                    {crisesOfPortfolio(m.portfolio ?? '').map((c) => `${c.emoji} ${B(c.title)}`).join(' · ') || '—'}
                  </p>
                </article>
              ))}
            </div>

            {/* Президент: фон политического поля */}
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="font-semibold text-slate-800">{B(CABINET_PRESIDENT.name)}</p>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {K(CABINET_PRESIDENT.typeRu)} · {intl ? typeByRu(CABINET_PRESIDENT.typeRu).intlName : B(typeByRu(CABINET_PRESIDENT.typeRu).name)}
                </span>
              </div>
              <p className="text-xs text-slate-500">{B(CABINET_PRESIDENT.role)}</p>
              <p className="text-xs text-slate-400">{B(CABINET_PRESIDENT.note)}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{B(CABINET_PRESIDENT.bio)}</p>
            </div>

            {/* Политическая погода: проверяемые факты */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {L('Політична погода — факти (листопад 2026)', 'Политическая погода — факты (ноябрь 2026)')}
            </p>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-500">
              <li>{L('• Кабмін липня 2026: після відставки уряду Свириденко прем\'єром став Сергій Корецкий.', '• Кабмин июля 2026: после отставки правительства Свыриденко премьером стал Сергей Корецкий.')}</li>
              <li>{L('• Воєнний стан продовжено до 29.01.2027 (21-ше продовження): вибори не призначені — можливі після його скасування.', '• Военное положение продлено до 29.01.2027 (21-е продление): выборы не назначены — возможны после его отмены.')}</li>
              <li>{L('• Опитування «Рейтингу» (жовтень 2026): у першому турі президентських виборів лідирують Зеленський і Залужний.', '• Опрос «Рейтинга» (октябрь 2026): в первом туре президентских выборов лидируют Зеленский и Залужный.')}</li>
              <li>{L(`• Місяць ${RESHUFFLE_MONTH} — політичний сезон: із шансом 55% портфелі відходять політикам з альтернативного пулу.`, `• Месяц ${RESHUFFLE_MONTH} — политический сезон: с шансом 55% портфели уходят политикам из альтернативного пула.`)}</li>
            </ul>

            {/* Возможные конфигурации: альтернативный пул */}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {L('Можливі конфігурації: альтернативний пул', 'Возможные конфигурации: альтернативный пул')}
            </p>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {CABINET_ALTERNATIVES.map((m) => (
                <article key={m.id} className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="font-semibold text-slate-800">{B(m.name)}</p>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                      {K(m.typeRu)} · {intl ? typeByRu(m.typeRu).intlName : B(typeByRu(m.typeRu).name)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{B(m.role)}</p>
                  <p className="text-xs text-slate-400">{B(m.note)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{B(m.bio)}</p>
                </article>
              ))}
            </div>

            {/* Журнал перестановок */}
            {game.gov.changes.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{L('Журнал Кабміну', 'Журнал Кабмина')}</p>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-500">
                  {game.gov.changes.map((ch, i) => (
                    <li key={i}>• {txt(ch)}</li>
                  ))}
                </ul>
              </>
            )}

            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              {L('Персонажі — реальні публічні політики; досьє зібрані з відкритих джерел (липень—жовтень 2026).', 'Персонажи — реальные публичные политики; досье собраны из открытых источников (июль—октябрь 2026).')}
              {' '}{L('Соціонічні типи — версії: для частини постатей є типування спільноти (typuvannia.info,', 'Соционические типы — версии: для части фигур есть типирования сообщества (typuvannia.info,')}
              {' '}{L('соціофоруми), решта — авторські ігрові версії. Ігрові ефекти — умовність симуляції,', 'социофорумы), остальные — авторские игровые версии. Игровые эффекты — условность симуляции,')}
              {' '}{L('а не характеристика чи оцінка реальних людей.', 'а не характеристика или оценка реальных людей.')}
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
            {txt(note.text)}
          </div>
        )}

        {/* Штат сети */}
        <h2 className="font-semibold text-slate-800 mb-3 px-1">{L(`Штат мережі (${filled}/${POSTS.length})`, `Штат сети (${filled}/${POSTS.length})`)}</h2>
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
                    <span aria-hidden>{post.emoji}</span> {B(post.title)}
                  </h3>
                  <p className="mt-1 font-bold text-rose-600">{L('— ВАКАНСІЯ —', '— ВАКАНСИЯ —')}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {L('Простій:', 'Простой:')} <b>{s?.vacantMonths ?? 0} {L('міс', 'мес')}</b> · {L('касі', 'кассе')}{' '}
                    <b className="text-rose-600">−{M(vacancyFineFor(s?.vacantMonths ?? 0))}/{L('міс', 'мес')}</b>
                  </p>
                  <p className="text-sm text-slate-600">
                    {L('Вартості компанії:', 'Стоимости компании:')} <b className="text-rose-500">{signedMoney(-VACANCY_VALUE_PENALTY)}</b>
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {L('Кандидатів шукайте на ринку праці нижче — вони йдуть у кінці місяця', 'Кандидатов ищите на рынке труда ниже — они уходят в конце месяца')}
                  </p>
                </article>
              )
            }
            const foundField = POSTS.find((f) => f.id === emp.profession)?.field
            return (
              <article key={post.id} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 text-base sm:text-lg">
                  <span aria-hidden>{post.emoji}</span> {B(post.title)}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <p className="font-medium text-slate-800">{txt(emp.name)}</p>
                  <span className={`rounded-md px-2 py-0.5 text-xs border ${quadraChip(t.quadra)}`}>
                    {label(t, intl, lang)}
                  </span>
                  {emp.super && (
                    <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">
                      🦸 {L('еталон', 'эталон')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{txt(emp.tagline)}</p>
                <p className="text-sm text-slate-600 mt-2">
                  {foundField ? B(foundField) : emp.profession} · {L('стаж', 'стаж')} {emp.years} {L('років', 'лет')} · {eduText(emp.education)}
                </p>
                <p className="text-sm text-slate-600">
                  {L('Зарплата:', 'Зарплата:')} <b>{M(emp.salary)}/{L('міс', 'мес')}</b>
                  <span className="text-slate-400"> · «{txt(emp.achievement)}»</span>
                </p>
                <div className={`mt-2 inline-flex flex-wrap items-center gap-x-2 rounded-lg border px-2.5 py-1 text-sm ${fitBadgeClass(fit)}`}>
                  <b>{fitStars(fit)}</b>
                  <span>{L('підсумок', 'итог')} {fit}%</span>
                  <span className="text-xs opacity-70">{L('проф', 'проф')} {prof}% · {L('соціоніка', 'соционика')} {soc}%</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => doFire(post.id)}
                    title={L(`Виплата ${SEVERANCE_MONTHS} окладів: ${M(emp.salary * SEVERANCE_MONTHS)}`, `Выплата ${SEVERANCE_MONTHS} окладов: ${M(emp.salary * SEVERANCE_MONTHS)}`)}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    {L(`Звільнити (−${M(emp.salary * SEVERANCE_MONTHS)})`, `Уволить (−${M(emp.salary * SEVERANCE_MONTHS)})`)}
                  </button>
                  <span className="text-xs text-slate-400">{L('заміну шукайте на ринку праці', 'замену ищите на рынке труда')}</span>
                </div>
              </article>
            )
          })}
        </div>

        {/* Карьерный рост: активный запрос сотрудника */}
        {promoReq && promoCand && promoFromPost && (
          <section aria-label={L('Кар\'єрне зростання', 'Карьерный рост')} className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-sky-900">🚀 {L('Кар\'єрне зростання:', 'Карьерный рост:')} {txt(promoCand.name)} ({promoCand.ru})</h2>
              <span className="rounded-lg border border-sky-400 bg-white px-3 py-1 text-xs font-bold text-sky-800">
                {L(`піде до конкурентів через ${promoMonthsLeft} міс`, `уйдёт к конкурентам через ${promoMonthsLeft} мес`)}
              </span>
            </div>
            <p className="mt-1 text-sm text-sky-900">
              {L('Зараз —', 'Сейчас —')} «{B(promoFromPost.title)}» ({L('підсумок', 'итог')} {overallFit(promoCand, promoFromPost)}%).
              {promoWantedPost && <> {L('Просить', 'Просит')} «{B(promoWantedPost.title)}» ({L('там підсумок', 'там итог')} {overallFit(promoCand, promoWantedPost)}%).</>}
              {' '}{L('Підвищення звільнить старе крісло — вакансія народиться з кар\'єрного зростання; відмова — втрата людини назавжди.', 'Повышение освободит старое кресло — вакансия родится из карьерного роста; отказ — потеря человека насовсем.')}
            </p>
            <select
              aria-label={L(`Куди підвищити ${txt(promoCand.name)}`, `Куда повысить ${txt(promoCand.name)}`)}
              value={promoTarget}
              onChange={(e) => {
                // Начали решать — автопилот встаёт на паузу
                if (e.target.value && speed !== 0) setSpeed(0)
                setPromoTarget(e.target.value)
              }}
              className="mt-2 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">{L('— куди підвищити? —', '— куда повысить? —')}</option>
              {POSTS.filter((p) => p.id !== promoFromPost.id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {B(p.title)} · {game.slots[p.id].ru ? L('заміна', 'замена') : L('вакансія', 'вакансия')} · {L('підсумок', 'итог')} {overallFit(promoCand, p)}%
                </option>
              ))}
            </select>
            {promoPv && promoReq && (
              <AssignmentPreviewCard
                pv={promoPv}
                confirmLabel={L('🚀 Підвищити →', '🚀 Повысить →')}
                onConfirm={() => doPromote(promoReq.ru, promoTarget)}
              />
            )}
          </section>
        )}

        {/* Экстренная новость: на рынке суперуправленец */}
        {benchStar && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 mb-4" role="status">
            <p className="font-semibold text-amber-800">
              🦸 {L('Еталон на ринку:', 'Эталон на рынке:')} {txt(benchStar.name)} ({benchStar.ru}) {L('претендує на', 'претендует на')} «{B(POSTS.find((p) => p.id === benchStar.profession)?.title ?? { uk: '', ru: '' })}»
            </p>
            <p className="mt-1 text-sm text-amber-700">
              {L(`Просить ${M(benchStar.salary)}/${L('міс', 'мес')} — в 1,45 раза вище ринку. Кандидати йдуть у кінці місяця: суперкерівники не чекають.`, `Просит ${M(benchStar.salary)}/мес — в 1,45 раза выше рынка. Кандидаты уходят в конце месяца: суперуправленцы не ждут.`)}
            </p>
          </div>
        )}

        {/* Рынок труда месяца */}
        <h2 className="font-semibold text-slate-800 mb-1 px-1">{L(`🧑‍💼 Ринок праці (${game.bench.length})`, `🧑‍💼 Рынок труда (${game.bench.length})`)}</h2>
        <p className="text-sm text-slate-500 mb-3 px-1">
          {L('Ці люди підуть при закритті місяця. Оберіть посаду: вільну — або з заміною', 'Эти люди уйдут при закрытии месяца. Выберите должность: свободную — или с заменой')}
          {' '}{L('(доведеться заплатити і підйомні, і секверанс).', '(придётся заплатить и подъёмные, и секверанс).')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          {game.bench.map((ru) => {
            const c: Candidate | undefined = game.roster.find((x) => x.ru === ru)
            if (!c) return null
            const t = typeByRu(c.ru)
            const foundField = POSTS.find((p) => p.id === c.profession)?.field
            const selPost = sel && sel.ru === c.ru ? POSTS.find((p) => p.id === sel.postId) ?? null : null
            // Анализ ДО назначения: рейтинги, деньги и изменение профиля компании
            const pv: AssignmentPreview | null = selPost ? assignPreview(game, c.ru, selPost.id) : null
            return (
              <article key={ru} className={`rounded-2xl p-4 shadow-sm flex flex-col ${c.super ? 'bg-amber-50 border-2 border-amber-400' : 'bg-white border border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{txt(c.name)}</p>
                  <span className={`rounded-md px-2 py-0.5 text-xs border ${quadraChip(t.quadra)}`}>
                    {label(t, intl, lang)}
                  </span>
                  {c.super && (
                    <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">🦸 {L('ЕТАЛОН', 'ЭТАЛОН')}</span>
                  )}
                  <span className="text-xs text-slate-400">{c.age} {L('років', 'лет')}</span>
                </div>
                <p className="text-xs text-slate-500">{txt(c.tagline)}</p>
                {c.super && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    {L('Суперкерівник: резюме рівня еталона для', 'Суперуправленец: резюме уровня эталона для')} «{B(POSTS.find((p) => p.id === c.profession)?.title ?? { uk: '', ru: '' })}».
                    {' '}{L('Дорого, але таке буває раз на рік', 'Дорого, но такое бывает раз в год')}
                  </p>
                )}
                <p className="text-sm font-medium text-slate-700 mt-2">
                  {foundField ? B(foundField) : c.profession} · {L('стаж', 'стаж')} {c.years} {L('років', 'лет')}
                </p>
                <p className="text-xs text-slate-500">{L('Освіта:', 'Образование:')} {eduText(c.education)}</p>
                <p className="text-sm text-slate-600 mt-1.5">«{txt(c.achievement)}»</p>
                <p className="text-sm font-semibold text-emerald-700 mt-1.5">
                  {L('від', 'от')} {M(c.salary)}/{L('міс', 'мес')}
                </p>
                <select
                  aria-label={L(`Посада для ${txt(c.name)}`, `Должность для ${txt(c.name)}`)}
                  value={sel && sel.ru === c.ru ? sel.postId : ''}
                  onChange={(e) => {
                    const postId = e.target.value
                    // Начали решать — автопилот встаёт на паузу
                    if (postId && speed !== 0) setSpeed(0)
                    setSel(postId ? { ru: c.ru, postId } : null)
                  }}
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">{L('— куди визначити? —', '— куда определить? —')}</option>
                  {POSTS.map((p) => {
                    const occupied = !!game.slots[p.id].ru
                    return (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {B(p.title)} · {occupied ? L('заміна', 'замена') : L('вакансія', 'вакансия')}
                      </option>
                    )
                  })}
                </select>
                {selPost && pv && (
                  <AssignmentPreviewCard
                    pv={pv}
                    confirmLabel={L('Запропонувати роботу →', 'Предложить работу →')}
                    onConfirm={() => doHire(c.ru, pv.post.id)}
                  />
                )}
              </article>
            )
          })}
        </div>
        {game.bench.length === 0 && (
          <p className="text-sm text-slate-400 mb-5 px-1">{L('На ринку нікого немає — закривайте місяць, прийдуть нові люди.', 'На рынке никого нет — закрывайте месяц, придут новые люди.')}</p>
        )}

        {/* Итоги прошлого месяца */}
        {lastLog && (
          <section className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 mb-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-800">{L(`📊 Результати місяця ${lastLog.month}`, `📊 Итоги месяца ${lastLog.month}`)}</h2>
              <p className="text-sm text-slate-500">
                <span aria-hidden>{DEMAND_MODES[lastLog.demand].emoji}</span> {B(DEMAND_MODES[lastLog.demand].label)}
              </p>
            </div>
            <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <p className="text-slate-600">{L('Виручка:', 'Выручка:')} <b className="text-emerald-700">+{M(lastLog.revenue)}</b></p>
              <p className="text-slate-600">{L('ФОТ:', 'ФОТ:')} <b className="text-rose-600">−{M(lastLog.payroll)}</b></p>
              <p className="text-slate-600">{L('Операційні:', 'Операционные:')} <b className="text-rose-600">−{M(lastLog.opex)}</b></p>
              {lastLog.vacancyFine > 0 && (
                <p className="text-slate-600">{L('Простій вакансій:', 'Простой вакансий:')} <b className="text-rose-600">−{M(lastLog.vacancyFine)}</b></p>
              )}
            </div>
            {lastLog.crisis && <CrisisCard c={lastLog.crisis} month={lastLog.month} intl={intl} />}
            <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <p className="text-slate-600">
                {L('Баланс каси:', 'Итог кассы:')} <b className={lastLog.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {lastLog.net >= 0 ? '+' : '−'}{M(Math.abs(lastLog.net))}
                </b>
              </p>
              <p className="text-slate-600">
                {L('Вартість:', 'Стоимость:')} <b className={lastLog.valueDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
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
                  • {txt(e.text)}
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
              ? L('🏁 Відкрити звіт власнику', '🏁 Открыть отчёт владельцу')
              : game.month >= LIVE_MONTHS
                ? L('🏁 Закрити рік і здати звіт', '🏁 Закрыть год и сдать отчёт')
                : L(`▶ Закрити місяць ${game.month} →`, `▶ Закрыть месяц ${game.month} →`)}
          </button>
          <div
            className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1"
            role="group"
            aria-label={L('Швидкість моделювання: автопілот місяців', 'Скорость моделирования: автопилот месяцев')}
          >
            <span className="px-1.5 text-xs text-slate-400">⏱ {L('Автопілот', 'Автопилот')}</span>
            {SPEEDS.map((s) => (
              <button
                key={s.ms}
                onClick={() => setSpeed(s.ms)}
                title={B(s.title)}
                aria-label={L(`Автопілот: ${B(s.title)}`, `Автопилот: ${B(s.title)}`)}
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
              ? L('не найняли — кандидати підуть · вакансії подорожчають', 'не наняли — кандидаты уйдут · вакансии подорожают')
              : L(`місяць закриється сам через ${(speed / 1000).toString().replace('.', ',')} с · пауза — щоб думати`, `месяц закроется сам через ${(speed / 1000).toString().replace('.', ',')} с · пауза — чтобы думать`)}
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
  const L = useL()
  const B = useBi()
  const lang = useLang()
  const K = (s: string) => (lang === 'uk' ? ukAbbr(s) : s)
  const txt = (t: Bi | string): string => (typeof t === 'string' ? t : B(t))
  const scoreClass =
    c.score >= 80 ? 'text-emerald-700' : c.score >= CRISIS_BASELINE ? 'text-slate-800' : c.score >= 45 ? 'text-amber-600' : 'text-rose-600'
  const pulled = c.contributions.slice(0, 2)
  const worst = c.contributions.length >= 2 ? c.contributions[c.contributions.length - 1] : null
  return (
    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-800">
          <span aria-hidden>{c.emoji}</span> {txt(c.title)}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {L(`криза місяця ${month}`, `кризис месяца ${month}`)}{c.sponsorName ? ` · ${L('рішення:', 'решение:')} ${txt(c.sponsorName)}` : ''}
          </span>
        </p>
        <span className="flex items-center gap-2 text-sm">
          <b className={scoreClass}>{L('ви:', 'вы:')} {c.score}%</b>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">{L('ідеал:', 'идеал:')} {c.idealScore}%</span>
        </span>
      </div>
      <p className="mt-1.5 text-sm text-slate-600">{txt(c.narrative)}</p>
      {c.lobbyBonus ? (
        <p className={`mt-0.5 text-sm ${c.lobbyBonus > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
          🤝 {L('Лобіст:', 'Лоббист:')} {c.lobbyBonus > 0 ? '+' : ''}{c.lobbyBonus} {L('до рішення · стосунки', 'к решению · отношения')} «{c.lobbyKind ? B(RELATION_LABEL[c.lobbyKind]) : '—'}»
        </p>
      ) : null}
      <p className="mt-1.5 text-sm">
        <span className={c.cashImpact >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
          💵 {L('каса', 'касса')} {c.cashImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(c.cashImpact), lang)}
        </span>
        <span className="text-slate-300 mx-2">·</span>
        <span className={c.valueImpact >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
          📈 {L('вартість', 'стоимость')} {c.valueImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(c.valueImpact), lang)}
        </span>
      </p>
      {pulled.length > 0 && (
        <p className="mt-1.5 text-sm text-slate-600">
          💪 {L('Витягнули:', 'Вытянули:')} {pulled.map((k) => `${B(k.postTitle)} — ${label(k.type, intl, lang)} (${K(k.fn)} ${Math.round(k.fnWeight / 10)}/10)`).join(' · ')}
        </p>
      )}
      {worst && (
        <p className="mt-0.5 text-sm text-slate-500">
          😓 {L('Просів:', 'Просел:')} {B(worst.postTitle)} — {label(worst.type, intl, lang)} ({K(worst.fn)} {Math.round(worst.fnWeight / 10)}/10, {L('проф', 'проф')} {worst.prof}%)
        </p>
      )}
      {c.score < CRISIS_BASELINE && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {L('У кожної кризи свій набір функцій і крісел: провал тут — ще не вирок,', 'У каждого кризиса свой набор функций и кресел: провал здесь — ещё не приговор,')}
          {' '}{L('а шанс для інших людей. Подивіться, які ролі були потрібні, і посилюйте ці крісла —', 'а шанс для других людей. Смотрите, какие роли требовались, и усиливайте эти кресла —')}
          {' '}{L('наступна криза вимагатиме іншого.', 'следующий кризис потребует другого.')}
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
  const L = useL()
  const B = useBi()
  const lang = useLang()
  const K = (s: string) => (lang === 'uk' ? ukAbbr(s) : s)
  const M = (n: number): string => fmtMoney(n, lang)
  const valueDelta = pv.valueAfter - pv.valueBefore
  const quadraChanges = quadraDeltaText(pv.quadrasBefore, pv.quadrasAfter)
  const socParts: string[] = []
  if (quadraChanges.length > 0) socParts.push(`${L('Квадри', 'Квадры')}: ${quadraChanges.join(', ')}`)
  if (pv.fnChanges.length > 0) {
    socParts.push(`${L('Сильні функції', 'Сильные функции')}: ${pv.fnChanges.map((f) => `${K(f.fn)} ${f.before}→${f.after}`).join(', ')}`)
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
          <span>{L('підсумок', 'итог')} {pv.fit}%</span>
          <span className="text-xs opacity-70">{L('проф', 'проф')} {pv.prof}% · {L('соціоніка', 'соционика')} {pv.soc}%</span>
        </span>
        <span className="text-xs text-slate-500">
          {L('еталон крісла:', 'эталон кресла:')} {pv.idealFit}% · {L('збіг', 'совпадение')} <b className="text-slate-700">{pv.pctOfIdeal}%</b>
        </span>
      </div>

      {/* Профиль компании: до → после */}
      <div className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
        <p className="text-slate-600">
          💰 {L('Вартість:', 'Стоимость:')} {fmtValue(pv.valueBefore)} →{' '}
          <b className={valueDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{fmtValue(pv.valueAfter)}</b>{' '}
          ({signedMoney(valueDelta)})
        </p>
        <p className="text-slate-600">
          🤝 {L('Згуртованість:', 'Сплочённость:')} {pv.cohesionBefore}% →{' '}
          <b className={pv.cohesionAfter >= pv.cohesionBefore ? 'text-emerald-700' : 'text-rose-600'}>{pv.cohesionAfter}%</b>
        </p>
        <p className="text-slate-600">📊 {L('Середній підсумок штату:', 'Средний итог штата:')} {pv.avgFitBefore}% → {pv.avgFitAfter}%</p>
        <p className="text-slate-600">💼 {L('ФОТ:', 'ФОТ:')} {M(pv.payrollBefore)} → {M(pv.payrollAfter)}/{L('міс', 'мес')}</p>
      </div>

      {/* Деньги хода */}
      {pv.promotion ? (
        <p className="mt-1.5 text-slate-600">
          🚀 {L('Внутрішній перехід — підйомних немає · новий оклад:', 'Внутренний переход — подъёмных нет · новый оклад:')} <b>{M(pv.salaryAfter)}/{L('міс', 'мес')}</b>
          {pv.severance > 0 && <> · {L('секверанс знятому:', 'секверанс снятому:')} <b>{M(pv.severance)}</b></>}
        </p>
      ) : (
        <p className="mt-1.5 text-slate-600">
          {L('Підйомні:', 'Подъёмные:')} <b>{M(pv.bonus)}</b>
          {pv.severance > 0 && <> · {L('секверанс:', 'секверанс:')} <b>{M(pv.severance)}</b></>}
          {' '}· {L('всього з каси:', 'всего из кассы:')} <b className="text-slate-800">{M(pv.total)}</b>
        </p>
      )}
      {pv.displaced && (
        <p className="mt-1 text-xs text-slate-500">
          {L('Крісло займе на місці', 'Кресло займёт место')} {B(pv.displaced.name)} — {L(`виплачується секверанс ${SEVERANCE_MONTHS} оклади`, `выплачивается секверанс ${SEVERANCE_MONTHS} оклада`)}
        </p>
      )}
      {pv.freeingPost && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          ⚠️ {L('Звільниться', 'Освободится')} «{B(pv.freeingPost.title)}» — {L('там почнеться простій: вакансія народжується і з підвищення', 'там начнётся простой: вакансия рождается и из повышения')}
        </p>
      )}

      {/* Соционический профиль: до → после */}
      {socParts.length > 0 ? (
        <p className="mt-1 text-slate-600">🧬 {socParts.join(' · ')}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">
          🧬 {L('Соціонічний профіль мережі не зміниться: квадри і сильні функції ті самі', 'Соционический профиль сети не изменится: квадры и сильные функции те же')}
        </p>
      )}
      {tense.length > 0 ? (
        <p className="mt-1 text-rose-700">
          ⚡ {L('Напружені зв\'язки:', 'Напряжённые связи:')} {tense.map((r) => `${B(RELATION_LABEL[r.kind])} — ${B(r.name)} (${B(r.postTitle)})`).join(' · ')}
        </p>
      ) : (
        <p className="mt-1 text-xs text-emerald-700">⚡ {L('Конфліктних зв\'язків з майбутніми колегами немає', 'Конфликтных связей с будущими коллегами нет')}</p>
      )}
      {friendly.length > 0 && (
        <p className="mt-0.5 text-xs text-emerald-700">
          🤝 {L('Сильні союзи:', 'Сильные союзы:')} {friendly.map((r) => `${B(RELATION_LABEL[r.kind])} — ${B(r.name)} (${B(r.postTitle)})`).join(' · ')}
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
        <p className="mt-2 text-sm font-medium text-rose-600">{typeof pv.reason === 'string' ? pv.reason : B(pv.reason)}</p>
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
  const L = useL()
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
      aria-label={L('Графік: ваша вартість проти лінії ідеального керування', 'График: ваша стоимость против линии идеального управления')}
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
        {L('ідеал', 'идеал')} {fmtValue(last.ideal)}
      </text>
      <text
        x={Math.min(x(line.length - 1) + 6, W - 120)}
        y={ahead ? y(last.player) + 14 : y(last.player) - 5}
        fontSize="11" fontWeight="bold" fill="#047857"
      >
        {L('ви', 'вы')} {fmtValue(last.player)}
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
  const L = useL()
  return (
    <footer className="mt-auto bg-white border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-4 py-3 text-center text-xs text-slate-400">
        {L('Навчальна модель: раціональний найм починається з компетенцій і досвіду, а соціоніка —', 'Учебная модель: рациональный найм начинается с компетенций и опыта, а соционика —')}
        {' '}{L('дискусійна типологія особистості, не науковий інструмент відбору персоналу.', 'дискуссионная типология личности, не научный инструмент отбора персонала.')}
        {' '}{L('Теорія закріплюється в тренажері «Соціоніка» (socionika.zip),', 'Теория закрепляется в тренажёре «Соционика» (socionika.zip),')}
        {' '}{L('кабінет міністрів живе в ministerstvo.zip.', 'кабинет министров живёт в ministerstvo.zip.')}
      </div>
    </footer>
  )
}
