// ============================================================
// СОЦИОНИКА — ДАННЫЕ (16 типов, функции, квадры, дихотомии)
// ------------------------------------------------------------
// Здесь только данные, без логики и интерфейса.
// Все факты (принадлежность к квадре, буквы дихотомий)
// заданы явно и проверяются скриптом scripts/test-socionics.ts
// ============================================================

// --- Дихотомии Юнга (4 шкалы, из которых «собран» каждый тип) ---

export type EI = 'extravert' | 'introvert' // экстраверсия / интроверсия
export type NS = 'intuition' | 'sensing'   // интуиция / сенсорика
export type TF = 'logic' | 'ethics'        // логика / этика
export type RAT = 'rational' | 'irrational' // рациональность / иррациональность

export type QuadraId = 'alpha' | 'beta' | 'gamma' | 'delta'
export type FunctionId = 'ЧИ' | 'БИ' | 'ЧС' | 'БС' | 'ЧЛ' | 'БЛ' | 'ЧЭ' | 'БЭ'

// --- 8 информационных функций (элементы модели А) ---

export interface FunctionInfo {
  id: FunctionId
  vertness: 'Ч' | 'Б' // Ч = «чёрная» (экстравертная), Б = «белая» (интровертная)
  dim: 'intuition' | 'sensing' | 'logic' | 'ethics'
  name: string       // краткое название
  intl: string       // международное обозначение
  definition: string // объяснение простыми словами
}

export const FUNCTIONS: Record<FunctionId, FunctionInfo> = {
  'ЧИ': { id: 'ЧИ', vertness: 'Ч', dim: 'intuition', name: 'интуиция возможностей', intl: 'Ne',
    definition: 'Видит потенциал, варианты и перспективы. Любит всё новое и необычное, задаётся вопросом «а что, если?»' },
  'БИ': { id: 'БИ', vertness: 'Б', dim: 'intuition', name: 'интуиция времени', intl: 'Ni',
    definition: 'Чувствует развитие событий и сроки, предвидит, «внутренние часы»: что сейчас важно, а что подождёт.' },
  'ЧС': { id: 'ЧС', vertness: 'Ч', dim: 'sensing', name: 'волевая сенсорика', intl: 'Se',
    definition: 'Сила, воля и решимость. Захватывает пространство, мобилизует, не отступает перед давлением.' },
  'БС': { id: 'БС', vertness: 'Б', dim: 'sensing', name: 'сенсорика ощущений', intl: 'Si',
    definition: 'Комфорт, самочувствие, уют. Ценит удобство, вкус, здоровье и удовольствие от момента.' },
  'ЧЛ': { id: 'ЧЛ', vertness: 'Ч', dim: 'logic', name: 'деловая логика', intl: 'Te',
    definition: 'Эффективность и польза. Понимает, как сделать дело быстро и выгодно, любит технологии и факты.' },
  'БЛ': { id: 'БЛ', vertness: 'Б', dim: 'logic', name: 'структурная логика', intl: 'Ti',
    definition: 'Системы, схемы и правила. Строит классификации, ищет точность и логическую непротиворечивость.' },
  'ЧЭ': { id: 'ЧЭ', vertness: 'Ч', dim: 'ethics', name: 'этика эмоций', intl: 'Fe',
    definition: 'Эмоциональная атмосфера. Умеет поднять настроение, воодушевить, почувствовать эмоции группы.' },
  'БЭ': { id: 'БЭ', vertness: 'Б', dim: 'ethics', name: 'этика отношений', intl: 'Fi',
    definition: 'Нравственность и дистанции. Чувствует, кто «свой», верен людям, бережёт порядочность и такт.' },
}

// --- Тип личности ---

export interface SocioType {
  ru: string       // русская аббревиатура: ИЛЭ
  intl: string     // международная: ILE
  name: string     // «Дон Кихот»
  intlName: string // Don Quixote
  quadra: QuadraId
  ei: EI
  ns: NS
  tf: TF
  rat: RAT
  description: string // короткая характеристика для вопроса «угадай тип»
}

export const TYPES: SocioType[] = [
  { ru: 'ИЛЭ', intl: 'ILE', name: 'Дон Кихот', intlName: 'Don Quixote', quadra: 'alpha',
    ei: 'extravert', ns: 'intuition', tf: 'logic', rat: 'irrational',
    description: 'Генератор идей и вечный изобретатель: видит возможности во всём, загорается новым, легко стартует и так же легко переключается.' },
  { ru: 'СЭИ', intl: 'SEI', name: 'Дюма', intlName: 'Dumas', quadra: 'alpha',
    ei: 'introvert', ns: 'sensing', tf: 'ethics', rat: 'irrational',
    description: 'Мягкий миротворец и хранитель уюта: тонко чувствует самочувствие людей, заботится, сглаживает углы, создаёт атмосферу покоя.' },
  { ru: 'ЭСЭ', intl: 'ESE', name: 'Гюго', intlName: 'Hugo', quadra: 'alpha',
    ei: 'extravert', ns: 'sensing', tf: 'ethics', rat: 'rational',
    description: 'Душа компании и эмоциональный мотор: заряжает оптимизмом, гостеприимен, помнит дни рождения и всё-всё о людях.' },
  { ru: 'ЛИИ', intl: 'LII', name: 'Робеспьер', intlName: 'Robespierre', quadra: 'alpha',
    ei: 'introvert', ns: 'intuition', tf: 'logic', rat: 'rational',
    description: 'Аналитик и системщик: строит стройные теории, ценит точность и честность, скромен, не выносит суеты и пафоса.' },

  { ru: 'СЛЭ', intl: 'SLE', name: 'Жуков', intlName: 'Zhukov', quadra: 'beta',
    ei: 'extravert', ns: 'sensing', tf: 'logic', rat: 'irrational',
    description: 'Полководец и стратег: сильная воля, расчёт сил, идёт к цели через любые препятствия и умеет вести за собой.' },
  { ru: 'ИЭИ', intl: 'IEI', name: 'Есенин', intlName: 'Yesenin', quadra: 'beta',
    ei: 'introvert', ns: 'intuition', tf: 'ethics', rat: 'irrational',
    description: 'Лирик и дипломат: тонко чувствует настроение и время, обаятелен, избегает конфликтов и грубости.' },
  { ru: 'ЭИЭ', intl: 'EIE', name: 'Гамлет', intlName: 'Hamlet', quadra: 'beta',
    ei: 'extravert', ns: 'intuition', tf: 'ethics', rat: 'rational',
    description: 'Артист и оратор: глубокие эмоции и драматизм, вдохновляет людей, чувствует их потенциал, любит эффектность.' },
  { ru: 'ЛСИ', intl: 'LSI', name: 'Максим', intlName: 'Maxim Gorky', quadra: 'beta',
    ei: 'introvert', ns: 'sensing', tf: 'logic', rat: 'rational',
    description: 'Хранитель порядка: дисциплина, системная логика, надёжность и выдержка; строго следует правилам и инструкциям.' },

  { ru: 'СЭЭ', intl: 'SEE', name: 'Наполеон', intlName: 'Napoleon', quadra: 'gamma',
    ei: 'extravert', ns: 'sensing', tf: 'ethics', rat: 'irrational',
    description: 'Лидер-практик: видит людей и ресурсы, решителен и смел, широкие жесты, любит влияние и вкусную жизнь.' },
  { ru: 'ИЛИ', intl: 'ILI', name: 'Бальзак', intlName: 'Balzac', quadra: 'gamma',
    ei: 'introvert', ns: 'intuition', tf: 'logic', rat: 'irrational',
    description: 'Стратег-прогнозист: видит подводные камни и варианты развития, ироничен, экономит силы и делает только то, что считает нужным.' },
  { ru: 'ЛИЭ', intl: 'LIE', name: 'Джек Лондон', intlName: 'Jack London', quadra: 'gamma',
    ei: 'extravert', ns: 'intuition', tf: 'logic', rat: 'rational',
    description: 'Делец-изобретатель: эффективность и выгода, новые технологии, предпринимательская жилка, умеет организовать дело.' },
  { ru: 'ЭСИ', intl: 'ESI', name: 'Драйзер', intlName: 'Dreiser', quadra: 'gamma',
    ei: 'introvert', ns: 'sensing', tf: 'ethics', rat: 'rational',
    description: 'Хранитель морали: твёрдые принципы, преданность, тонко различает «своих» и «чужих», не прощает предательства.' },

  { ru: 'ЛСЭ', intl: 'LSE', name: 'Штирлиц', intlName: 'Stirlitz', quadra: 'delta',
    ei: 'extravert', ns: 'sensing', tf: 'logic', rat: 'rational',
    description: 'Мастер-организатор: технологии и порядок в делах, надёжен и конкретен, дела говорят громче слов.' },
  { ru: 'ЭИИ', intl: 'EII', name: 'Достоевский', intlName: 'Dostoevsky', quadra: 'delta',
    ei: 'introvert', ns: 'intuition', tf: 'ethics', rat: 'rational',
    description: 'Гуманист: тонкая этика и сочувствие, верит в лучшее в людях, безупречная порядочность и терпение.' },
  { ru: 'ИЭЭ', intl: 'IEE', name: 'Гексли', intlName: 'Huxley', quadra: 'delta',
    ei: 'extravert', ns: 'intuition', tf: 'ethics', rat: 'irrational',
    description: 'Оптимист-дипломат: обаяние и любопытство, море идей и знакомых, видит интересное в каждом, не выносит рутину.' },
  { ru: 'СЛИ', intl: 'SLI', name: 'Габен', intlName: 'Gabin', quadra: 'delta',
    ei: 'introvert', ns: 'sensing', tf: 'logic', rat: 'irrational',
    description: 'Мастер-ремесленник: спокойствие и практичность, делает качественно и без спешки, ценит удобство и здравый смысл.' },
]

// --- Квадры (группы из 4 типов с общей «атмосферой») ---

export interface QuadraInfo {
  id: QuadraId
  name: string
  motto: string
  description: string
  types: string[] // русские аббревиатуры 4 типов
}

export const QUADRAS: Record<QuadraId, QuadraInfo> = {
  alpha: {
    id: 'alpha', name: 'Альфа',
    motto: 'Идеи и забота',
    description: 'Открытость новому, юмор, дружеская атмосфера. Совместно познают мир, придумывают и заботятся друг о друге.',
    types: ['ИЛЭ', 'СЭИ', 'ЭСЭ', 'ЛИИ'],
  },
  beta: {
    id: 'beta', name: 'Бета',
    motto: 'Масштаб и страсть',
    description: 'Глобальные цели, иерархия и решимость. Яркие эмоции, верность своему кругу, готовность к борьбе за большое.',
    types: ['СЛЭ', 'ИЭИ', 'ЭИЭ', 'ЛСИ'],
  },
  gamma: {
    id: 'gamma', name: 'Гамма',
    motto: 'Результат и выгода',
    description: 'Дела, эффективность, трезвый расчёт. Ценят конкретные результаты, точность оценок и честные договорённости.',
    types: ['СЭЭ', 'ИЛИ', 'ЛИЭ', 'ЭСИ'],
  },
  delta: {
    id: 'delta', name: 'Дельта',
    motto: 'Мастерство и уют',
    description: 'Надёжность и постепенное улучшение. Честный труд, комфорт без суеты, уважение к опыту и личному пространству.',
    types: ['ЛСЭ', 'ЭИИ', 'ИЭЭ', 'СЛИ'],
  },
}

// --- Дихотомии: что означают буквы ---

export interface DichotomyInfo {
  key: 'ei' | 'ns' | 'tf' | 'rat'
  letters: string      // «Э / И»
  intlLetter: string   // «E / I»
  position: string     // где стоит в аббревиатуре
  pairNames: string    // «экстраверсия и интроверсия»
  question: string     // «откуда черпает энергию»
  left: string
  right: string
  explanation: string
}

export const DICHOTOMIES: DichotomyInfo[] = [
  { key: 'ei', letters: 'Э / И', intlLetter: 'E / I', position: 'третья буква русской аббревиатуры',
    pairNames: 'экстраверсия и интроверсия', question: 'Куда направлено внимание?', left: 'Экстраверт',
    right: 'Интроверт',
    explanation: 'Экстраверт черпает энергию во внешнем мире — людях и событиях. Интроверт — во внутренних состояниях и мыслях.' },
  { key: 'ns', letters: 'И / С', intlLetter: 'N / S', position: 'первая буква русской аббревиатуры',
    pairNames: 'интуиция и сенсорика', question: 'Чем воспринимает мир?', left: 'Интуит',
    right: 'Сенсорик',
    explanation: 'Интуит видит возможности, смыслы и картину в целом. Сенсорик — конкретику: факты, ощущения, «здесь и сейчас».' },
  { key: 'tf', letters: 'Л / Э', intlLetter: 'T / F', position: 'вторая буква русской аббревиатуры',
    pairNames: 'логика и этика', question: 'Как принимает решения?', left: 'Логик',
    right: 'Этик',
    explanation: 'Логик решает через «правильно/неправильно, выгодно/невыгодно». Этик — через «хорошо/плохо для людей и отношений».' },
  { key: 'rat', letters: 'рат / иррат', intlLetter: 'j / p', position: 'маленькая буква в международной записи',
    pairNames: 'рациональность и иррациональность', question: 'Как организует жизнь?', left: 'Рационал',
    right: 'Иррационал',
    explanation: 'Рационал живёт по плану и доводит до конца. Иррационал гибко реагирует на обстоятельства, всплесками.' },
]
