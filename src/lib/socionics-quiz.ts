// ============================================================
// СОЦИОНИКА — ЛОГИКА: модель А, отношения, генератор вопросов
// ------------------------------------------------------------
// Никаких таблиц «вручную»: модель А и отношения вычисляются
// из букв типа по формулам. Формулы сверены с классикой
// (см. scripts/test-socionics.ts) — так в викторине не будет
// фактических ошибок из-за опечаток в данных.
// ============================================================

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
export function label(t: SocioType, intl: boolean): string {
  return intl ? `${t.intl} „${t.intlName}“` : `${t.ru} „${t.name}“`
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

export const RELATION_INFO: Record<RelationKind, string> = {
  'дуальность': 'Самые комфортные отношения: партнёры дополняют друг друга, каждый силён там, где другой слаб.',
  'активация': 'Бодрящие отношения «напарников»: вместе легко, интересно и весело, подстёгивают друг друга.',
  'зеркальность': 'Похожие пути, разные методы: приходят к одним выводам, но идут к ним с разных сторон.',
  'квазитождество': '«Похожие противоположности»: на первый взгляд близки, но говорят словно на разных языках.',
  'конфликт': 'Самые напряжённые отношения: постоянно задевают больные точки друг друга без злого умысла.',
}

// ---------- Модель А (8 позиций) ----------
// Блоки: Эго (1-2), Супер-Эго (3-4), Супер-Ид (5-6), Ид (7-8).
//   1 базовая, 2 творческая, 3 ролевая, 4 болевая,
//   5 суггестивная, 6 активационная, 7 ограничительная, 8 демонстративная.
// Суггестивная и активационная = базовая и творческая функции дуала.

export const POSITION_NAMES: Record<number, string> = {
  1: 'базовая', 2: 'творческая', 3: 'ролевая', 4: 'болевая',
  5: 'суггестивная', 6: 'активационная', 7: 'ограничительная', 8: 'демонстративная',
}

export interface ModelAPosition { n: number; role: string; fn: FunctionId }

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
  prompt: string
  options: string[]
  correct: number
  explanation: string
  accent: QuadraId // каким квадровым цветом подсветить карточку
}

type Draft = Omit<Question, 'id' | 'correct'> & { answer: string }

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
  const wrong = distractorTypes(t, 3).map((x) => label(x, false))
  return finalize({
    topic: 'types',
    prompt: `Прочитай характеристику и угадай тип:\n\n«${t.description}»`,
    options: [label(t, false), ...wrong],
    answer: label(t, false),
    explanation: `Это ${label(t, false)} — тип квадры «${QUADRAS[t.quadra].name}». Базовая функция: ${baseFunction(t)} — ${FUNCTIONS[baseFunction(t)].name}.`,
    accent: t.quadra,
  })
}

function qNameToAbbr(): Question {
  const t = rnd(TYPES)
  const wrong = distractorTypes(t, 3).map((x) => x.ru)
  return finalize({
    topic: 'types',
    prompt: `Какая аббревиатура у типа «${t.name}»?`,
    options: [t.ru, ...wrong],
    answer: t.ru,
    explanation: `${t.name} — это ${t.ru} (${t.intl}), квадра «${QUADRAS[t.quadra].name}».`,
    accent: t.quadra,
  })
}

function qAbbrToName(): Question {
  const t = rnd(TYPES)
  const wrong = distractorTypes(t, 3).map((x) => x.name)
  return finalize({
    topic: 'types',
    prompt: `Как зовут тип ${t.ru} (${t.intl})?`,
    options: [t.name, ...wrong],
    answer: t.name,
    explanation: `${t.ru} — ${t.name}. ${t.description}`,
    accent: t.quadra,
  })
}

// --- Тема «Дихотомии» ---

function qLetterMeaning(): Question {
  const pairs = [
    { pos: 'Первая буква (И или С)', correct: 'Интуиция или сенсорика — чем воспринимает мир', wrong: ['Логика или этика — как принимает решения', 'Экстраверсия или интроверсия — откуда энергия', 'Рациональность или иррациональность — как планирует'] },
    { pos: 'Вторая буква (Л или Э)', correct: 'Логика или этика — как принимает решения', wrong: ['Интуиция или сенсорика — чем воспринимает мир', 'Экстраверсия или интроверсия — откуда энергия', 'Рациональность или иррациональность — как планирует'] },
    { pos: 'Третья буква (Э или И)', correct: 'Экстраверсия или интроверсия — откуда энергия', wrong: ['Интуиция или сенсорика — чем воспринимает мир', 'Логика или этика — как принимает решения', 'Рациональность или иррациональность — как планирует'] },
  ]
  const p = rnd(pairs)
  return finalize({
    topic: 'dichotomies',
    prompt: `${p.pos} в русской аббревиатуре типа означает...`,
    options: [p.correct, ...p.wrong],
    answer: p.correct,
    explanation: 'Русская аббревиатура: 1-я буква — И/С (интуиция/сенсорика), 2-я — Л/Э (логика/этика), 3-я — Э/И (экстраверт/интроверт). Рациональность видна в международной записи: маленькая буква j или p.',
    accent: rnd((Object.keys(QUADRAS) as QuadraId[])),
  })
}

function qCombo(): Question {
  const t = rnd(TYPES)
  const traits = (x: SocioType) =>
    `${x.ei === 'extravert' ? 'экстраверт' : 'интроверт'}, ${x.ns === 'intuition' ? 'интуит' : 'сенсорик'}, ${x.tf === 'logic' ? 'логик' : 'этик'}`
  // wrong: типы, отличающиеся ровно одной шкалой — «почти похожи»
  const wrong = [
    relationOf(t, { ei: true, ns: false, tf: false, rat: false }),
    relationOf(t, { ei: false, ns: true, tf: false, rat: false }),
    relationOf(t, { ei: false, ns: false, tf: true, rat: false }),
  ].map((x) => `${x.ru} — ${traits(x)}`)
  return finalize({
    topic: 'dichotomies',
    prompt: `Кто из типов — ${traits(t)}?`,
    options: [`${t.ru} — ${traits(t)}`, ...wrong],
    answer: `${t.ru} — ${traits(t)}`,
    explanation: `${t.ru} (${t.name}): ${traits(t)}${t.rat === 'rational' ? ', рационал' : ', иррационал'}.`,
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
    prompt: `Какой из этих типов — ${wantRational ? 'рационал' : 'иррационал'}?`,
    options: [correct.ru, ...wrong.map((x) => x.ru)],
    answer: correct.ru,
    explanation: `${correct.ru} (${correct.name}) — ${wantRational ? 'рационал' : 'иррационал'}. Рационал/иррационал определяется базовой функцией: у рационалов это логика или этика, у иррационалов — интуиция или сенсорика. В международной записи: j у рационалов, p у иррационалов.`,
    accent: correct.quadra,
  })
}

// --- Тема «Функции» ---

function qBaseFunction(): Question {
  const t = rnd(TYPES)
  const correctFn = baseFunction(t)
  const wrong = shuffle((Object.keys(FUNCTIONS) as FunctionId[]).filter((f) => f !== correctFn)).slice(0, 3)
  const fmt = (f: FunctionId) => `${f} — ${FUNCTIONS[f].name}`
  return finalize({
    topic: 'functions',
    prompt: `Какая базовая функция (1-я позиция модели А) у типа ${label(t, false)}?`,
    options: [fmt(correctFn), ...wrong.map(fmt)],
    answer: fmt(correctFn),
    explanation: `${label(t, false)}: базовая — ${fmt(correctFn)}. ${FUNCTIONS[correctFn].definition}`,
    accent: t.quadra,
  })
}

function qFunctionDef(): Question {
  const f = rnd(Object.keys(FUNCTIONS) as FunctionId[])
  const wrong = shuffle((Object.keys(FUNCTIONS) as FunctionId[]).filter((x) => x !== f)).slice(0, 3)
  const fmt = (x: FunctionId) => `${x} — ${FUNCTIONS[x].name}`
  return finalize({
    topic: 'functions',
    prompt: `Что делает функция ${f} (${FUNCTIONS[f].intl})?`,
    options: [FUNCTIONS[f].definition, ...wrong.map((x) => FUNCTIONS[x].definition)],
    answer: FUNCTIONS[f].definition,
    explanation: `${fmt(f)}: ${FUNCTIONS[f].definition}`,
    accent: rnd(Object.keys(QUADRAS) as QuadraId[]),
  })
}

function qWhoHasBase(): Question {
  const t = rnd(TYPES)
  const f = baseFunction(t)
  const others = shuffle(TYPES.filter((x) => x.ru !== t.ru && baseFunction(x) !== f)).slice(0, 3)
  return finalize({
    topic: 'functions',
    prompt: `У какого из этих типов базовая функция — ${f} (${FUNCTIONS[f].name})?`,
    options: [t.ru, ...others.map((x) => x.ru)],
    answer: t.ru,
    explanation: `${t.ru} (${t.name}) — базовая ${f}. У остальных вариантов другая базовая функция.`,
    accent: t.quadra,
  })
}

// --- Тема «Квадры» ---

function qTypeQuadra(): Question {
  const t = rnd(TYPES)
  const wrong = shuffle((Object.keys(QUADRAS) as QuadraId[]).filter((q) => q !== t.quadra)).map((q) => QUADRAS[q].name)
  return finalize({
    topic: 'quadras',
    prompt: `К какой квадре относится тип ${label(t, false)}?`,
    options: [QUADRAS[t.quadra].name, ...wrong],
    answer: QUADRAS[t.quadra].name,
    explanation: `${t.ru} (${t.name}) — квадра «${QUADRAS[t.quadra].name}»: ${QUADRAS[t.quadra].motto.toLowerCase()}.`,
    accent: t.quadra,
  })
}

function qQuadraMember(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const member = rnd(QUADRAS[q].types)
  const outsiders = shuffle(TYPES.filter((t) => t.quadra !== q)).slice(0, 3).map((t) => t.ru)
  return finalize({
    topic: 'quadras',
    prompt: `Кто из этих типов входит в квадру «${QUADRAS[q].name}»?`,
    options: [member, ...outsiders],
    answer: member,
    explanation: `Квадра «${QUADRAS[q].name}»: ${QUADRAS[q].types.join(', ')}.`,
    accent: q,
  })
}

function qQuadraOdd(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const outsider = rnd(TYPES.filter((t) => t.quadra !== q))
  const wrong = shuffle(QUADRAS[q].types).slice(0, 3)
  return finalize({
    topic: 'quadras',
    prompt: `Кто из этих типов НЕ входит в квадру «${QUADRAS[q].name}»?`,
    options: [outsider.ru, ...wrong],
    answer: outsider.ru,
    explanation: `${outsider.ru} (${outsider.name}) — из квадры «${QUADRAS[outsider.quadra].name}». А «${QUADRAS[q].name}» — это ${QUADRAS[q].types.join(', ')}.`,
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
  const fmt = (x: SocioType) => `${t.ru} и ${x.ru}`
  return finalize({
    topic: 'quadras',
    prompt: `Кто — дуал для ${t.ru} (${t.name})?`,
    options: [fmt(dual), ...wrongKinds.map(fmt)],
    answer: fmt(dual),
    explanation: `Дуал ${t.ru} — ${dual.ru} (${dual.name}). ${RELATION_INFO['дуальность']}`,
    accent: q,
  })
}

function qQuadraMotto(): Question {
  const q = rnd(Object.keys(QUADRAS) as QuadraId[])
  const wrong = shuffle((Object.keys(QUADRAS) as QuadraId[]).filter((x) => x !== q)).map((x) => QUADRAS[x].description)
  return finalize({
    topic: 'quadras',
    prompt: `Какая атмосфера у квадры «${QUADRAS[q].name}»?`,
    options: [QUADRAS[q].description, ...wrong],
    answer: QUADRAS[q].description,
    explanation: `«${QUADRAS[q].name}» — ${QUADRAS[q].motto.toLowerCase()}: ${QUADRAS[q].description} Типы: ${QUADRAS[q].types.join(', ')}.`,
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
    const others = shuffle(TYPES.filter((x) => x.ru !== partner.ru && x.ru !== t.ru)).slice(0, 3).map((x) => x.ru)
    return finalize({
      topic: 'relations',
      prompt: `Кто ${kind === 'дуальность' ? '— дуал' : kind === 'конфликт' ? '— конфликтный партнёр' : kind === 'зеркальность' ? '— зеркальный партнёр' : kind === 'активация' ? '— активатор' : '— квазитождественный партнёр'} для ${label(t, false)}?`,
      options: [partner.ru, ...others],
      answer: partner.ru,
      explanation: `${partner.ru} (${partner.name}). ${RELATION_INFO[kind]}`,
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
    prompt: `Какое отношение между типами ${t.ru} и ${partner.ru}?`,
    options: [kind, ...wrong],
    answer: kind,
    explanation: `${t.ru} и ${partner.ru} — ${kind}. ${RELATION_INFO[kind]}`,
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

export const TOPIC_LABELS: Record<Topic, string> = {
  types: 'Типы',
  dichotomies: 'Дихотомии',
  functions: 'Функции',
  quadras: 'Квадры',
  relations: 'Отношения',
  full: 'Полный курс',
}

export const TOPIC_HINTS: Record<Topic, string> = {
  types: '16 типов: кто есть кто',
  dichotomies: 'Читаем аббревиатуры',
  functions: '8 функций и модель А',
  quadras: '4 команды типов',
  relations: 'Дуалы, конфликты, зеркала',
  full: 'Всё вперемешку',
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
    if (seen.has(q.prompt)) continue
    seen.add(q.prompt)
    out.push(q)
  }
  return out
}
