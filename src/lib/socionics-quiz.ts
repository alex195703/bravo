// ============================================================
// СОЦИОНИКА — ЛОГИКА: модель А, отношения, генератор вопросов
// ------------------------------------------------------------
// Никаких таблиц «вручную»: модель А и отношения вычисляются
// из букв типа по формулам. Формулы сверены с классикой
// (см. scripts/test-socionics.ts) — так в викторине не будет
// фактических ошибок из-за опечаток в данных.
// Тексты вопросов — двуязычные поля Bi { uk, ru }.
// ============================================================

import type { Bi, Lang } from './i18n'
import {
  type SocioType, type QuadraId, type FunctionId,
  TYPES, FUNCTIONS, QUADRAS,
} from './socionics-data'

// Темы викторины; «full» = все темы вперемешку
export type Topic = 'types' | 'dichotomies' | 'functions' | 'quadras' | 'relations' | 'full'

// ---------- Поиск и подписи ----------

export function typeByRu(ru: string): SocioType {
  const t = TYPES.find((x) => x.ru === ru)
  if (!t) throw new Error(`Неизвестный тип: ${ru}`)
  return t
}

/** Как показать тип: «ИЛЭ „Дон Кихот“» или «ILE „Don Quixote“» */
export function label(t: SocioType, intl: boolean, lang: Lang = 'uk'): string {
  if (intl) return `${t.intl} „${t.intlName}“`
  return `${t.ru} „${t.name[lang]}“`
}

/** Двуязычная подпись типа: «ИЛЭ „Дон Кихот“» / «ИЛЭ „Дон Кіхот“» */
function bl(t: SocioType): Bi {
  return { uk: label(t, false, 'uk'), ru: label(t, false, 'ru') }
}

// ---------- Базовая и творческая функции ----------
// Правило: у рационального типа (рат) базовая — рациональная функция
// (логика или этика), у иррационального — иррациональная (интуиция
// или сенсорика). Вертность функции = вертность типа для базовой
// и наоборот — для творческой.

function fnOf(dim: 'intuition' | 'sensing' | 'logic' | 'ethics', extraverted: boolean): FunctionId {
  const letter = extraverted ? 'Ч' : 'Б'
  const suffix = { intuition: 'И', sensing: 'С', logic: 'Л', ethics: 'Э' }[dim]
  return (letter + suffix) as FunctionId
}

export function baseFunction(t: SocioType): FunctionId {
  const dim = t.rat === 'rational' ? t.tf : t.ns
  return fnOf(dim, t.ei === 'extravert')
}

export function creativeFunction(t: SocioType): FunctionId {
  const dim = t.rat === 'rational' ? t.ns : t.tf
  return fnOf(dim, t.ei === 'introvert')
}

// ---------- Отношения между типами ----------
// Каждый тип — это уникальная комбинация 4 дихотомий, поэтому
// «переверни такие-то шкалы — получишь партнёра по отношению».
// Все формулы симметричны: если A — дуал B, то B — дуал A.

type Dims = Pick<SocioType, 'ei' | 'ns' | 'tf' | 'rat'>

function findTypeByDims(d: Dims): SocioType {
  const t = TYPES.find(
    (x) => x.ei === d.ei && x.ns === d.ns && x.tf === d.tf && x.rat === d.rat,
  )
  if (!t) throw new Error('Тип с такими дихотомиями не найден — ошибка в данных!')
  return t
}

/** Общая формула: какие шкалы перевернуть */
function relationOf(t: SocioType, flip: { ei: boolean; ns: boolean; tf: boolean; rat: boolean }): SocioType {
  const f = <X>(v: X, flipIt: boolean, a: X, b: X): X => (flipIt ? (v === a ? b : a) : v)
  return findTypeByDims({
    ei: f(t.ei, flip.ei, 'extravert', 'introvert'),
    ns: f(t.ns, flip.ns, 'intuition', 'sensing'),
    tf: f(t.tf, flip.tf, 'logic', 'ethics'),
    rat: f(t.rat, flip.rat, 'rational', 'irrational'),
  })
}

// Дуал: меняется вертность, И↔С, Л↔Э; рациональность сохраняется
export const dualOf = (t: SocioType) =>
  relationOf(t, { ei: true, ns: true, tf: true, rat: false })

// Активатор: та же вертность, остальные шкалы наоборот
export const activatorOf = (t: SocioType) =>
  relationOf(t, { ei: false, ns: true, tf: true, rat: true })

// Зеркальный: та же И/С и Л/Э, другая вертность и рациональность
export const mirrorOf = (t: SocioType) =>
  relationOf(t, { ei: true, ns: false, tf: false, rat: true })

// Квазитождество: та же И/С, Л/Э и вертность — отличается только
// рациональность (ИЛЭ–ЛИЭ, СЭИ–ЭСИ). Пары с переворотом И↔С и Л↔Э
// при той же вертности — это суперэго-отношения, а не квази.
export const quasiOf = (t: SocioType) =>
  relationOf(t, { ei: false, ns: false, tf: false, rat: true })

// Конфликт: все четыре шкалы наоборот
export const conflictOf = (t: SocioType) =>
  relationOf(t, { ei: true, ns: true, tf: true, rat: true })

export type RelationKind = 'дуальность' | 'активация' | 'зеркальность' | 'квазитождество' | 'конфликт'

export const RELATION_INFO: Record<RelationKind, Bi> = {
  'дуальность': {
    uk: 'Найкомфортніші стосунки: партнери доповнюють одне одного, кожен сильний там, де інший слабкий.',
    ru: 'Самые комфортные отношения: партнёры дополняют друг друга, каждый силён там, где другой слаб.' },
  'активация': {
    uk: 'Бадьорі стосунки «напарників»: разом легко, цікаво і весело, підстрибують одне одного.',
    ru: 'Бодрящие отношения «напарников»: вместе легко, интересно и весело, подстёгивают друг друга.' },
  'зеркальность': {
    uk: 'Схожі шляхи, різні методи: приходять до одних висновків, але йдуть до них з різних боків.',
    ru: 'Похожие пути, разные методы: приходят к одним выводам, но идут к ним с разных сторон.' },
  'квазитождество': {
    uk: '«Схожі протилежності»: на перший погляд близькі, але говорять наче різними мовами.',
    ru: '«Похожие противоположности»: на первый взгляд близки, но говорят словно на разных языках.' },
  'конфликт': {
    uk: 'Найнапруженіші стосунки: постійно зачіпають хворі точки одне одного без злого умислу.',
    ru: 'Самые напряжённые отношения: постоянно задевают больные точки друг друга без злого умысла.' },
}

// ---------- Модель А (8 позиций) ----------
// Блоки: Эго (1-2), Супер-Эго (3-4), Супер-Ид (5-6), Ид (7-8).
//   1 базовая, 2 творческая, 3 ролевая, 4 болевая,
//   5 суггестивная, 6 активационная, 7 ограничительная, 8 демонстративная.
// Суггестивная и активационная = базовая и творческая функции дуала.

export const POSITION_NAMES: Record<number, Bi> = {
  1: { uk: 'базова', ru: 'базовая' },
  2: { uk: 'творча', ru: 'творческая' },
  3: { uk: 'рольова', ru: 'ролевая' },
  4: { uk: 'вразлива', ru: 'болевая' },
  5: { uk: 'сугестивна', ru: 'суггестивная' },
  6: { uk: 'активаційна', ru: 'активационная' },
  7: { uk: 'обмежувальна', ru: 'ограничительная' },
  8: { uk: 'спостережлива', ru: 'демонстративная' },
}

export interface ModelAPosition { n: number; role: Bi; fn: FunctionId }

export function modelA(t: SocioType): ModelAPosition[] {
  const p1 = baseFunction(t)
  const p2 = creativeFunction(t)
  // Ид (7, 8) повторяет Эго (1, 2), но меняет измерение функции:
  // базовая интуиция → ограничительная логика (ИЛЭ) и т.п.
  // Вертность при этом сохраняется.
  const vertnessOf = (fnId: FunctionId) => FUNCTIONS[fnId].vertness
  const dimOf = (fnId: FunctionId) => FUNCTIONS[fnId].dim
  const p7 = fnOf(dimOf(p2), vertnessOf(p1) === 'Ч')
  const p8 = fnOf(dimOf(p1), vertnessOf(p2) === 'Ч')
  const d = dualOf(t)
  const p5 = baseFunction(d)
  const p6 = creativeFunction(d)

  const used = new Set([p1, p2, p7, p8, p5, p6])
  const left = (Object.keys(FUNCTIONS) as FunctionId[]).filter((f) => !used.has(f))
  if (left.length !== 2) throw new Error(`Модель А сломана для ${t.ru}: остаток ${left}`)
  // Ролевая (3) — функция той же «вертности», что и сам тип;
  // болевая (4) — противоположной.
  const typeExtraverted = t.ei === 'extravert'
  const p3 = left.find((f) => (FUNCTIONS[f].vertness === 'Ч') === typeExtraverted)!
  const p4 = left.find((f) => f !== p3)!

  return [p1, p2, p3, p4, p5, p6, p7, p8].map((fn, i) => ({
    n: i + 1, role: POSITION_NAMES[i + 1], fn,
  }))
}

// ---------- Генератор вопросов викторины ----------

export interface Question {
  id: string
  topic: Exclude<Topic, 'full'>
  prompt: Bi
  options: Bi[]
  correct: number
  explanation: Bi
  accent: QuadraId // каким квадровым цветом подсветить карточку
}

type Draft = Omit<Question, 'id' | 'correct'>

// Все конструкторы вопросов возвращают вариант, где options[0] —
// правильный ответ; функция finalize перемешает варианты и
// пересчитает индекс ответа.

let qCounter = 0

function finalize(draft: Draft): Question {
  const order = shuffle([0, 1, 2, 3])
  return {
    id: `q${++qCounter}`,
    topic: draft.topic,
    prompt: draft.prompt,
    options: order.map((i) => draft.options[i]),
    correct: order.indexOf(0),
    explanation: draft.explanation,
    accent: draft.accent,
  }
}

export function shuffle<X>(arr: X[]): X[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const rnd = <X>(arr: X[]): X => arr[Math.floor(Math.random() * arr.length)]

function distractorTypes(correct: SocioType, n: number, pool?: SocioType[]): SocioType[] {
  const others = shuffle((pool ?? TYPES).filter((t) => t.ru !== correct.ru))
  return others.slice(0, n)
}

// --- Тема «Типы» ---

function qByDescription(): Question {
  const t = rnd(TYPES)
  const wrong = distractorTypes(t, 3).map((x) => bl(x))
  return finalize({
    topic: 'types',
    prompt: {
      uk: `Прочитайте характеристику і вгадайте тип:\n\n«${t.description.uk}»`,
      ru: `Прочитай характеристику и угадай тип:\n\n«${t.description.ru}»`,
    },
    options: [bl(t), ...wrong],
    explanation: {
      uk: `Це ${bl(t).uk} — тип квадри «${QUADRAS[t.quadra].name.uk}». Базова функція: ${baseFunction(t)} — ${FUNCTIONS[baseFunction(t)].name.uk}.`,
      ru: `Это ${bl(t).ru} — тип квадры «${QUADRAS[t.quadra].name.ru}». Базовая функция: ${baseFunction(t)} — ${FUNCTIONS[baseFunction(t)].name.ru}.`,
    },
    accent: t.quadra,
  })
}

function qNameToAbbr(): Question {
  const t = rnd(TYPES)
  const wrong = distractorTypes(t, 3).map((x) => ({ uk: x.ru, ru: x.ru }))
  return finalize({
    topic: 'types',
    prompt: {
      uk: `Яка абревіатура у типу «${t.name.uk}»?`,
      ru: `Какая аббревиатура у типа «${t.name.ru}»?`,
    },
    options: [{ uk: t.ru, ru: t.ru }, ...wrong],
    explanation: {
      uk: `${t.name.uk} — це ${t.ru} (${t.intl}), квадра «${QUADRAS[t.quadra].name.uk}».`,
      ru: `${t.name.ru} — это ${t.ru} (${t.intl}), квадра «${QUADRAS[t.quadra].name.ru}».`,
    },
    accent: t.quadra,
  })
}

function qAbbrToName(): Question {
  const t = rnd(TYPES)
  const wrong = distractorTypes(t, 3).map((x) => x.name)
  return finalize({
    topic: 'types',
    prompt: {
      uk: `Як звати тип ${t.ru} (${t.intl})?`,
      ru: `Как зовут тип ${t.ru} (${t.intl})?`,
    },
    options: [t.name, ...wrong],
    explanation: {
      uk: `${t.ru} — ${t.name.uk}. ${t.description.uk}`,
      ru: `${t.ru} — ${t.name.ru}. ${t.description.ru}`,
    },
    accent: t.quadra,
  })
}

// --- Тема «Дихотомии» ---

function qLetterMeaning(): Question {
  const pairs = [
    {
      pos: { uk: 'Перша літера (И або С)', ru: 'Первая буква (И или С)' },
      correct: { uk: 'Інтуїція або сенсорика — чим сприймає світ', ru: 'Интуиция или сенсорика — чем воспринимает мир' },
      wrong: [
        { uk: 'Логіка або етика — як ухвалює рішення', ru: 'Логика или этика — как принимает решения' },
        { uk: 'Екстраверсія або інтроверсія — звідки енергія', ru: 'Экстраверсия или интроверсия — откуда энергия' },
        { uk: 'Раціональність або ірраціональність — як планує', ru: 'Рациональность или иррациональность — как планирует' },
      ],
    },
    {
      pos: { uk: 'Друга літера (Л або Э)', ru: 'Вторая буква (Л или Э)' },
      correct: { uk: 'Логіка або етика — як ухвалює рішення', ru: 'Логика или этика — как принимает решения' },
      wrong: [
        { uk: 'Інтуїція або сенсорика — чим сприймає світ', ru: 'Интуиция или сенсорика — чем воспринимает мир' },
        { uk: 'Екстраверсія або інтроверсія — звідки енергія', ru: 'Экстраверсия или интроверсия — откуда энергия' },
        { uk: 'Раціональність або ірраціональність — як планує', ru: 'Рациональность или иррациональность — как планирует' },
      ],
    },
    {
      pos: { uk: 'Третя літера (Э або И)', ru: 'Третья буква (Э или И)' },
      correct: { uk: 'Екстраверсія або інтроверсія — звідки енергія', ru: 'Экстраверсия или интроверсия — откуда энергия' },
      wrong: [
        { uk: 'Інтуїція або сенсорика — чим сприймає світ', ru: 'Интуиция или сенсорика — чем воспринимает мир' },
        { uk: 'Логіка або етика — як ухвалює рішення', ru: 'Логика или этика — как принимает решения' },
        { uk: 'Раціональність або ірраціональність — як планує', ru: 'Рациональность или иррациональность — как планирует' },
      ],
    },
  ]
  const p = rnd(pairs)
  return finalize({
    topic: 'dichotomies',
    prompt: {
      uk: `${p.pos.uk} в абревіатурі типу означає...`,
      ru: `${p.pos.ru} в русской аббревиатуре типа означает...`,
    },
    options: [p.correct, ...p.wrong],
    explanation: {
      uk: 'Абревіатура типу: 1-а літера — И/С (інтуїція/сенсорика), 2-а — Л/Э (логіка/етика), 3-я — Э/И (екстраверт/інтроверт). Раціональність видно в міжнародному записі: маленька літера j або p.',
      ru: 'Русская аббревиатура: 1-я буква — И/С (интуиция/сенсорика), 2-я — Л/Э (логика/этика), 3-я — Э/И (экстраверт/интроверт). Рациональность видна в международной записи: маленькая буква j или p.',
    },
    accent: rnd((Object.keys(QUADRAS) as QuadraId[])),
  })
}

function qCombo(): Question {
  const t = rnd(TYPES)
  const traits = (x: SocioType): Bi => ({
    uk: `${x.ei === 'extravert' ? 'екстраверт' : 'інтроверт'}, ${x.ns === 'intuition' ? 'інтуїт' : 'сенсорик'}, ${x.tf === 'logic' ? 'логік' : 'етик'}`,
    ru: `${x.ei === 'extravert' ? 'экстраверт' : 'интроверт'}, ${x.ns === 'intuition' ? 'интуит' : 'сенсорик'}, ${x.tf === 'logic' ? 'логик' : 'этик'}`,
  })
  // wrong: типы, отличающиеся ровно одной шкалой — «почти похожи»
  const wrong = [
    relationOf(t, { ei: true, ns: false, tf: false, rat: false }),
    relationOf(t, { ei: false, ns: true, tf: false, rat: false }),
    relationOf(t, { ei: false, ns: false, tf: true, rat: false }),
  ].map((x) => ({ uk: `${x.ru} — ${traits(x).uk}`, ru: `${x.ru} — ${traits(x).ru}` }))
  return finalize({
    topic: 'dichotomies',
    prompt: {
      uk: `Хто з типів — ${traits(t).uk}?`,
      ru: `Кто из типов — ${traits(t).ru}?`,
    },
    options: [
      { uk: `${t.ru} — ${traits(t).uk}`, ru: `${t.ru} — ${traits(t).ru}` },
      ...wrong,
    ],
    explanation: {
      uk: `${t.ru} (${t.name.uk}): ${traits(t).uk}${t.rat === 'rational' ? ', раціонал' : ', ірраціонал'}.`,
      ru: `${t.ru} (${t.name.ru}): ${traits(t).ru}${t.rat === 'rational' ? ', рационал' : ', иррационал'}.`,
    },
    accent: t.quadra,
  })
}

function qRationality(): Question {
  const rational = TYPES.filter((t) => t.rat === 'rational')
  const irrational = TYPES.filter((t) => t.rat === 'irrational')
  const wantRational = Math.random() < 0.5
  const correct = rnd(wantRational ? rational : irrational)
  const wrong = shuffle(wantRational ? irrational : rational).slice(0, 3)
  return finalize({
    topic: 'dichotomies',
    prompt: {
      uk: `Який з цих типів — ${wantRational ? 'раціонал' : 'ірраціонал'}?`,
      ru: `Какой из этих типов — ${wantRational ? 'рационал' : 'иррационал'}?`,
    },
    options: [{ uk: correct.ru, ru: correct.ru }, ...wrong.map((x) => ({ uk: x.ru, ru: x.ru }))],
    explanation: {
      uk: `${correct.ru} (${correct.name.uk}) — ${wantRational ? 'раціонал' : 'ірраціонал'}. Раціонал/ірраціонал визначається базовою функцією: у раціоналів це логіка або етика, в ірраціоналів — інтуїція або сенсорика. У міжнародному записі: j у раціоналів, p в ірраціоналів.`,
      ru: `${correct.ru} (${correct.name.ru}) — ${wantRational ? 'рационал' : 'иррационал'}. Рационал/иррационал определяется базовой функцией: у рационалов это логика или этика, у иррационалов — интуиция или сенсорика. В международной записи: j у рационалов, p у иррационалов.`,
    },
    accent: correct.quadra,
  })
}

// --- Тема «Функции» ---

function qBaseFunction(): Question {
  const t = rnd(TYPES)
  const correctFn = baseFunction(t)
  const wrong = shuffle((Object.keys(FUNCTIONS) as FunctionId[]).filter((f) => f !== correctFn)).slice(0, 3)
  const fmt = (f: FunctionId): Bi => ({ uk: `${f} — ${FUNCTIONS[f].name.uk}`, ru: `${f} — ${FUNCTIONS[f].name.ru}` })
  return finalize({
    topic: 'functions',
    prompt: {
      uk: `Яка базова функція (1-а позиція моделі А) у типу ${bl(t).uk}?`,
      ru: `Какая базовая функция (1-я позиция модели А) у типа ${bl(t).ru}?`,
    },
    options: [fmt(correctFn), ...wrong.map(fmt)],
    explanation: {
      uk: `${bl(t).uk}: базова — ${fmt(correctFn).uk}. ${FUNCTIONS[correctFn].definition.uk}`,
      ru: `${bl(t).ru}: базовая — ${fmt(correctFn).ru}. ${FUNCTIONS[correctFn].definition.ru}`,
    },
    accent: t.quadra,
  })
}

function qFunctionDef(): Question {
  const f = rnd(Object.keys(FUNCTIONS) as FunctionId[])
  const wrong = shuffle((Object.keys(FUNCTIONS) as FunctionId[]).filter((x) => x !== f)).slice(0, 3)
  const fmt = (x: FunctionId): Bi => ({ uk: `${x} — ${FUNCTIONS[x].name.uk}`, ru: `${x} — ${FUNCTIONS[x].name.ru}` })
  return finalize({
    topic: 'functions',
    prompt: {
      uk: `Що робить функція ${f} (${FUNCTIONS[f].intl})?`,
      ru: `Что делает функция ${f} (${FUNCTIONS[f].intl})?`,
    },
    options: [FUNCTIONS[f].definition, ...wrong.map((x) => FUNCTIONS[x].definition)],
    explanation: {
      uk: `${fmt(f).uk}: ${FUNCTIONS[f].definition.uk}`,
      ru: `${fmt(f).ru}: ${FUNCTIONS[f].definition.ru}`,
    },
    accent: rnd(Object.keys(QUADRAS) as QuadraId[]),
  })
}

function qWhoHasBase(): Question {
  const t = rnd(TYPES)
  const f = baseFunction(t)
  const others = shuffle(TYPES.filter((x) => x.ru !== t.ru && baseFunction(x) !== f)).slice(0, 3)
  return finalize({
    topic: 'functions',
    prompt: {
      uk: `У якого з цих типів базова функція — ${f} (${FUNCTIONS[f].name.uk})?`,
      ru: `У какого из этих типов базовая функция — ${f} (${FUNCTIONS[f].name.ru})?`,
    },
    options: [{ uk: t.ru, ru: t.ru }, ...others.map((x) => ({ uk: x.ru, ru: x.ru }))],
    explanation: {
      uk: `${t.ru} (${t.name.uk}) — базова ${f}. В інших варіантів інша базова функція.`,
      ru: `${t.ru} (${t.name.ru}) — базовая ${f}. У остальных вариантов другая базовая функция.`,
    },
    accent: t.quadra,
  })
}

// --- Тема «Квадры» ---

function qTypeQuadra(): Question {
  const t = rnd(TYPES)
  const wrong = shuffle((Object.keys(QUADRAS) as QuadraId[]).filter((q) => q !== t.quadra)).map((q) => QUADRAS[q].name)
  return finalize({
    topic: 'quadras',
    prompt: {
      uk: `До якої квадри належить тип ${bl(t).uk}?`,
      ru: `К какой квадре относится тип ${bl(t).ru}?`,
    },
    options: [QUADRAS[t.quadra].name, ...wrong],
    explanation: {
      uk: `${t.ru} (${t.name.uk}) — квадра «${QUADRAS[t.quadra].name.uk}»: ${QUADRAS[t.quadra].motto.uk.toLowerCase()}.`,
      ru: `${t.ru} (${t.name.ru}) — квадра «${QUADRAS[t.quadra].name.ru}»: ${QUADRAS[t.quadra].motto.ru.toLowerCase()}.`,
    },
    accent: t.quadra,
  })
}

function qQuadraMember(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const member = rnd(QUADRAS[q].types)
  const outsiders = shuffle(TYPES.filter((t) => t.quadra !== q)).slice(0, 3).map((t) => ({ uk: t.ru, ru: t.ru }))
  return finalize({
    topic: 'quadras',
    prompt: {
      uk: `Хто з цих типів входить у квадру «${QUADRAS[q].name.uk}»?`,
      ru: `Кто из этих типов входит в квадру «${QUADRAS[q].name.ru}»?`,
    },
    options: [{ uk: member, ru: member }, ...outsiders],
    explanation: {
      uk: `Квадра «${QUADRAS[q].name.uk}»: ${QUADRAS[q].types.join(', ')}.`,
      ru: `Квадра «${QUADRAS[q].name.ru}»: ${QUADRAS[q].types.join(', ')}.`,
    },
    accent: q,
  })
}

function qQuadraOdd(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const outsider = rnd(TYPES.filter((t) => t.quadra !== q))
  const wrong = shuffle(QUADRAS[q].types).slice(0, 3).map((t) => ({ uk: t, ru: t }))
  return finalize({
    topic: 'quadras',
    prompt: {
      uk: `Хто з цих типів НЕ входить у квадру «${QUADRAS[q].name.uk}»?`,
      ru: `Кто из этих типов НЕ входит в квадру «${QUADRAS[q].name.ru}»?`,
    },
    options: [{ uk: outsider.ru, ru: outsider.ru }, ...wrong],
    explanation: {
      uk: `${outsider.ru} (${outsider.name.uk}) — з квадри «${QUADRAS[outsider.quadra].name.uk}». А «${QUADRAS[q].name.uk}» — це ${QUADRAS[q].types.join(', ')}.`,
      ru: `${outsider.ru} (${outsider.name.ru}) — из квадры «${QUADRAS[outsider.quadra].name.ru}». А «${QUADRAS[q].name.ru}» — это ${QUADRAS[q].types.join(', ')}.`,
    },
    accent: q,
  })
}

function qQuadraDualPair(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const member = rnd(QUADRAS[q].types)
  const t = typeByRu(member)
  const dual = dualOf(t)
  const wrongKinds = shuffle([activatorOf(t), mirrorOf(t), quasiOf(t), conflictOf(t)])
    .filter((x) => x.ru !== dual.ru)
    .slice(0, 3)
  const fmt = (x: SocioType): Bi => ({ uk: `${t.ru} і ${x.ru}`, ru: `${t.ru} и ${x.ru}` })
  return finalize({
    topic: 'quadras',
    prompt: {
      uk: `Хто — дуал для ${t.ru} (${t.name.uk})?`,
      ru: `Кто — дуал для ${t.ru} (${t.name.ru})?`,
    },
    options: [fmt(dual), ...wrongKinds.map(fmt)],
    explanation: {
      uk: `Дуал ${t.ru} — ${dual.ru} (${dual.name.uk}). ${RELATION_INFO['дуальность'].uk}`,
      ru: `Дуал ${t.ru} — ${dual.ru} (${dual.name.ru}). ${RELATION_INFO['дуальность'].ru}`,
    },
    accent: q,
  })
}

function qQuadraMotto(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const wrong = shuffle((Object.keys(QUADRAS) as QuadraId[]).filter((x) => x !== q)).map((x) => QUADRAS[x].description)
  return finalize({
    topic: 'quadras',
    prompt: {
      uk: `Яка атмосфера в квадрі «${QUADRAS[q].name.uk}»?`,
      ru: `Какая атмосфера у квадры «${QUADRAS[q].name.ru}»?`,
    },
    options: [QUADRAS[q].description, ...wrong],
    explanation: {
      uk: `«${QUADRAS[q].name.uk}» — ${QUADRAS[q].motto.uk.toLowerCase()}: ${QUADRAS[q].description.uk} Типи: ${QUADRAS[q].types.join(', ')}.`,
      ru: `«${QUADRAS[q].name.ru}» — ${QUADRAS[q].motto.ru.toLowerCase()}: ${QUADRAS[q].description.ru} Типы: ${QUADRAS[q].types.join(', ')}.`,
    },
    accent: q,
  })
}

// --- Тема «Отношения» ---

function qRelationByKind(kind: RelationKind): () => Question {
  const of: Record<RelationKind, (t: SocioType) => SocioType> = {
    'дуальность': dualOf,
    'активация': activatorOf,
    'зеркальность': mirrorOf,
    'квазитождество': quasiOf,
    'конфликт': conflictOf,
  }
  return () => {
    const t = rnd(TYPES)
    const partner = of[kind](t)
    const others = shuffle(TYPES.filter((x) => x.ru !== partner.ru && x.ru !== t.ru)).slice(0, 3)
      .map((x) => ({ uk: x.ru, ru: x.ru }))
    return finalize({
      topic: 'relations',
      prompt: {
        uk: `Хто ${kind === 'дуальность' ? '— дуал' : kind === 'конфликт' ? '— конфліктний партнер' : kind === 'зеркальность' ? '— дзеркальний партнер' : kind === 'активация' ? '— активатор' : '— квазітотожний партнер'} для ${bl(t).uk}?`,
        ru: `Кто ${kind === 'дуальность' ? '— дуал' : kind === 'конфликт' ? '— конфликтный партнёр' : kind === 'зеркальность' ? '— зеркальный партнёр' : kind === 'активация' ? '— активатор' : '— квазитождественный партнёр'} для ${bl(t).ru}?`,
      },
      options: [{ uk: partner.ru, ru: partner.ru }, ...others],
      explanation: {
        uk: `${partner.ru} (${partner.name.uk}). ${RELATION_INFO[kind].uk}`,
        ru: `${partner.ru} (${partner.name.ru}). ${RELATION_INFO[kind].ru}`,
      },
      accent: t.quadra,
    })
  }
}

function qRelationBetween(): Question {
  const t = rnd(TYPES)
  const kinds: RelationKind[] = ['дуальность', 'активация', 'зеркальность', 'квазитождество', 'конфликт']
  const kind = rnd(kinds)
  const partner = {
    'дуальность': dualOf, 'активация': activatorOf, 'зеркальность': mirrorOf,
    'квазитождество': quasiOf, 'конфликт': conflictOf,
  }[kind](t)
  const wrong = shuffle(kinds.filter((k) => k !== kind)).slice(0, 3)
  return finalize({
    topic: 'relations',
    prompt: {
      uk: `Яке ставлення між типами ${t.ru} і ${partner.ru}?`,
      ru: `Какое отношение между типами ${t.ru} и ${partner.ru}?`,
    },
    options: [{ uk: kind, ru: kind }, ...wrong.map((k) => ({ uk: k, ru: k }))],
    explanation: {
      uk: `${t.ru} і ${partner.ru} — ${kind}. ${RELATION_INFO[kind].uk}`,
      ru: `${t.ru} и ${partner.ru} — ${kind}. ${RELATION_INFO[kind].ru}`,
    },
    accent: t.quadra,
  })
}

// --- Сборка раунда ---

type Builder = () => Question

const BUILDERS: Record<Exclude<Topic, 'full'>, Builder[]> = {
  types: [qByDescription, qNameToAbbr, qAbbrToName],
  dichotomies: [qLetterMeaning, qCombo, qRationality],
  functions: [qBaseFunction, qFunctionDef, qWhoHasBase],
  quadras: [qTypeQuadra, qQuadraMember, qQuadraOdd, qQuadraDualPair, qQuadraMotto],
  relations: [qRelationByKind('дуальность'), qRelationByKind('конфликт'), qRelationByKind('зеркальность'),
    qRelationByKind('активация'), qRelationByKind('квазитождество'), qRelationBetween],
}

export const TOPIC_LABELS: Record<Topic, Bi> = {
  types: { uk: 'Типи', ru: 'Типы' },
  dichotomies: { uk: 'Дихотомії', ru: 'Дихотомии' },
  functions: { uk: 'Функції', ru: 'Функции' },
  quadras: { uk: 'Квадри', ru: 'Квадры' },
  relations: { uk: 'Стосунки', ru: 'Отношения' },
  full: { uk: 'Повний курс', ru: 'Полный курс' },
}

export const TOPIC_HINTS: Record<Topic, Bi> = {
  types: { uk: '16 типів: хто є хто', ru: '16 типов: кто есть кто' },
  dichotomies: { uk: 'Читаємо абревіатури', ru: 'Читаем аббревиатуры' },
  functions: { uk: '8 функцій і модель А', ru: '8 функций и модель А' },
  quadras: { uk: '4 команди типів', ru: '4 команды типов' },
  relations: { uk: 'Дуали, конфлікти, дзеркала', ru: 'Дуалы, конфликты, зеркала' },
  full: { uk: 'Все впереміш', ru: 'Всё вперемешку' },
}

/** Собрать раунд из 10 неповторяющихся вопросов */
export function buildRound(topic: Topic, count = 10): Question[] {
  const builders = topic === 'full'
    ? (Object.keys(BUILDERS) as Exclude<Topic, 'full'>[]).flatMap((k) => BUILDERS[k])
    : BUILDERS[topic]
  const seen = new Set<string>()
  const out: Question[] = []
  let guard = 0
  while (out.length < count && guard < count * 30) {
    guard++
    const q = rnd(builders)()
    if (seen.has(q.prompt.ru)) continue
    seen.add(q.prompt.ru)
    out.push(q)
  }
  return out
}
