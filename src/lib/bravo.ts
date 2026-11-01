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
  super?: boolean      // суперуправленец — ходячий эталон должности (редкость на рынке)
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

// ---------- ЭТАЛОН: команда мечты и Суперуправленец ----------
//
// Отзыв игрока: «для соревнования надо иметь суперуправленца как
// эталон, к которому надо стремиться». Отсюда две механики:
//   • у каждой должности есть эталон — сильнейший тип, 20 лет
//     в профессии и MBA; панель «Эталон» показывает, насколько
//     текущий штат дотягивает до идеала (в %);
//   • раз в несколько месяцев на рынок может выйти живой
//     суперуправленец — резюме уровня эталона, но за 45%
//     дороже рынка. Нанять его — маленький праздник и рывок
//     команды к мечте.

/** Лучший соционический тип для должности — эталон психологии */
export function idealTypeFor(post: Post): SocioType {
  let best = TYPES[0]
  for (const t of TYPES) if (postFit(t, post) > postFit(best, post)) best = t
  return best
}

/** Идеальное резюме на должность: сильнейший тип, 20 лет в сфере, MBA */
export function idealCandidate(post: Post): Candidate {
  const t = idealTypeFor(post)
  const ideal: Candidate = {
    ru: t.ru,
    name: 'Эталон',
    age: 50,
    years: 20,
    profession: post.id,
    education: 'MBA',
    achievement: ACHIEVEMENTS[post.id][0],
    salary: 0,
    cur: 'uah',
    tagline: CANDIDATE_TAGLINES[t.ru] ?? 'специалист',
  }
  ideal.salary = salaryFor(profFit(ideal, post), ideal.years, post.id)
  return ideal
}

/** Строка эталонной таблицы: что требуется и что есть сейчас */
export interface IdealRow {
  post: Post
  /** эталонный тип (рус. аббревиатура) */
  idealType: string
  /** итоговый рейтинг эталона (обычно около 90%) */
  idealFit: number
  /** эталонная зарплата, грн/мес */
  idealSalary: number
  /** итоговый рейтинг текущего сотрудника (0 — вакансия) */
  curFit: number
  /** насколько текущий человек дотягивает до эталона, % */
  pct: number
}

/**
 * Штат против эталона: по каждой должности и в среднем.
 * Вакансия — это 0% от эталона: пустое кресло всегда дальше всех от мечты.
 */
export function teamVsIdeal(cabinet: Cabinet, pool: Candidate[]): {
  rows: IdealRow[]
  avgPct: number
  idealPayroll: number
} {
  const rows: IdealRow[] = []
  let idealPayroll = 0
  for (const post of POSTS) {
    const ideal = idealCandidate(post)
    const idealFit = overallFit(ideal, post)
    idealPayroll += ideal.salary
    const ru = cabinet[post.id]
    const emp = ru ? pool.find((c) => c.ru === ru) : null
    const curFit = emp ? overallFit(emp, post) : 0
    rows.push({
      post,
      idealType: ideal.ru,
      idealFit,
      idealSalary: ideal.salary,
      curFit,
      pct: idealFit > 0 ? Math.round((curFit / idealFit) * 100) : 0,
    })
  }
  const avgPct = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length)
    : 0
  return { rows, avgPct, idealPayroll }
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

// ---------- ПУЛЬС СЕТИ: стоимость компании ----------

/** Базовая стоимость сети из четырёх магазинов, грн */
export const VALUE_BASE = 40_000_000
/** Вклад руководителя с итоговым рейтингом 100% в стоимость, грн */
export const POST_VALUE_MAX = 3_500_000
/** Штраф за каждую пустую должность, грн */
export const VACANCY_VALUE_PENALTY = 1_200_000
/** Вклад психологии команды: +2 млн при сплочённости 100%, −2 млн при 0% */
export const COMBO_VALUE_MAX = 2_000_000
/** Штраф за каждый 1% перерасхода ФОТ, грн */
export const PAYROLL_VALUE_PENALTY = 80_000
/** Потолок штрафа за перерасход ФОТ, грн */
export const PAYROLL_VALUE_CAP = 2_000_000

/**
 * Рыночный множитель стоимости: на голодном рынке хороший
 * руководитель ценнее — команда, собранная в дефицит, стоит дороже.
 * Так выбранные рыночные ограничения влияют на главный счёт.
 */
export const MODE_VALUE_MULT: Record<MarketMode, number> = {
  plenty: 1.0, normal: 1.15, drought: 1.3,
}

/** Красивая строка множителя для подсказок: ×1,15 */
export const MODE_VALUE_LABEL: Record<MarketMode, string> = {
  plenty: '×1', normal: '×1,15', drought: '×1,3',
}

/** «56,4 млн грн» — стоимость компании всегда в миллионах */
export function fmtValue(n: number): string {
  return `${(n / 1_000_000).toFixed(1).replace('.', ',')} млн грн`
}

/** Округление до 10 тыс. грн — чтобы цифры были аккуратными */
const round10k = (n: number): number => Math.round(n / 10_000) * 10_000

/** Вклад одного руководителя: итоговый рейтинг × рыночный множитель */
export function postContribution(fit: number, mode: MarketMode): number {
  return round10k(POST_VALUE_MAX * (fit / 100) * MODE_VALUE_MULT[mode])
}

export interface ValuePart {
  label: string
  amount: number
  hint?: string
}

export interface CompanyValue {
  total: number          // итоговая стоимость, грн
  base: number           // базовая стоимость сети
  teamCapital: number    // Σ вкладов руководителей (с множителем рынка)
  combo: number          // вклад сплочённости: может быть отрицательным
  vacancyPenalty: number // штраф за пустые должности: ≤ 0
  payrollPenalty: number // штраф за перерасход ФОТ: ≤ 0
  cohesionValue: number  // сплочённость, из которой посчитан combo
  parts: ValuePart[]     // готовая разбивка для дашборда и отчёта
  perPost: { post: Post; fit: number; contribution: number }[]
}

/**
 * ПУЛЬС СЕТИ — стоимость компании, считается на лету из текущего
 * кабинета. Каждое отдельное решение (назначение, вакансия) видно
 * в деньгах сразу, комбинация типов — через сплочённость, выбранные
 * рыночные ограничения — через множитель MODE_VALUE_MULT.
 */
export function companyValue(cabinet: Cabinet, pool: Candidate[], mode: MarketMode): CompanyValue {
  const candOf = (ru: string): Candidate =>
    pool.find((c) => c.ru === ru) ?? {
      ru, name: typeByRu(ru).name, age: 40, years: 10,
      profession: bestPostFor(typeByRu(ru)).post.id,
      education: 'Профильный вуз', achievement: '', salary: 0, tagline: '',
    }
  const perPost: CompanyValue['perPost'] = []
  let teamCapital = 0
  let vacancies = 0
  for (const post of POSTS) {
    const ru = cabinet[post.id]
    if (!ru) { vacancies++; continue }
    const fit = overallFit(candOf(ru), post)
    const contribution = postContribution(fit, mode)
    perPost.push({ post, fit, contribution })
    teamCapital += contribution
  }
  const vacancyPenalty = -vacancies * VACANCY_VALUE_PENALTY
  const cohesionValue = cohesion(cabinet)
  const combo = round10k((COMBO_VALUE_MAX * (cohesionValue - 50)) / 50)
  const pay = payroll(cabinet, pool)
  const overPct = pay > PAYROLL_BUDGET ? (pay / PAYROLL_BUDGET - 1) * 100 : 0
  const payrollPenalty = overPct > 0
    ? -Math.min(PAYROLL_VALUE_CAP, round10k(overPct * PAYROLL_VALUE_PENALTY))
    : 0
  const total = VALUE_BASE + teamCapital + combo + vacancyPenalty + payrollPenalty

  const parts: ValuePart[] = [
    { label: 'База сети', amount: VALUE_BASE, hint: 'четыре магазина и план на пятый' },
    { label: 'Качество назначений', amount: teamCapital, hint: `итоги × множитель рынка ${MODE_VALUE_LABEL[mode]}` },
    { label: 'Психология команды', amount: combo, hint: `сплочённость ${cohesionValue}%` },
  ]
  if (vacancies > 0) parts.push({ label: 'Вакансии', amount: vacancyPenalty, hint: `${vacancies} пустых должностей` })
  if (payrollPenalty < 0) parts.push({ label: 'Перерасход ФОТ', amount: payrollPenalty })

  return { total, base: VALUE_BASE, teamCapital, combo, vacancyPenalty, payrollPenalty, cohesionValue, parts, perPost }
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
  /** Пульс сети: стоимость компании с разбивкой (заполняется при наличии рынка) */
  value?: CompanyValue
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

  const value = market ? companyValue(cabinet, pool, market.mode) : undefined

  return {
    rank, overall, avgCrisis, avgFit, avgProf, cohesionValue,
    payroll: pay, payrollOver, strengths, risks,
    mode: market?.mode, poolSize: market?.poolSize, absent: market?.absent, benchCount: market?.benchCount,
    value,
  }
}

// ---------- Экспорт общего ----------

export { typeByRu, FUNCTIONS }
export type { RelationKind }

// ============================================================
// ---------- ЖИВАЯ КОМПАНИЯ: сценарий «Компания как есть» ----------
// ============================================================
//
// Отзыв игрока: «нет соревнования: при ограниченных ресурсах нельзя
// удовлетворить все критерии, а пустые должности развязывают руки —
// можно прокрастинировать». Отсюда месячный цикл управления:
//
//   • сеть принимается «как есть»: сильные, средние и слабые
//     сотрудники, пустые кресла со стажем простоя, зарплаты;
//   • каждый месяц приносит новую конъюнктуру: спрос покупателей
//     и рынок труда; скамейка кандидатов обновляется и УХОДИТ;
//   • решения: нанять (подъёмные = 1 оклад), заменить (плюс
//     секверанс = 2 оклада), уволить или ничего не делать;
//   • простой вакансии бьёт по кассе каждый месяц и по стоимости
//     компании — прокрастинация стоит денег;
//   • счёт — стоимость компании: сколько миллионов гривен сеть
//     добавила (или потеряла) за 12 месяцев.

/** Месяцев в сценарии */
export const LIVE_MONTHS = 12
/** Касса на старте, грн */
export const LIVE_CASH_START = 2_500_000
/** Увольнение: выплата в N окладов */
export const SEVERANCE_MONTHS = 2
/** Приём на работу: подъёмные в N окладов */
export const SIGNING_BONUS_MONTHS = 1
/** Операционные расходы сети (аренда, логистика, закупки), грн/мес */
export const OPEX_BASE = 750_000
/** Выручка сильной команды при ровном спросе, грн/мес */
export const REVENUE_BASE = 2_600_000
/** Простой вакансии: базовый штраф, грн/мес */
export const VACANCY_FINE_BASE = 80_000
/** Простой вакансии: прибавка за каждый месяц пустого кресла */
export const VACANCY_FINE_STEP = 30_000
/** Потолок месячного штрафа за одну вакансию */
export const VACANCY_FINE_CAP = 300_000

/** Шанс, что в месяце на рынок выйдет суперуправленец */
export const SUPER_CHANCE = 0.12
/** Насколько дороже рынка просит суперуправленец */
export const SUPER_SALARY_MULT = 1.45

/**
 * Собрать суперуправленца на должность: сильнейший тип, 20+ лет
 * в своей сфере, MBA — резюме, равное эталону. Просит в 1,45 раза
 * больше рынка: мечта всегда дорога.
 */
function makeSuper(post: Post, names: Set<string>): Candidate {
  const t = idealTypeFor(post)
  const c: Candidate = {
    ru: t.ru,
    name: randomName(names),
    age: 48 + Math.floor(Math.random() * 8),
    years: 20 + Math.floor(Math.random() * 6),
    profession: post.id,
    education: 'MBA',
    achievement: ACHIEVEMENTS[post.id][ACHIEVEMENTS[post.id].length - 1],
    salary: 0,
    cur: 'uah',
    tagline: CANDIDATE_TAGLINES[t.ru] ?? 'специалист',
    super: true,
  }
  c.salary = Math.round(
    (salaryFor(profFit(c, post), c.years, post.id) * SUPER_SALARY_MULT) / 1000,
  ) * 1000
  return c
}

/** Конъюнктура спроса покупателей на месяц */
export type DemandMode = 'boom' | 'steady' | 'slump'

export const DEMAND_MODES: Record<DemandMode, {
  label: string; emoji: string; revenueMult: number; opexMult: number; hint: string
}> = {
  boom: {
    label: 'Ажиотажный спрос', emoji: '🔥', revenueMult: 1.35, opexMult: 1.1,
    hint: 'Покупатели закупаются впрок — обороты выше обычного, но и закупки дороже',
  },
  steady: {
    label: 'Ровный спрос', emoji: '🌤', revenueMult: 1.0, opexMult: 1.0,
    hint: 'Обычная торговля без сюрпризов',
  },
  slump: {
    label: 'Спад', emoji: '🌧', revenueMult: 0.65, opexMult: 0.9,
    hint: 'У покупателей пусто в кошельках — выручка проседает',
  },
}

/** Сколько кандидатов приходит на скамейку за один живой месяц */
export const LIVE_BENCH_SIZE: Record<MarketMode, number> = { plenty: 5, normal: 4, drought: 3 }

/** Кресло: сотрудник (тип, ru) или вакансия со стажем простоя */
export interface SlotState { ru: string | null; vacantMonths: number }

// ---------- ЛИНИЯ ИДЕАЛЬНОГО УПРАВЛЕНИЯ ----------
//
// Отзыв игрока: «действия игрока должна сопровождать линия идеального
// управления в данных условиях, к которой нужно стремиться. Игрок может
// иногда опережать эту линию за счёт случайности и неполной
// предсказуемости мира». Отсюда теневой управляющий: параллельная
// компания, которая приняла ТАКУ ЖЕ сеть «как есть» и живёт в тех же
// условиях (тот же спрос, тот же рынок труда, та же скамейка, те же
// суперуправленцы), но каждый месяц делает безошибочные кадровые ходы.
// Его стоимость по месяцам — линия идеала на графике. Обогнать её можно
// только удачей: теневой управляющий не ясновидящий — он жадный и
// тратит кассу сразу, а игрок, сберёгший деньги, может поймать
// суперуправленца раньше и дешевле.

/** Теневая компания идеального управляющего */
export interface IdealState {
  /** касса теневой компании, грн */
  cash: number
  /** должность → кресло теневой компании */
  slots: Record<string, SlotState>
  /** сотрудники теневой компании (кандидаты из той же базы) */
  roster: Candidate[]
  /** стоимость на конец каждого закрытого месяца — точки линии идеала */
  history: { month: number; value: number }[]
  /** что идеал сделал в текущем месяце — для панели сравнения */
  moves: string[]
}

/** Точка линии: стоимость игрока и идеала на один месяц */
export interface IdealLinePoint { month: number; player: number; ideal: number }

/** Сравнение игрока с линией идеала на данный момент */
export interface IdealCompare {
  /** стоимость теневой компании прямо сейчас, грн */
  idealValue: number
  /** стоимость компании игрока прямо сейчас, грн */
  playerValue: number
  /** % игрока от идеала (может быть больше 100 — опережение) */
  pct: number
  /** отставание, грн: > 0 — идеал впереди, < 0 — игрок опережает */
  gap: number
  /** линия по месяцам: месяц 0 (приёмка) + все закрытые месяцы */
  line: IdealLinePoint[]
  /** что идеал сделал в текущем месяце */
  moves: string[]
}

/** Минимальный итог, ниже которого идеал не берёт кандидата */
export const IDEAL_MIN_FIT = 55
/** При долгом простое идеал готов взять середняка */
export const IDEAL_RESCUE_FIT = 45
/** Замена только если новый заметно лучше старого */
export const IDEAL_SWAP_GAIN = 10
/** Не больше замен за один месяц — идеал тоже платит секверансы */
export const IDEAL_MAX_SWAPS = 2

export interface MonthEvent { text: string; kind: 'good' | 'bad' | 'neutral' }

/** Итоги закрытого месяца — для панели «итоги» и финальной истории */
export interface MonthLog {
  month: number
  demand: DemandMode
  revenue: number
  opex: number
  payroll: number
  vacancyFine: number
  /** изменение кассы за месяц (без кадровых ходов) */
  net: number
  /** стоимость компании на конец месяца */
  value: number
  /** изменение стоимости за месяц */
  valueDelta: number
  /** кто ушёл с рынка кадров */
  left: string[]
  events: MonthEvent[]
}

/** Полное состояние сценария «Компания как есть» */
export interface LiveGame {
  /** какой месяц играем: 1…12 */
  month: number
  /** касса, грн */
  cash: number
  /** конъюнктура рынка труда текущего месяца */
  labor: MarketMode
  /** конъюнктура спроса текущего месяца */
  demand: DemandMode
  /** должность → кресло */
  slots: Record<string, SlotState>
  /** все известные люди: сотрудники + скамейка месяца */
  roster: Candidate[]
  /** ru кандидатов на рынке этого месяца (в конце месяца уходят) */
  bench: string[]
  /** закрытые месяцы */
  history: MonthLog[]
  /** стоимость компании на момент приёмки */
  startValue: number
  /** теневой идеальный управляющий — источник линии идеала */
  ideal: IdealState
}

/**
 * Достаточный срез состояния для расчётов (кресла, люди, конъюнктура):
 * и живая партия, и теневая компания идеала передаются одним типом.
 */
export type LiveCore = Pick<LiveGame, 'slots' | 'roster' | 'labor' | 'demand'>

/** Кабинет живой компании в общем формате (стоимость, ФОТ, сплочённость) */
export function liveCabinet(game: LiveCore): Cabinet {
  const cab: Cabinet = {}
  for (const p of POSTS) cab[p.id] = game.slots[p.id]?.ru ?? null
  return cab
}

/** Штраф за простой одной вакансии в месяце: растёт со стажем простоя */
export function vacancyFineFor(vacantMonths: number): number {
  return Math.min(VACANCY_FINE_CAP, VACANCY_FINE_BASE + VACANCY_FINE_STEP * Math.max(0, vacantMonths))
}

/** Суммарный штраф за простаивающие кресла, грн/мес */
export function liveVacancyFine(game: LiveCore): number {
  let sum = 0
  for (const p of POSTS) {
    const s = game.slots[p.id]
    if (s && !s.ru) sum += vacancyFineFor(s.vacantMonths)
  }
  return sum
}

/**
 * Сила команды: средний итог занятых × штраф за вакансии
 * (0,88 в степени «число пустых кресел») × сплочённость.
 */
export function livePower(game: LiveCore): number {
  let fitSum = 0
  let filled = 0
  let vacancies = 0
  for (const p of POSTS) {
    const s = game.slots[p.id]
    if (!s || !s.ru) { vacancies++; continue }
    const c = game.roster.find((x) => x.ru === s.ru)
    if (c) { fitSum += overallFit(c, p); filled++ }
  }
  const avgFit = filled > 0 ? fitSum / filled : 0
  const coh = cohesion(liveCabinet(game))
  return (0.5 + 0.6 * (avgFit / 100)) * Math.pow(0.88, vacancies) * (0.92 + 0.16 * (coh / 100))
}

/** Ожидаемая выручка текущего месяца, грн */
export function liveRevenue(game: LiveCore): number {
  return round10k(REVENUE_BASE * DEMAND_MODES[game.demand].revenueMult * livePower(game))
}

/** Стоимость компании прямо сейчас (множитель — рынок труда месяца) */
export function liveValue(game: LiveCore): CompanyValue {
  return companyValue(liveCabinet(game), game.roster, game.labor)
}

function rollDemand(): DemandMode {
  const r = Math.random()
  return r < 0.3 ? 'boom' : r < 0.75 ? 'steady' : 'slump'
}

function rollLabor(): MarketMode {
  const r = Math.random()
  return r < 0.25 ? 'plenty' : r < 0.75 ? 'normal' : 'drought'
}

/** Скамейка месяца: кандидаты, которых нет в штате, и их немного */
function newBench(game: LiveGame): Candidate[] {
  const busy = POSTS.map((p) => game.slots[p.id]?.ru).filter((x): x is string => !!x)
  const fresh = generateMarket(game.labor, busy)
  const picked = fresh.slice(0, LIVE_BENCH_SIZE[game.labor])
  // Суперуправленец — редкий гость: с месяца 2 он может выйти на рынок
  if (game.month >= 2 && Math.random() < SUPER_CHANCE) {
    const post = POSTS[Math.floor(Math.random() * POSTS.length)]
    picked.push(makeSuper(post, new Set(game.roster.map((c) => c.name))))
  }
  return picked
}

/**
 * Принять сеть «как есть»: 2 сильных, 2 средних, 2 слабых сотрудника
 * (слабых нередко ещё и переоплачивают), 2 вакансии со стажем простоя.
 */
export function newLiveGame(): LiveGame {
  const names = new Set<string>()
  const usedRu = new Set<string>()
  const roster: Candidate[] = []
  const slots: Record<string, SlotState> = {}
  const order = shuffle([...POSTS])
  const strength = ['strong', 'strong', 'ok', 'ok', 'weak', 'weak'] as const
  order.forEach((post, i) => {
    if (i >= strength.length) {
      slots[post.id] = { ru: null, vacantMonths: 1 + Math.floor(Math.random() * 3) }
      return
    }
    const level = strength[i]
    const free = TYPES.filter((t) => !usedRu.has(t.ru))
    const t = free[Math.floor(Math.random() * free.length)]
    const c = makeCandidate(t, names)
    names.add(c.name)
    usedRu.add(t.ru)
    if (level === 'strong') {
      c.years = Math.max(c.years, 12)
      c.education = Math.random() < 0.5 ? 'MBA' : 'Профильный вуз'
    } else if (level === 'ok') {
      c.years = 5 + Math.floor(Math.random() * 8)
      if (c.education === 'MBA') c.education = 'Профильный вуз'
    } else {
      c.years = 1 + Math.floor(Math.random() * 4)
      // Классика принимаемой компании: человек из чужой сферы
      if (Math.random() < 0.5) {
        const others = POSTS.filter((p) => p.id !== post.id)
        c.profession = others[Math.floor(Math.random() * others.length)].id
      }
    }
    c.achievement = ACHIEVEMENTS[c.profession][Math.floor(Math.random() * ACHIEVEMENTS[c.profession].length)]
    let salary = salaryFor(profFit(c, post), c.years, c.profession)
    // Переоплаченный слабый сотрудник — решение о замене неочевидно
    if (level === 'weak' && Math.random() < 0.5) salary = Math.round((salary * 1.25) / 1000) * 1000
    c.salary = salary
    roster.push(c)
    slots[post.id] = { ru: c.ru, vacantMonths: 0 }
  })
  const game: LiveGame = {
    month: 1,
    cash: LIVE_CASH_START,
    labor: 'normal',
    demand: 'steady',
    slots,
    roster,
    bench: [],
    history: [],
    startValue: 0,
    ideal: { cash: LIVE_CASH_START, slots: {}, roster: [], history: [], moves: [] },
  }
  const benchCandidates = newBench(game)
  game.roster = [...roster, ...benchCandidates]
  game.bench = benchCandidates.map((c) => c.ru)
  game.startValue = liveValue(game).total
  // Теневой управляющий принимает ту же сеть «как есть» — и сразу делает ходы месяца 1
  game.ideal = idealMoves(
    {
      cash: LIVE_CASH_START,
      slots: Object.fromEntries(POSTS.map((p) => [p.id, { ...slots[p.id] }])),
      roster: [...roster],
      history: [],
      moves: [],
    },
    benchCandidates, game.labor, game.demand,
  )
  return game
}

/** Предварительный расчёт стоимости кадрового хода (кнопка «Предложить работу») */
export interface HireCost {
  /** подъёмные новому, грн */
  bonus: number
  /** секверанс уходящему, грн (0 — кресло было пустым) */
  severance: number
  /** всего из кассы, грн */
  total: number
  /** кресло занято — это замена */
  replacing: boolean
  /** денег хватает, ход возможен */
  ok: boolean
  /** почему ход невозможен */
  reason: string
}

export function hireCost(game: LiveGame, ru: string, postId: string): HireCost {
  const cand = game.roster.find((c) => c.ru === ru)
  const slot = game.slots[postId]
  const old = slot?.ru ? game.roster.find((c) => c.ru === slot.ru) : null
  const bonus = cand ? cand.salary * SIGNING_BONUS_MONTHS : 0
  const severance = old ? old.salary * SEVERANCE_MONTHS : 0
  const total = bonus + severance
  let ok = false
  let reason = ''
  if (!cand) reason = 'Кандидата уже нет на рынке'
  else if (game.cash < total) {
    reason = `В кассе ${fmtMoney(game.cash)} — не хватает на кадровые выплаты ${fmtMoney(total)}`
  } else ok = true
  return { bonus, severance, total, replacing: !!old, ok, reason }
}

export interface LiveActionResult { game: LiveGame; event: MonthEvent }

/** Нанять кандидата (ru) на должность: в вакансию или на замену */
export function hireCandidate(game: LiveGame, ru: string, postId: string): LiveActionResult {
  const cost = hireCost(game, ru, postId)
  const cand = game.roster.find((c) => c.ru === ru)
  if (!cand || !cost.ok) {
    return { game, event: { text: 'Ход не состоялся: не хватает денег или кандидата', kind: 'bad' } }
  }
  const post = POSTS.find((p) => p.id === postId)!
  const oldRu = game.slots[postId]?.ru ?? null
  const old = oldRu ? game.roster.find((c) => c.ru === oldRu) : null
  const roster = game.roster.filter((c) => c.ru !== oldRu)
  // Кандидат больше не на рынке — он сотрудник: убираем со скамейки
  const bench = game.bench.filter((x) => x !== ru)
  const slots = { ...game.slots, [postId]: { ru, vacantMonths: 0 } }
  const next: LiveGame = { ...game, cash: game.cash - cost.total, slots, roster, bench }
  const text = cand.super
    ? `🦸 «${post.title}» принимает эталон: ${cand.name} (${cand.ru}) за ${fmtMoney(cand.salary)}/мес — подъёмные ${fmtMoney(cost.bonus)}. Команда шагнула к мечте`
    : cost.replacing && old
      ? `«${post.title}»: ${old.name} уходит (секверанс ${fmtMoney(cost.severance)}), кресло принимает ${cand.name} (${cand.ru}) — подъёмные ${fmtMoney(cost.bonus)}`
      : `«${post.title}»: кресло принимает ${cand.name} (${cand.ru}, ${fmtMoney(cand.salary)}/мес) — подъёмные ${fmtMoney(cost.bonus)}`
  return { game: next, event: { text, kind: cost.replacing && !cand.super ? 'neutral' : 'good' } }
}

/** Уволить сотрудника с должности: секверанс, кресло становится вакансией */
export function fireEmployee(game: LiveGame, postId: string): LiveActionResult {
  const slot = game.slots[postId]
  const old = slot?.ru ? game.roster.find((c) => c.ru === slot.ru) : null
  if (!old || !slot) {
    return { game, event: { text: 'Увольнять некого — кресло и так пустое', kind: 'neutral' } }
  }
  const severance = old.salary * SEVERANCE_MONTHS
  const post = POSTS.find((p) => p.id === postId)!
  const next: LiveGame = {
    ...game,
    cash: game.cash - severance,
    slots: { ...game.slots, [postId]: { ru: null, vacantMonths: 0 } },
    roster: game.roster.filter((c) => c.ru !== old.ru),
  }
  return {
    game: next,
    event: {
      text: `«${post.title}»: ${old.name} покидает компанию — выплачено ${fmtMoney(severance)} (${SEVERANCE_MONTHS} оклада). Кресло пусто — простой начался`,
      kind: 'bad',
    },
  }
}

// ---------- Теневой управляющий: ходы идеала ----------

/** Вид теневой компании для общих расчётов — теми же формулами */
function idealView(st: IdealState, labor: MarketMode, demand: DemandMode): LiveCore {
  return { slots: st.slots, roster: st.roster, labor, demand }
}

/** Кадровая выплата в теневой компании: подъёмные + секверанс, грн */
function idealCost(st: IdealState, cand: Candidate, postId: string): number {
  const oldRu = st.slots[postId]?.ru ?? null
  const old = oldRu ? st.roster.find((c) => c.ru === oldRu) : null
  const severance = old ? old.salary * SEVERANCE_MONTHS : 0
  return cand.salary * SIGNING_BONUS_MONTHS + severance
}

/**
 * Ходы идеального управляющего на месяц: он видит ту же скамейку,
 * что и игрок. Сначала закрывает вакансии (старейшие — первыми,
 * суперуправленца берёт всегда), потом меняет любого, кто проигрывает
 * скамейке 10 и больше пунктов, — но не больше двух замен за месяц,
 * ведь секверансы тоже платятся. Жадный, но не ясновидящий: кассу
 * расходует сразу, поэтому игрок, сберёгший деньги, может
 * поймать суперуправленца раньше и обогнать линию.
 */
export function idealMoves(
  st: IdealState, bench: Candidate[], labor: MarketMode, demand: DemandMode,
): IdealState {
  // labor и demand нужны для единого контракта: ходы идеала от них не зависят
  void labor; void demand
  let cur: IdealState = {
    cash: st.cash, slots: { ...st.slots }, roster: [...st.roster],
    history: st.history, moves: [],
  }
  const taken = new Set<string>()
  const bestFor = (postId: string): { c: Candidate; fit: number } | null => {
    const post = POSTS.find((p) => p.id === postId)
    if (!post) return null
    let best: { c: Candidate; fit: number } | null = null
    for (const c of bench) {
      if (taken.has(c.ru) || cur.roster.some((e) => e.ru === c.ru)) continue
      const fit = overallFit(c, post)
      if (!best || fit > best.fit) best = { c, fit }
    }
    return best
  }
  const hire = (postId: string, c: Candidate, fit: number, replacing: boolean): void => {
    if (cur.cash < idealCost(cur, c, postId)) return
    const oldRu = cur.slots[postId]?.ru ?? null
    const old = replacing && oldRu ? cur.roster.find((e) => e.ru === oldRu) : null
    const post = POSTS.find((p) => p.id === postId)
    if (!post) return
    cur = {
      ...cur,
      cash: cur.cash - idealCost(cur, c, postId),
      slots: { ...cur.slots, [postId]: { ru: c.ru, vacantMonths: 0 } },
      roster: old ? cur.roster.filter((e) => e.ru !== old.ru).concat(c) : cur.roster.concat(c),
      moves: [...cur.moves, old
        ? `«${post.title}» — меняет ${old.name} (итог был ${overallFit(old, post)}%) на ${c.name} (${fit}%)`
        : `«${post.title}» — нанимает ${c.name} (${fit}%)`],
    }
    taken.add(c.ru)
  }
  // 1. Вакансии: самые старые простои — первыми
  const vacant = POSTS.filter((p) => !cur.slots[p.id]?.ru)
    .sort((a, b) => (cur.slots[b.id]?.vacantMonths ?? 0) - (cur.slots[a.id]?.vacantMonths ?? 0))
  for (const post of vacant) {
    const best = bestFor(post.id)
    if (!best) continue
    const idle = cur.slots[post.id]?.vacantMonths ?? 0
    const worth = best.c.super || best.fit >= IDEAL_MIN_FIT || (idle >= 2 && best.fit >= IDEAL_RESCUE_FIT)
    if (worth) hire(post.id, best.c, best.fit, false)
  }
  // 2. Замены: слабых и переоплаченных — под заметно лучших
  const swaps: { postId: string; c: Candidate; fit: number; gain: number }[] = []
  for (const post of POSTS) {
    const ru = cur.slots[post.id]?.ru
    if (!ru) continue
    const old = cur.roster.find((e) => e.ru === ru)
    if (!old) continue
    const best = bestFor(post.id)
    if (!best) continue
    const curFit = overallFit(old, post)
    const gain = best.fit - curFit
    if (best.c.super ? gain >= 5 : gain >= IDEAL_SWAP_GAIN) {
      swaps.push({ postId: post.id, c: best.c, fit: best.fit, gain })
    }
  }
  swaps.sort((a, b) => b.gain - a.gain)
  for (const s of swaps.slice(0, IDEAL_MAX_SWAPS)) hire(s.postId, s.c, s.fit, true)
  return cur
}

/**
 * Сравнение игрока с линией идеального управления прямо сейчас:
 * две стоимости, процент, отставание и точки для графика.
 */
export function idealCompare(game: LiveGame): IdealCompare {
  const view = idealView(game.ideal, game.labor, game.demand)
  const idealValue = liveValue(view).total
  const playerValue = liveValue(game).total
  const line: IdealLinePoint[] = [{ month: 0, player: game.startValue, ideal: game.startValue }]
  game.history.forEach((h, i) => {
    const p = game.ideal.history[i]
    line.push({ month: h.month, player: h.value, ideal: p ? p.value : h.value })
  })
  const pct = idealValue > 0 ? Math.round((playerValue / idealValue) * 100) : 100
  return { idealValue, playerValue, pct, gap: idealValue - playerValue, line, moves: game.ideal.moves }
}

/** Закрыть месяц: обороты, простой, стоимость — и время идёт дальше */
export function closeMonth(game: LiveGame): { game: LiveGame; finished: boolean } {
  const cab = liveCabinet(game)
  const pay = payroll(cab, game.roster)
  const revenue = liveRevenue(game)
  const opex = round10k(OPEX_BASE * DEMAND_MODES[game.demand].opexMult)
  const fine = liveVacancyFine(game)
  const net = revenue - pay - opex - fine
  let cash = game.cash + net

  const events: MonthEvent[] = []
  if (net >= 0) events.push({ text: `Касса пополнилась на ${fmtMoney(net)}`, kind: 'good' })
  else events.push({ text: `Месяц закрыт с дефицитом ${fmtMoney(-net)}`, kind: 'bad' })
  if (cash < 0) {
    cash = 0
    events.push({ text: 'Денег не хватило — поставщикам пообещали заплатить из будущей выручки', kind: 'bad' })
  }
  if (fine > 0) {
    const vacs = POSTS.filter((p) => !game.slots[p.id]?.ru).length
    events.push({
      text: `Простой ${vacs === 1 ? 'вакансии' : `${vacs} вакансий`} съел ${fmtMoney(fine)}`,
      kind: 'bad',
    })
  }
  if (pay > PAYROLL_BUDGET) {
    events.push({ text: `ФОТ выше бюджета: перерасход ${fmtMoney(pay - PAYROLL_BUDGET)}/мес бьёт по стоимости`, kind: 'bad' })
  }

  const prevValue = game.history.length > 0
    ? game.history[game.history.length - 1].value
    : game.startValue
  const value = liveValue(game).total
  const valueDelta = value - prevValue
  events.push({
    text: `Стоимость компании ${valueDelta >= 0 ? 'выросла' : 'просела'} на ${fmtMoney(Math.abs(valueDelta))}`,
    kind: valueDelta >= 0 ? 'good' : 'bad',
  })

  // Теневой идеал проживает этот же месяц в тех же условиях:
  // та же выручка за силу команды, тот же спрос, тот же простой
  const iView = idealView(game.ideal, game.labor, game.demand)
  const iRev = round10k(REVENUE_BASE * DEMAND_MODES[game.demand].revenueMult * livePower(iView))
  const iPay = payroll(liveCabinet(iView), game.ideal.roster)
  const iOpex = round10k(OPEX_BASE * DEMAND_MODES[game.demand].opexMult)
  const iFine = liveVacancyFine(iView)
  const idealCash = Math.max(0, game.ideal.cash + iRev - iPay - iOpex - iFine)
  const idealValue = liveValue(iView).total
  const idealPct = idealValue > 0 ? Math.round((value / idealValue) * 100) : 100
  events.push(idealPct >= 100
    ? { text: `🥇 Идеал в этих условиях: ${fmtValue(idealValue)} — вы опережаете линию идеального управления!`, kind: 'good' }
    : { text: `🥇 Идеал в этих условиях: ${fmtValue(idealValue)} — вы на ${idealPct}% от его линии`, kind: 'neutral' })

  const left = game.bench
    .map((ru) => game.roster.find((c) => c.ru === ru))
    .filter((c): c is Candidate => !!c)
    .map((c) => `${c.name} (${c.ru})`)
  if (left.length > 0) events.push({ text: `С рынка ушли: ${left.join(', ')}`, kind: 'neutral' })

  const log: MonthLog = {
    month: game.month, demand: game.demand, revenue, opex,
    payroll: pay, vacancyFine: fine, net, value, valueDelta, left, events,
  }
  const history = [...game.history, log]
  const month = game.month + 1
  const finished = month > LIVE_MONTHS

  // Кресла простаивают дальше, ушедшие кандидаты исчезают навсегда
  const slots: Record<string, SlotState> = {}
  for (const p of POSTS) {
    const s = game.slots[p.id]
    slots[p.id] = s && !s.ru
      ? { ru: null, vacantMonths: s.vacantMonths + 1 }
      : { ru: s?.ru ?? null, vacantMonths: 0 }
  }
  // У теневого идеала кресла стареют так же
  const idealSlots: Record<string, SlotState> = {}
  for (const p of POSTS) {
    const s = game.ideal.slots[p.id]
    idealSlots[p.id] = s && !s.ru
      ? { ru: null, vacantMonths: s.vacantMonths + 1 }
      : { ru: s?.ru ?? null, vacantMonths: 0 }
  }
  const idealState: IdealState = {
    cash: idealCash,
    slots: idealSlots,
    roster: game.ideal.roster,
    history: [...game.ideal.history, { month: game.month, value: idealValue }],
    moves: game.ideal.moves,
  }
  const benchRus = new Set(game.bench)
  // Сотрудники определяются по креслам — самый надёжный источник истины
  const employeeRus = new Set(
    POSTS.map((p) => slots[p.id]?.ru).filter((x): x is string => !!x),
  )
  const employeesOnly = game.roster.filter((c) => employeeRus.has(c.ru) && !benchRus.has(c.ru))
  const labor: MarketMode = finished ? game.labor : rollLabor()
  const demand: DemandMode = finished ? game.demand : rollDemand()
  const interim: LiveGame = { ...game, month, cash, labor, demand, slots, roster: employeesOnly, bench: [], history }
  const fresh = finished ? [] : newBench(interim)
  // Идеал тут же делает свои ходы в новом месяце — линия всегда на месяц впереди игрока по решениям
  const idealNext = finished
    ? idealState
    : idealMoves(idealState, fresh, labor, demand)
  const next: LiveGame = { ...interim, roster: [...employeesOnly, ...fresh], bench: fresh.map((c) => c.ru), ideal: idealNext }
  // Выход суперуправленца — событие месяца: мимо такой новости пройти нельзя
  const star = fresh.find((c) => c.super)
  if (star) {
    const post = POSTS.find((p) => p.id === star.profession)!
    next.history[next.history.length - 1].events.push({
      text: `🦸 Эталон на рынке: ${star.name} (${star.ru}) смотрит на «${post.title}» и просит ${fmtMoney(star.salary)}/мес — в 1,45 раза выше рынка. Такие бывают раз в год`,
      kind: 'good',
    })
  }
  return { game: next, finished }
}

/** Оценка года по приросту стоимости, грн */
export function liveGrade(growth: number): { word: string; note: string } {
  if (growth >= 12_000_000) return { word: 'Блестящее управление', note: 'сеть выросла заметно сильнее рынка' }
  if (growth >= 6_000_000) return { word: 'Сильный год', note: 'решения были в основном верными' }
  if (growth >= 2_000_000) return { word: 'Крепкий хозяйственник', note: 'рост есть, но запас был больше' }
  if (growth >= 0) return { word: 'Год без роста', note: 'стоимость удержали, но не продвинули' }
  if (growth >= -3_000_000) return { word: 'Стоимость просела', note: 'простой и дорогой штат съели результат' }
  return { word: 'Сеть обесценилась', note: 'такое лучше не повторять: считайте год учебным' }
}
