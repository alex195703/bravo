// ============================================================
// ТОРГОВАЯ СЕТЬ «БРАВО» — ДАННЫЕ И ЛОГИКА
// ------------------------------------------------------------
// Четвёртый учебный проект. Симулятор управления коммерческой
// организацией: сеть продовольственных магазинов «Браво».
//
// ДВЕ ГЛАВНЫЕ ИДЕИ (реалистичная кадровика):
// 1. Рациональный найм: работодатель смотрит сначала на
//    компетентность и опыт (профпригодность — 65% рейтинга),
//    и лишь потом на психологические особенности (35%).
// 2. Рынок труда не даёт всю палитру из 16 типов! Кандидатов
//    мало (8–12 из 16), приходится набирать из того, что есть:
//    где-то закрывать должности компромиссом, где-то оставлять
//    вакансию. Плюс ФОТ: профессионалы стоят дороже бюджета.
//
// Движок отношений живёт в src/lib/relations.ts (общий для
// всех игр). Проверяется скриптом scripts/test-bravo.ts.
// ============================================================

import {
  type SocioType, type FunctionId,
  TYPES, FUNCTIONS, QUADRAS,
} from './socionics-data'
import { typeByRu, modelA, shuffle } from './socionics-quiz'
import {
  relationBetween, PAIR_SCORE,
  type RelationKind,
} from './relations'

// ---------- Должности в сети «Браво» ----------

export interface Post {
  id: string
  title: string
  emoji: string
  description: string
  /** Профессиональная сфера для резюме кандидатов */
  field: string
  primary: FunctionId
  secondary: FunctionId
}

export const POSTS: Post[] = [
  { id: 'com', title: 'Коммерческий директор', emoji: '📦', field: 'закупки',
    description: 'Поставщики, закупки и ассортимент: договориться о выгодной цене, заметить перспективного поставщика.',
    primary: 'ЧЛ', secondary: 'ЧИ' },
  { id: 'fin', title: 'Финансовый директор', emoji: '💰', field: 'финансы',
    description: 'Бюджет, цены и наценка: строгая структура расходов, учёт каждой копейки.',
    primary: 'БЛ', secondary: 'ЧЛ' },
  { id: 'log', title: 'Директор по логистике', emoji: '🚚', field: 'логистика',
    description: 'Склады и доставка: расписание машин, точные сроки, порядок в документах.',
    primary: 'БЛ', secondary: 'БИ' },
  { id: 'ret', title: 'Управляющий розницей', emoji: '🏪', field: 'розница',
    description: 'Магазины сети: дисциплина в торговых залах, порядок на полках, твёрдая рука.',
    primary: 'ЧС', secondary: 'БЭ' },
  { id: 'hr', title: 'HR-директор', emoji: '🧑‍💼', field: 'HR и персонал',
    description: 'Найм и обучение персонала: бережёт отношения в коллективе, удерживает людей.',
    primary: 'БЭ', secondary: 'ЧЭ' },
  { id: 'mkt', title: 'Директор по маркетингу', emoji: '📣', field: 'маркетинг',
    description: 'Реклама и акции: воодушевить покупателей, придумать фирменные фишки «Браво».',
    primary: 'ЧЭ', secondary: 'ЧИ' },
  { id: 'qa', title: 'Менеджер по качеству', emoji: '🥬', field: 'качество',
    description: 'Свежесть и санитария: дегустации, стандарты полок, готовность к проверкам.',
    primary: 'БС', secondary: 'БЛ' },
  { id: 'it', title: 'IT-директор', emoji: '💻', field: 'IT и автоматизация',
    description: 'Кассы и учёт: автоматизация процессов, чтобы сеть работала как часы.',
    primary: 'ЧЛ', secondary: 'БЛ' },
]

// ---------- Пригодность типа к должности ----------

/** Сколько «весит» функция на позиции модели А (0–100) */
export const POSITION_WEIGHTS: Record<number, number> = {
  1: 100, 2: 80, 3: 45, 4: 5, 5: 60, 6: 50, 7: 25, 8: 35,
}

const MODEL_CACHE = new Map<string, Record<FunctionId, number>>()

/** Позиция функции в модели А типа (1–8) */
export function functionPosition(t: SocioType, fn: FunctionId): number {
  const cached = MODEL_CACHE.get(t.ru)
  if (cached) return cached[fn]
  const fresh = {} as Record<FunctionId, number>
  for (const p of modelA(t)) fresh[p.fn] = p.n
  MODEL_CACHE.set(t.ru, fresh)
  return fresh[fn]
}

/** Пригодность типа к должности: 0–100 */
export function postFit(t: SocioType, post: Post): number {
  const w1 = POSITION_WEIGHTS[functionPosition(t, post.primary)]
  const w2 = POSITION_WEIGHTS[functionPosition(t, post.secondary)]
  return Math.round(0.7 * w1 + 0.3 * w2)
}

export function fitStars(fit: number): string {
  if (fit >= 75) return '★★★'
  if (fit >= 55) return '★★'
  if (fit >= 35) return '★'
  return '·'
}

/** Лучшая должность для типа (подсказка для «скамейки запасных») */
export function bestPostFor(t: SocioType): { post: Post; fit: number } {
  let best = POSTS[0]
  for (const p of POSTS) if (postFit(t, p) > postFit(t, best)) best = p
  return { post: best, fit: postFit(t, best) }
}

// ---------- Рациональный найм: компетенции прежде психологии ----------

/** Итоговый рейтинг кандидата на должности: 65% профессия + 35% соционика */
export const WEIGHT_PROF = 0.65
export const WEIGHT_SOC = 0.35

/** Образование: строка резюме + бонус к профпригодности */
export const EDUCATIONS: { text: string; bonus: number }[] = [
  { text: 'MBA', bonus: 10 },
  { text: 'Профильный вуз', bonus: 6 },
  { text: 'Профкурсы', bonus: 2 },
]

/** Достижения по сферам (строки резюме кандидатов) */
export const ACHIEVEMENTS: Record<string, string[]> = {
  com: [
    'перевёл закупки на двух поставщиков с экономией 9%',
    'выбил эксклюзив на местную молочку — полки «Браво» заметили',
  ],
  fin: [
    'сократил кассовые разрывы на треть за год',
    'внедрил учёт маржи по каждой полке — наценка выросла на 4 п.п.',
  ],
  log: [
    'поднял доставку точно в срок с 71% до 94%',
    'вдвое урезал пересортицу на распределительном центре',
  ],
  ret: [
    'убрал очереди: среднее время на кассе минус 40 секунд',
    'вырастил средний чек магазинов на 11% без роста цен',
  ],
  hr: [
    'снизил текучку кассиров с 45% до 18% годовых',
    'запустил школу новичков — адаптация с трёх месяцев до двух недель',
  ],
  mkt: [
    'привлёк 12 тысяч держателей карт лояльности за год',
    'акция «браво-полка» подняла выручку промотоваров на 7%',
  ],
  qa: [
    'снизил списания просрочки на 18% за полгода',
    'провёл сеть через 5 проверок подряд без единого замечания',
  ],
  it: [
    'перевёл 4 магазина на новую учётную систему без остановки продаж',
    'самообслуживаемые кассы — экономия 1,5 ставки на точку',
  ],
}

/** Месячный бюджет ФОТ на команду из 8 руководителей, грн */
export const PAYROLL_BUDGET = 800_000

/**
 * Профпригодность кандидата к должности: 0–100.
 * Рациональный работодатель: сфера работы (главное), стаж,
 * образование — и только потом психология.
 */
export function profFit(c: Candidate, post: Post): number {
  const base = c.profession === post.id ? 62 : 22
  const yearsBonus = Math.min(c.years, 20) * 0.9
  const eduBonus = EDUCATIONS.find((e) => e.text === c.education)?.bonus ?? 0
  return Math.max(10, Math.min(98, Math.round(base + yearsBonus + eduBonus)))
}

/** Итоговый рейтинг кандидата на должности: компетенции + соционика */
export function overallFit(c: Candidate, post: Post): number {
  return Math.round(WEIGHT_PROF * profFit(c, post) + WEIGHT_SOC * postFit(typeByRu(c.ru), post))
}

/** Лучшая должность по итоговому рейтингу (для скамейки запасных) */
export function bestPostForCandidate(c: Candidate): { post: Post; fit: number } {
  let best = POSTS[0]
  for (const p of POSTS) if (overallFit(c, p) > overallFit(c, best)) best = p
  return { post: best, fit: overallFit(c, best) }
}

/**
 * Рыночная надбавка к зарплате по сфере: на украинском рынке
 * IT- и финансовые руководители стоят дороже, качество — дешевле.
 * Калибровка — по медианным зарплатам вакансий Work.ua (окт. 2025):
 * финдиректор 85 тыс. грн, комдиректор 78 тыс., IT — дороже финансов.
 */
export const FIELD_PREMIUM: Record<string, number> = {
  it: 1.15, fin: 1.12, com: 1.06, log: 1.04, ret: 1.04, mkt: 1.03, hr: 1.0, qa: 0.9,
}

/**
 * Зарплатные ожидания, грн/мес — привязаны к реальному рынку Украины:
 * базовый кандидат (проф 62, стаж 10) стоит ≈ 78 тыс. грн — медианная
 * зарплата коммерческого директора по Work.ua; «звёзды» уходят в вилку
 * топ-менеджмента 120–150 тыс. грн, новички из чужой сферы — к уровню
 * директора одного магазина (≈ 32 тыс. грн).
 */
export function salaryFor(prof: number, years: number, field?: string): number {
  const premium = field ? FIELD_PREMIUM[field] ?? 1 : 1
  const raw = (24_000 + prof * 620 + years * 1_600) * premium
  return Math.round(raw / 1000) * 1000
}

/** «0,86 млн грн» / «148 тыс. грн» — для ФОТ и зарплат */
export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace('.', ',')} млн грн`
  return `${Math.round(n / 1000)} тыс. грн`
}

// ---------- Бизнес-кризисы сети ----------

export interface Crisis {
  id: string
  title: string
  emoji: string
  description: string
  /** Какие должности задействованы в кризисе */
  involved: string[]
  /** Требуемые аспекты и их вес */
  demands: Partial<Record<FunctionId, number>>
}

export const CRISES: Crisis[] = [
  { id: 'milk', title: 'Сорвалась поставка молока', emoji: '🥛',
    description: 'Главный поставщик молочки не привёз товар. К утру полки опустеют: срочно вести переговоры и искать замену.',
    involved: ['com', 'log', 'qa'],
    demands: { 'ЧЛ': 1, 'ЧИ': 0.8, 'БИ': 0.7 } },
  { id: 'competitor', title: 'Конкурент напротив', emoji: '🏗',
    description: 'Федеральная сеть открыла гипермаркет напротив флагмана «Браво». Клиенты уходят, началась ценовая война.',
    involved: ['mkt', 'ret', 'fin'],
    demands: { 'ЧС': 1, 'ЧЭ': 0.8, 'ЧЛ': 0.7 } },
  { id: 'inspection', title: 'Внеплановая проверка', emoji: '🧾',
    description: 'Санитарная служба пришла без предупреждения. Нужны документы, регламенты и безупречные полки.',
    involved: ['qa', 'log', 'ret'],
    demands: { 'БЛ': 1, 'БС': 0.8, 'БЭ': 0.5 } },
  { id: 'cashiers', title: 'Кассиры увольняются', emoji: '😤',
    description: 'Три кассира написали заявление за один день. Либо удержать людей, либо срочно организовать набор.',
    involved: ['hr', 'ret', 'it'],
    demands: { 'БЭ': 1, 'ЧЭ': 0.8, 'ЧЛ': 0.7 } },
  { id: 'prices', title: 'Поставщики подняли цены', emoji: '📈',
    description: 'Закупочные цены на базовые товары выросли на 15%. Надо пересчитывать наценку и торговаться.',
    involved: ['fin', 'com'],
    demands: { 'ЧЛ': 1, 'БЛ': 0.9, 'ЧИ': 0.6 } },
  { id: 'pos', title: 'Кассы встали', emoji: '🖥',
    description: 'Программа учёта упала в субботний вечер: очереди на кассах, недовольные покупатели.',
    involved: ['it', 'ret', 'fin'],
    demands: { 'БЛ': 1, 'ЧЛ': 0.8, 'ЧС': 0.5 } },
  { id: 'blogger', title: 'Разгромный обзор блогера', emoji: '📱',
    description: 'Блогер снял ролик «в „Браво“ несвежий хлеб». Просмотры растут на глазах, сеть в трендах.',
    involved: ['mkt', 'qa', 'hr'],
    demands: { 'ЧЭ': 1, 'БС': 0.8, 'ЧИ': 0.7 } },
  { id: 'expansion', title: 'Открыть пятый магазин?', emoji: '🏬',
    description: 'Арендодатель предлагает выгодное помещение. Сеть на подъёме, но ресурсы команды не резиновые.',
    involved: ['fin', 'com', 'ret'],
    demands: { 'ЧИ': 1, 'БИ': 0.8, 'ЧЛ': 0.8, 'ЧС': 0.6 } },
]

// ---------- Кадровый рынок ----------

export interface Candidate {
  ru: string           // тип кандидата (рус. аббревиатура)
  name: string         // «Марина Соколова»
  age: number
  years: number        // стаж работы, лет
  profession: string   // сфера: id должности ('fin', 'log', …)
  education: string    // 'MBA' | 'Профильный вуз' | 'Профкурсы'
  achievement: string  // конкретное достижение из резюме
  salary: number       // зарплатные ожидания, грн/мес
  cur?: 'uah'          // валюта партии: гривна (старые «рублёвые» сохранения пересчитываются)
  tagline: string      // психологический портрет (вторичен при найме)
}

/** Режимы рынка: сколько кандидатов доступно из 16 типов */
export type MarketMode = 'plenty' | 'normal' | 'drought'

export const MARKET_MODES: Record<MarketMode, { label: string; emoji: string; size: number; hint: string }> = {
  plenty: { label: 'Кадровое изобилие', emoji: '🌞', size: 12,
    hint: '12 кандидатов — почти вся палитра типов доступна' },
  normal: { label: 'Обычный рынок', emoji: '🏙', size: 10,
    hint: '10 кандидатов — четверть типов недоступна' },
  drought: { label: 'Кадровый голод', emoji: '🥶', size: 8,
    hint: '8 кандидатов — половина типов недоступна' },
}

/** Короткие строки резюме по типу (для карточек кандидатов) */
export const CANDIDATE_TAGLINES: Record<string, string> = {
  'ИЛЭ': 'генератор идей, рутину не выносит',
  'СЭИ': 'миротворец, создаёт уютную атмосферу',
  'ЭСЭ': 'душа коллектива, заряжает оптимизмом',
  'ЛИИ': 'аналитик, наводит логический порядок',
  'СЛЭ': 'жёсткий управленец, пробивает стены',
  'ИЭИ': 'дипломат, чувствует настроение и время',
  'ЭИЭ': 'артист и оратор, ведёт за собой',
  'ЛСИ': 'хранитель регламентов и дисциплины',
  'СЭЭ': 'харизматичный переговорщик, видит людей',
  'ИЛИ': 'стратег-скептик, предвидит подводные камни',
  'ЛИЭ': 'делец: эффективность и выгода',
  'ЭСИ': 'принципиальный хранитель норм',
  'ЛСЭ': 'организатор процессов, дело превыше слов',
  'ЭИИ': 'гуманист, совесть команды',
  'ИЭЭ': 'энтузиаст-коммуникатор, море знакомств',
  'СЛИ': 'спокойный практик, делает качественно',
}

const NAMES = [
  'Андрей Морозов', 'Анна Вересова', 'Павел Ефимов', 'Марина Соколова',
  'Игорь Лебедев', 'Елена Дуброва', 'Олег Тарасов', 'Ольга Мельник',
  'Семён Кузнецов', 'Светлана Ясная', 'Денис Орлов', 'Ирина Полякова',
  'Виктор Гусев', 'Наталья Речкина', 'Артём Белов', 'Вера Луговая',
  'Григорий Зайцев', 'Ксения Травина', 'Роман Фомин', 'Алла Ветрова',
  'Никита Ершов', 'Дарья Гончарова', 'Тимур Сафонов', 'Юлия Зорина',
  'Кирилл Стрекалов', 'Полина Осокина', 'Максим Чижов', 'Лидия Камнева',
  'Валерий Дёмухин', 'Тамара Грачёва', 'Борис Полозов', 'Алиса Нечаева',
]

function randomName(exclude: Set<string>): string {
  const free = NAMES.filter((n) => !exclude.has(n))
  const list = free.length > 0 ? free : NAMES
  return list[Math.floor(Math.random() * list.length)]
}

/** Случайный кандидат заданного типа: досье + психологический портрет */
export function makeCandidate(t: SocioType, excludeNames: Set<string> = new Set()): Candidate {
  const age = 26 + Math.floor(Math.random() * 30) // 26–55
  const years = Math.max(1, Math.min(age - 21, 3 + Math.floor(Math.random() * 25)))
  // Самоотбор в профессии: обычно человек работает там, где ему удобно (65%),
  // но рынок встречает и «перебежчиков» из других сфер
  const natural = bestPostFor(t).post.id
  const others = POSTS.filter((p) => p.id !== natural)
  const profession = Math.random() < 0.65
    ? natural
    : others[Math.floor(Math.random() * others.length)].id
  const eduRoll = Math.random()
  const education = eduRoll < 0.2 ? 'MBA' : eduRoll < 0.7 ? 'Профильный вуз' : 'Профкурсы'
  const variants = ACHIEVEMENTS[profession]
  const achievement = variants[Math.floor(Math.random() * variants.length)]
  const draft: Candidate = {
    ru: t.ru,
    name: randomName(excludeNames),
    age,
    years,
    profession,
    education,
    achievement,
    salary: 0,
    cur: 'uah',
    tagline: CANDIDATE_TAGLINES[t.ru] ?? 'специалист',
  }
  const ownPost = POSTS.find((p) => p.id === profession)!
  draft.salary = salaryFor(profFit(draft, ownPost), years, profession)
  return draft
}

/**
 * Дозаполнить профессиональные поля у кандидатов из старых
 * сохранений (партии, начатые до введения найма по компетенциям).
 */
export function normalizeCandidate(c: Candidate): Candidate {
  const ok = c && typeof c.profession === 'string' && ACHIEVEMENTS[c.profession] !== undefined &&
    typeof c.education === 'string' && c.education.length > 0 &&
    typeof c.achievement === 'string' && c.achievement.length > 0 &&
    typeof c.salary === 'number' && c.salary > 0 && c.cur === 'uah' &&
    typeof c.years === 'number' && c.years >= 1
  if (ok) return c
  const t = typeByRu(c.ru)
  const profession = c.profession && ACHIEVEMENTS[c.profession] ? c.profession : bestPostFor(t).post.id
  const years = typeof c.years === 'number' && c.years >= 1 ? c.years : 10
  const education = typeof c.education === 'string' && c.education ? c.education : 'Профильный вуз'
  const achievement = c.achievement || ACHIEVEMENTS[profession][0]
  const ownPost = POSTS.find((p) => p.id === profession)!
  const prof = profFit({ ...c, years, profession, education, achievement, salary: 0 }, ownPost)
  // Зарплаты «рублёвой эпохи» (до перехода на гривну) пересчитываем
  // по новой шкале: те же профпригодность и стаж, гривневый рынок
  const salary = c.cur === 'uah' && typeof c.salary === 'number' && c.salary > 0
    ? c.salary
    : salaryFor(prof, years, profession)
  return { ...c, years, profession, education, achievement, salary, cur: 'uah' }
}

/** ФОТ команды: сумма зарплат нанятых, грн/мес */
export function payroll(cabinet: Cabinet, pool: Candidate[]): number {
  let sum = 0
  for (const p of POSTS) {
    const ru = cabinet[p.id]
    if (!ru) continue
    const c = pool.find((x) => x.ru === ru)
    if (c) sum += c.salary
  }
  return sum
}

/**
 * Сформировать рынок труда: случайные типы из доступных,
 * НЕ встречающиеся в exclude. Палитра 16 типов целиком
 * недоступна — это и есть главная реалистичная механика.
 */
export function generateMarket(mode: MarketMode, exclude: string[] = []): Candidate[] {
  const size = MARKET_MODES[mode].size
  const available = TYPES.filter((t) => !exclude.includes(t.ru))
  const chosen = shuffle([...available]).slice(0, Math.min(size, available.length))
  const names = new Set<string>()
  return chosen.map((t) => {
    const c = makeCandidate(t, names)
    names.add(c.name)
    return c
  })
}

/**
 * «Хедхантер» (один раз за игру): заменяет до count незанятых
 * кандидатов новыми типами, которых на рынке ещё не было.
 */
export function rerollBench(pool: Candidate[], team: Record<string, string | null>, count = 2): Candidate[] {
  const busy = new Set<string>(Object.values(team).filter((x): x is string => !!x))
  const poolTypes = new Set(pool.map((c) => c.ru))
  const bench = pool.filter((c) => !busy.has(c.ru))
  const used = new Set<string>([...poolTypes, ...busy])
  const outside = shuffle(TYPES.filter((t) => !used.has(t.ru)))
  const benchPick = shuffle([...bench]).slice(0, Math.min(count, bench.length, outside.length))
  const next = [...pool]
  const names = new Set(pool.map((c) => c.name))
  for (let i = 0; i < benchPick.length; i++) {
    const idx = next.findIndex((c) => c.ru === benchPick[i].ru)
    const fresh = makeCandidate(outside[i], names)
    names.add(fresh.name)
    next[idx] = fresh
  }
  return next
}

/** Типы, которых на рынке нет (для подсказки «кого не хватает») */
export function absentTypes(pool: Candidate[]): string[] {
  const present = new Set(pool.map((c) => c.ru))
  return TYPES.filter((t) => !present.has(t.ru)).map((t) => t.ru)
}

// ---------- Команда и симуляция ----------

export type Cabinet = Record<string, string | null>

export const EMPTY_TEAM: Cabinet = Object.fromEntries(POSTS.map((p) => [p.id, null]))

export function cabinetTypes(cabinet: Cabinet): SocioType[] {
  return POSTS
    .map((p) => (cabinet[p.id] ? typeByRu(cabinet[p.id]!) : null))
    .filter((t): t is SocioType => t !== null)
}

/**
 * Автосборка команды из пула: жадный подбор по ИТОГОВОМУ рейтингу
 * (65% профпригодность + 35% соционика). Сначала закрываем самые
 * «дефицитные» должности — те, где в пуле мало подходящих
 * кандидатов (рейтинг 70+), затем остальные.
 */
export function autoAssemble(pool: Candidate[]): Cabinet {
  const team: Cabinet = { ...EMPTY_TEAM }
  const taken = new Set<string>()
  const scarcity = POSTS.map((post) => {
    const fits = pool.map((c) => overallFit(c, post))
    const good = fits.filter((f) => f >= 70).length
    const best = fits.length ? Math.max(...fits) : 0
    return { post, good, best }
  }).sort((a, b) => a.good - b.good || b.best - a.best)
  for (const { post } of scarcity) {
    const free = pool
      .filter((c) => !taken.has(c.ru))
      .sort((a, b) => overallFit(b, post) - overallFit(a, post))
    if (free.length > 0) {
      team[post.id] = free[0].ru
      taken.add(free[0].ru)
    }
  }
  return team
}

export interface Contribution {
  postTitle: string
  type: SocioType
  fn: FunctionId
  position: number
  fnWeight: number  // сила функции по модели А
  prof: number      // профпригодность на своей должности
  weight: number    // вес аспекта в кризисе
}

export interface CrisisResult {
  score: number
  narrative: string
  contributions: Contribution[]
  relationPenalty: number
  emptyPenalty: number
}

const NARRATIVE_GOOD = 'Вопрос закрыт блестяще: нужные сильные функции нашлись сразу, менеджеры сработались.'
const NARRATIVE_OK = 'Ситуацию удержали: слабые места команды компенсировались слаженностью, но без запаса прочности.'
const NARRATIVE_MEH = 'Справились со скрипом: требуемых функций не хватало, видны трения между менеджерами.'
const NARRATIVE_BAD = 'Провал: команда не нашла ни сильных функций, ни общего языка. Ущерб серьёзный.'

/**
 * Симуляция кризиса для собранной команды.
 * Вклад менеджера по требуемой функции = 60% сила функции
 * по модели А + 40% его профессионализм на своей должности.
 */
export function simulateCrisis(
  cabinet: Record<string, string | null>,
  crisis: Crisis,
  pool: Candidate[] = [],
): CrisisResult {
  const contributions: Contribution[] = []
  let weightedSum = 0
  let weightSum = 0

  for (const [fn, w] of Object.entries(crisis.demands) as [FunctionId, number][]) {
    let best = 0
    let bestPost = ''
    let bestType: SocioType | null = null
    let bestFnWeight = 0
    let bestProf = 0
    for (const postId of crisis.involved) {
      const ru = cabinet[postId]
      if (!ru) continue
      const t = typeByRu(ru)
      const fnWeight = POSITION_WEIGHTS[functionPosition(t, fn)]
      const cand = pool.find((c) => c.ru === ru)
      const prof = cand ? profFit(cand, POSTS.find((p) => p.id === postId)!) : 55
      const value = Math.round(0.6 * fnWeight + 0.4 * prof)
      if (value > best) {
        best = value
        bestPost = postId
        bestType = t
        bestFnWeight = fnWeight
        bestProf = prof
      }
    }
    weightedSum += w * best
    weightSum += w
    if (bestType && bestPost) {
      contributions.push({
        postTitle: POSTS.find((p) => p.id === bestPost)!.title,
        type: bestType,
        fn,
        position: functionPosition(bestType, fn),
        fnWeight: bestFnWeight,
        prof: bestProf,
        weight: w,
      })
    }
  }

  const base = weightSum > 0 ? (weightedSum / weightSum) : 0

  // Вклад отношений между задействованными менеджерами
  const involvedTypes = crisis.involved
    .map((id) => (cabinet[id] ? typeByRu(cabinet[id]!) : null))
    .filter((t): t is SocioType => t !== null)
  let relPenalty = 0
  for (let i = 0; i < involvedTypes.length; i++) {
    for (let j = i + 1; j < involvedTypes.length; j++) {
      relPenalty += PAIR_SCORE[relationBetween(involvedTypes[i], involvedTypes[j]).kind]
    }
  }
  relPenalty = Math.round(relPenalty * 10) / 10

  const emptyCount = crisis.involved.filter((id) => !cabinet[id]).length
  const emptyPenalty = emptyCount * 10

  const score = Math.max(3, Math.min(100, Math.round(base + relPenalty - emptyPenalty)))
  const narrative =
    score >= 80 ? NARRATIVE_GOOD : score >= 60 ? NARRATIVE_OK : score >= 40 ? NARRATIVE_MEH : NARRATIVE_BAD

  contributions.sort((a, b) => b.weight * b.fnWeight - a.weight * a.fnWeight)

  return { score, narrative, contributions, relationPenalty: relPenalty, emptyPenalty }
}

// ---------- Сплочённость и итоговый отчёт ----------

/** Индекс сплочённости команды: 0–100 */
export function cohesion(cabinet: Cabinet): number {
  const types = cabinetTypes(cabinet)
  let sum = 0
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      sum += PAIR_SCORE[relationBetween(types[i], types[j]).kind]
    }
  }
  return Math.max(0, Math.min(100, Math.round(50 + sum)))
}

export interface RankInfo {
  rank: 'S' | 'A' | 'B' | 'C' | 'D'
  overall: number
  avgCrisis: number
  avgFit: number        // средний итоговый рейтинг назначений (проф + соц)
  avgProf: number       // средняя профпригодность нанятых на своих должностях
  cohesionValue: number
  payroll: number       // ФОТ команды, грн/мес (0 — если рынок не передан)
  payrollOver: number   // превышение ФОТ над бюджетом, %
  strengths: string[]
  risks: string[]
  // Кадровый контекст (заполняется при наличии рынка)
  mode?: MarketMode
  poolSize?: number
  absent?: string[]
  benchCount?: number
}

export interface MarketContext {
  mode: MarketMode
  poolSize: number
  absent: string[]
  benchCount: number
}

/** Кандидат по типу из пула (или нейтральная заглушка для старых вызовов) */
function candidateOf(ru: string, pool: Candidate[]): Candidate {
  const found = pool.find((c) => c.ru === ru)
  if (found) return found
  const t = typeByRu(ru)
  return {
    ru, name: t.name, age: 40, years: 10,
    profession: bestPostFor(t).post.id,
    education: 'Профильный вуз', achievement: '', salary: 0, tagline: '',
  }
}

export function buildReport(
  cabinet: Cabinet,
  results: Record<string, CrisisResult>,
  market?: MarketContext,
  pool: Candidate[] = [],
): RankInfo {
  const played = CRISES.filter((c) => results[c.id])
  const avgCrisis = played.length
    ? Math.round(played.reduce((s, c) => s + results[c.id]!.score, 0) / played.length)
    : 0
  const filled = POSTS.filter((p) => cabinet[p.id])
  const avgFit = filled.length
    ? Math.round(filled.reduce((s, p) => s + overallFit(candidateOf(cabinet[p.id]!, pool), p), 0) / filled.length)
    : 0
  const avgProf = filled.length
    ? Math.round(filled.reduce((s, p) => s + profFit(candidateOf(cabinet[p.id]!, pool), p), 0) / filled.length)
    : 0
  const cohesionValue = cohesion(cabinet)
  const pay = pool.length ? payroll(cabinet, pool) : 0
  const payrollOver = pay > PAYROLL_BUDGET ? Math.round((pay / PAYROLL_BUDGET - 1) * 100) : 0
  const payrollPenalty = payrollOver > 0 ? Math.min(10, Math.round(payrollOver / 2)) : 0
  const overall = Math.max(0, Math.min(100,
    Math.round(0.5 * avgCrisis + 0.25 * avgFit + 0.25 * cohesionValue) - payrollPenalty))
  const rank = overall >= 85 ? 'S' : overall >= 72 ? 'A' : overall >= 58 ? 'B' : overall >= 42 ? 'C' : 'D'

  const types = cabinetTypes(cabinet)
  const strengths: string[] = []
  const risks: string[] = []

  // Дуальные пары и конфликтные пары
  const duals: string[] = []
  const conflicts: string[] = []
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      const rel = relationBetween(types[i], types[j])
      if (rel.kind === 'дуальность') duals.push(`${types[i].ru} + ${types[j].ru}`)
      if (rel.kind === 'конфликт') conflicts.push(`${types[i].ru} — ${types[j].ru}`)
    }
  }
  if (duals.length) strengths.push(`Дуальные пары в команде: ${duals.join(', ')} — поддержат друг друга в любой передряге.`)
  if (conflicts.length) risks.push(`Конфликтные пары: ${conflicts.join(', ')} — не ставьте их в один проект.`)

  // Квадры
  const quadrasPresent = [...new Set(types.map((t) => t.quadra))]
  if (quadrasPresent.length === 4) strengths.push('Все четыре квадры представлены — команда смотрит на проблемы с четырёх сторон.')
  else if (quadrasPresent.length === 1) risks.push(`Вся команда из одной квадры «${QUADRAS[quadrasPresent[0]].name}»: комфортно, но слепые зоны гарантированы.`)
  else if (quadrasPresent.length === 2) risks.push('Только две квадры: половина «взгляда на мир» отсутствует.')

  // Сильная этика отношений для людей
  const hasBE = types.some((t) => functionPosition(t, 'БЭ') <= 2)
  if (!hasBE) risks.push('Никто в команде не имеет этики отношений в топ-2 функциях: климат в магазинах будет страдать.')
  else strengths.push('В команде есть носитель сильной этики отношений — продавцы и кассиры это почувствуют.')

  // Сильная воля
  const hasChS = types.some((t) => functionPosition(t, 'ЧС') <= 2)
  if (!hasChS) risks.push('Нет носителя волевой сенсорики в топ-2: жёсткие решения (ценовая война, дисциплина) будут даваться тяжело.')

  // Лучшее и худшее назначение (по итоговому рейтингу)
  if (filled.length) {
    const scored = filled.map((p) => {
      const c = candidateOf(cabinet[p.id]!, pool)
      return { post: p, fit: overallFit(c, p) }
    })
    const best = scored.reduce((a, b) => (b.fit > a.fit ? b : a))
    const worst = scored.reduce((a, b) => (b.fit < a.fit ? b : a))
    strengths.push(`Лучшее назначение: ${best.post.title} — ${fitStars(best.fit)} (${best.fit}%).`)
    if (worst.fit < 55) risks.push(`Слабое звено: ${worst.post.title} — ${fitStars(worst.fit)} (${worst.fit}%). На богатом рынке его стоит заменить.`)
  }

  // Две оси найма: компетенции и психология — оцениваются раздельно
  if (filled.length) {
    if (avgProf >= 75) strengths.push(`Профессионально сильная команда: средняя профпригодность ${avgProf}% — то, что первым делом проверяет рациональный работодатель.`)
    else if (avgProf < 55) risks.push(`Профессиональный уровень невысок (средняя профпригодность ${avgProf}%): компетенции нанятых не дотягивают до требований сети.`)
    if (avgProf >= 70 && cohesionValue < 45) risks.push('Классическая ловушка найма: профессионалы есть, но психологически команда не сходится — знания не превращаются в результат.')
    if (cohesionValue >= 65 && avgProf < 60) risks.push('Команда дружная и приятная, но профессиональных мышц мало: совместимость не заменяет компетенций.')
  }

  // ФОТ против бюджета
  if (payrollOver > 0) {
    risks.push(`ФОТ ${fmtMoney(pay)} превышает бюджет (${fmtMoney(PAYROLL_BUDGET)}) на ${payrollOver}%: владелец попросит пересмотреть зарплаты.`)
  }

  // Кадровый контекст: чего не было на рынке
  const empty = POSTS.length - filled.length
  if (empty > 0) risks.push(`Пустых должностей: ${empty}. Вакансия бьёт по каждому кризису.`)
  if (market) {
    const { mode, poolSize, absent, benchCount } = market
    const modeLabel = MARKET_MODES[mode].label
    if (absent.length >= 6) {
      risks.push(`Рынок «${modeLabel}»: доступно всего ${poolSize} типов из 16, отсутствуют — ${absent.join(', ')}.`)
    } else if (absent.length > 0) {
      strengths.push(`Рынок «${modeLabel}»: удалось прикрыть почти всю палитру, не было только ${absent.join(', ')}.`)
    } else {
      strengths.push(`Рынок «${modeLabel}»: повезло — вся палитра из 16 типов была доступна.`)
    }
    if (benchCount > 0) strengths.push(`В запасе осталось ${benchCount} ${benchCount === 1 ? 'кандидат' : 'кандидата'} — можно усиливать команду.`)
    if (avgFit < 55) risks.push('Средний итоговый рейтинг низкий: команду пришлось набирать «из того, что было».')
  }

  return {
    rank, overall, avgCrisis, avgFit, avgProf, cohesionValue,
    payroll: pay, payrollOver, strengths, risks,
    mode: market?.mode, poolSize: market?.poolSize, absent: market?.absent, benchCount: market?.benchCount,
  }
}

// ---------- Экспорт общего ----------

export { typeByRu, FUNCTIONS }
export type { RelationKind }
