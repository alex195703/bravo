// ============================================================
// ТЕСТ ФАКТОLOGY ДЛЯ СЕТИ «БРАВО»
// Запуск: bun scripts/test-bravo.ts
// Проверяет: таблицу отношений (симметрия, состав строк,
// канонические пары, направления ревизии/заказа), должности
// и пригодность (согласованность с моделью А), кадровый
// рынок (размеры, уникальность, «кто отсутствует»),
// хедхантера, автосборку, симуляцию кризисов и отчёт.
// ============================================================

import {
  TYPES, type FunctionId,
} from '../src/lib/socionics-data'
import { typeByRu, baseFunction, creativeFunction, modelA } from '../src/lib/socionics-quiz'
import {
  relationBetween, RELATION_CATEGORY, PAIR_SCORE, RELATION_INFO_14, CATEGORY_COLORS,
} from '../src/lib/relations'
import {
  POSTS, CRISES, POSITION_WEIGHTS, MARKET_MODES, CANDIDATE_TAGLINES,
  postFit, fitStars, bestPostFor, bestPostForCandidate, functionPosition,
  profFit, overallFit, WEIGHT_PROF, WEIGHT_SOC, salaryFor, normalizeCandidate,
  payroll, PAYROLL_BUDGET, EDUCATIONS, ACHIEVEMENTS, FIELD_PREMIUM, fmtMoney,
  generateMarket, rerollBench, absentTypes, autoAssemble, makeCandidate,
  simulateCrisis, cohesion, buildReport, EMPTY_TEAM,
  type Candidate, type MarketMode,
} from '../src/lib/bravo'

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++
  } else {
    failed++
    console.log(`  ✗ ${name}${detail ? ` ${detail}` : ''}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

// ---------- 1. Таблица отношений ----------

section('1) Таблица отношений: симметрия и направленность')
const RU = TYPES.map((t) => t.ru)
for (let i = 0; i < RU.length; i++) {
  for (let j = i + 1; j < RU.length; j++) {
    const ab = relationBetween(typeByRu(RU[i]), typeByRu(RU[j]))
    const ba = relationBetween(typeByRu(RU[j]), typeByRu(RU[i]))
    const ok =
      ab.kind === ba.kind &&
      ab.roleA === ba.roleB && ab.roleB === ba.roleA &&
      (ab.roleA === undefined) === (ab.kind !== 'ревизия' && ab.kind !== 'заказ')
    check(`${RU[i]} ↔ ${RU[j]} согласовано`, ok, `— ${JSON.stringify(ab)} / ${JSON.stringify(ba)}`)
  }
}

section('2) Состав строки: 11 симметричных + ревизия/заказ по двое')
for (const t of TYPES) {
  const counts = new Map<string, Set<string>>()
  for (const other of TYPES) {
    if (other.ru === t.ru) continue
    const rel = relationBetween(t, other)
    if (!counts.has(rel.kind)) counts.set(rel.kind, new Set())
    counts.get(rel.kind)!.add(rel.roleA ?? '—')
  }
  const symmetricOk = ['дуальность', 'активация', 'зеркальность', 'родственные',
    'полудуальность', 'деловые', 'мираж', 'суперэго', 'квазитождество', 'погашение', 'конфликт']
    .every((k) => counts.get(k)?.size === 1)
  const revOk = counts.get('ревизия')?.size === 2 &&
    counts.get('ревизия')!.has('ревизор') && counts.get('ревизия')!.has('подревизный')
  const zakOk = counts.get('заказ')?.size === 2 &&
    counts.get('заказ')!.has('заказчик') && counts.get('заказ')!.has('подзаказный')
  check(`${t.ru}: состав строки верен`, symmetricOk && revOk && zakOk)
}

section('3) Канонические пары')
const canonical: [string, string, string][] = [
  ['ИЛЭ', 'СЭИ', 'дуальность'], ['ЭСЭ', 'ЛИИ', 'дуальность'], ['ЭИЭ', 'ЛСИ', 'дуальность'],
  ['СЛЭ', 'ИЭИ', 'дуальность'], ['СЭЭ', 'ИЛИ', 'дуальность'], ['ЛИЭ', 'ЭСИ', 'дуальность'],
  ['ЛСЭ', 'ЭИИ', 'дуальность'], ['ИЭЭ', 'СЛИ', 'дуальность'],
  ['ИЛЭ', 'ЭСЭ', 'активация'], ['СЭИ', 'ЛИИ', 'активация'], ['СЭЭ', 'ЛИЭ', 'активация'],
  ['ЛСЭ', 'ИЭЭ', 'активация'], ['ИЭИ', 'ИЛИ', 'родственные'], ['ЛСИ', 'СЛЭ', 'зеркальность'],
  ['ИЛЭ', 'ЛИИ', 'зеркальность'], ['СЭИ', 'ЭСЭ', 'зеркальность'],
  ['ИЛЭ', 'ЭСИ', 'конфликт'], ['СЭИ', 'ЛИЭ', 'конфликт'], ['ЭСЭ', 'ИЛИ', 'конфликт'],
  ['ЛИИ', 'СЭЭ', 'конфликт'], ['ЭИЭ', 'СЛИ', 'конфликт'], ['ЛСИ', 'ИЭЭ', 'конфликт'],
  ['СЛЭ', 'ЭИИ', 'конфликт'], ['ИЭИ', 'ЛСЭ', 'конфликт'],
  ['ИЛЭ', 'ЛИЭ', 'квазитождество'], ['СЭИ', 'ЭСИ', 'квазитождество'], ['ЛСИ', 'СЛИ', 'квазитождество'],
  ['СЛЭ', 'ЛСЭ', 'квазитождество'], ['ИЭИ', 'ЭИИ', 'квазитождество'], ['ЭСЭ', 'СЭЭ', 'квазитождество'],
  ['ИЛЭ', 'ИЭЭ', 'родственные'], ['СЭИ', 'СЛИ', 'родственные'], ['ЛИИ', 'ЛСИ', 'родственные'],
  ['ИЛЭ', 'СЛЭ', 'деловые'], ['ЭСЭ', 'ЛСЭ', 'деловые'], ['ЛСИ', 'ЭСИ', 'деловые'],
  ['ИЛЭ', 'ИЭИ', 'мираж'], ['СЭИ', 'СЛЭ', 'мираж'], ['СЭЭ', 'СЛИ', 'мираж'],
  ['ИЛЭ', 'СЭЭ', 'суперэго'], ['СЭИ', 'ИЛИ', 'суперэго'], ['ЭСЭ', 'ЛИЭ', 'суперэго'],
  ['ИЛЭ', 'ИЛИ', 'погашение'], ['СЛЭ', 'СЛИ', 'погашение'],
  ['ИЛЭ', 'СЛИ', 'полудуальность'], ['ЭСЭ', 'ЛСИ', 'полудуальность'],
  ['ИЛЭ', 'ЛСИ', 'ревизия'], ['ЭИИ', 'ИЛЭ', 'ревизия'], ['ЭСИ', 'СЛЭ', 'ревизия'],
  ['ИЛЭ', 'ЭИЭ', 'заказ'], ['ЛСЭ', 'ИЛЭ', 'заказ'], ['СЭЭ', 'ЛСЭ', 'заказ'],
]
for (const [a, b, kind] of canonical) {
  const rel = relationBetween(typeByRu(a), typeByRu(b))
  check(`${a} — ${b}: ${kind}`, rel.kind === kind, `— получили ${rel.kind}`)
}

section('4) Справочники отношений заполнены')
check('14 видов отношений имеют описания', Object.keys(RELATION_INFO_14).length === 14)
check('14 видов отношений имеют категории', Object.keys(RELATION_CATEGORY).length === 14)
check('14 видов отношений имеют очки пары', Object.keys(PAIR_SCORE).length === 14)
check('3 категории имеют цвета', Object.keys(CATEGORY_COLORS).length === 3)

// ---------- 5. Должности и пригодность ----------

section('5) Должности сети «Браво»')
check('должностей ровно 8', POSTS.length === 8)
check('id должностей уникальны', new Set(POSTS.map((p) => p.id)).size === 8)
check('первичная и вторичная функции различаются', POSTS.every((p) => p.primary !== p.secondary))
check('у каждой должности есть сфера для резюме', POSTS.every((p) => p.field.length > 0))
check('сферы должностей уникальны', new Set(POSTS.map((p) => p.field)).size === 8)
check('достижения есть для каждой сферы (по 2+ варианта)',
  POSTS.every((p) => (ACHIEVEMENTS[p.id] ?? []).length >= 2 && ACHIEVEMENTS[p.id].every((a) => a.length > 5)))
const primaries = new Set(POSTS.map((p) => p.primary))
check('как минимум 6 разных функций среди первичных', primaries.size >= 6,
  `— ${[...primaries].join(',')}`)

section('6) Пригодность согласована с моделью А')
for (const post of POSTS) {
  for (const t of TYPES) {
    const pos1 = functionPosition(t, post.primary)
    const pos2 = functionPosition(t, post.secondary)
    const expected = Math.round(0.7 * POSITION_WEIGHTS[pos1] + 0.3 * POSITION_WEIGHTS[pos2])
    check(`${t.ru} → ${post.id}: ${expected}`, postFit(t, post) === expected)
  }
}

section('7) Специалисты с функцией в блоке Эго доминируют на своей должности')
for (const post of POSTS) {
  const ego = TYPES.filter((t) =>
    baseFunction(t) === post.primary || creativeFunction(t) === post.primary)
  const fits = TYPES.map((t) => ({ ru: t.ru, fit: postFit(t, post) }))
    .sort((a, b) => b.fit - a.fit)
  const egoSet = new Set(ego.map((t) => t.ru))
  const others = fits.filter((f) => !egoSet.has(f.ru))
  const bestEgo = Math.max(...ego.map((t) => postFit(t, post)))
  const avgEgo = ego.reduce((s, t) => s + postFit(t, post), 0) / ego.length
  const avgOther = others.reduce((s, f) => s + f.fit, 0) / others.length
  check(`${post.id}: лучший кандидат — носитель ${post.primary} в Эго`,
    egoSet.has(fits[0].ru), `— топ-1: ${fits[0].ru} ${fits[0].fit}%`)
  check(`${post.id}: среднее по Эго выше среднего по остальным`,
    avgEgo > avgOther, `— ${Math.round(avgEgo)} vs ${Math.round(avgOther)}`)
  check(`${post.id}: лучший из Эго (${Math.round(bestEgo)}%) выше лучшего из остальных (${others[0].fit}%)`,
    bestEgo > others[0].fit)
}

section('8) Точечные значения пригодности (якоря)')
check('ЛИЭ → коммерческий = 100% ЧЛ + вес ЧИ',
  postFit(typeByRu('ЛИЭ'), POSTS.find((p) => p.id === 'com')!) ===
    Math.round(0.7 * 100 + 0.3 * POSITION_WEIGHTS[functionPosition(typeByRu('ЛИЭ'), 'ЧИ')]))
check('ЛСИ → финансовый = 100% БЛ + вес ЧЛ',
  postFit(typeByRu('ЛСИ'), POSTS.find((p) => p.id === 'fin')!) ===
    Math.round(0.7 * 100 + 0.3 * POSITION_WEIGHTS[functionPosition(typeByRu('ЛСИ'), 'ЧЛ')]))
check('звёзды: 94→★★★, 60→★★, 40→★, 20→·',
  fitStars(94) === '★★★' && fitStars(60) === '★★' && fitStars(40) === '★' && fitStars(20) === '·')
check('bestPostFor у ЛСИ — финансовый или логистика (БЛ в базе)',
  ['fin', 'log'].includes(bestPostFor(typeByRu('ЛСИ')).post.id))

// ---------- 8а. Профессиональное досье: компетенции прежде психологии ----------

section('8а) Профпригодность: сфера, стаж, образование')
const finPost = POSTS.find((p) => p.id === 'fin')!
const itPost = POSTS.find((p) => p.id === 'it')!
const strong: Candidate = {
  ru: 'ЛСИ', name: 'Тестовый ЛСИ', age: 45, years: 20,
  profession: 'fin', education: 'MBA', achievement: 'тест', salary: 0, tagline: '',
}
check('финансист с MBA и стажем 20 лет: профпригодность к финансам = 62+18+10 = 90',
  profFit(strong, finPost) === 90, `— ${profFit(strong, finPost)}`)
check('тот же профессионал в IT (не его сфера): 22+18+10 = 50',
  profFit(strong, itPost) === 50, `— ${profFit(strong, itPost)}`)
const junior: Candidate = {
  ru: 'ИЛЭ', name: 'Тестовый ИЛЭ', age: 26, years: 1,
  profession: 'mkt', education: 'Профкурсы', achievement: 'тест', salary: 0, tagline: '',
}
check('новичок с профкурсами не в своей сфере: 22+0.9+2 = 25',
  profFit(junior, finPost) === 25, `— ${profFit(junior, finPost)}`)

section('8б) Итоговый рейтинг: 65% профпригодность + 35% соционика')
check('веса заданы константами', WEIGHT_PROF === 0.65 && WEIGHT_SOC === 0.35)
for (const post of POSTS) {
  for (const cand of [strong, junior]) {
    const expected = Math.round(WEIGHT_PROF * profFit(cand, post) + WEIGHT_SOC * postFit(typeByRu(cand.ru), post))
    check(`${cand.ru} (${cand.profession}) → ${post.id}: итог ${expected}`,
      overallFit(cand, post) === expected, `— ${overallFit(cand, post)}`)
  }
}
check('профпригодность сильнее влияет, чем соционика: специалист выше в своей сфере, чем где-либо ещё',
  overallFit(strong, finPost) > overallFit(strong, itPost))
check('bestPostForCandidate у финансиста-ЛСИ — финансы',
  bestPostForCandidate(strong).post.id === 'fin')

section('8в) Зарплатные ожидания и ФОТ (гривна, калибровка по Work.ua)')
check('зарплата растёт с профпригодностью и стажем',
  salaryFor(90, 20) > salaryFor(60, 5) && salaryFor(60, 5) > salaryFor(60, 1))
check('зарплата в разумных пределах 30–130 тыс. грн (без надбавки)',
  salaryFor(10, 1) >= 30_000 && salaryFor(98, 25) <= 130_000)
check('бюджет ФОТ задан: 800 тыс. грн/мес', PAYROLL_BUDGET === 800_000)
check('калибровка: медианный кандидат ≈ 78 тыс. грн (медиана комдиректора по Work.ua, окт. 2025)',
  salaryFor(62, 10) === 78_000, `— ${salaryFor(62, 10)}`)
check('калибровка: медианный финдир ≈ 88 тыс. грн (Work.ua 85 тыс. + ожидаемая надбавка)',
  salaryFor(62, 10, 'fin') === 88_000, `— ${salaryFor(62, 10, 'fin')}`)
check('рыночная надбавка: IT дороже среднего, качество дешевле',
  salaryFor(80, 15, 'it') > salaryFor(80, 15) && salaryFor(80, 15) > salaryFor(80, 15, 'qa'))
check('надбавки есть для всех 8 сфер и в границах 0.85–1.2',
  POSTS.every((p) => FIELD_PREMIUM[p.id] >= 0.85 && FIELD_PREMIUM[p.id] <= 1.2))
check('fmtMoney: «786 тыс. грн» / «1,20 млн грн»',
  fmtMoney(786_000) === '786 тыс. грн' && fmtMoney(1_200_000) === '1,20 млн грн',
  `— ${fmtMoney(786_000)}, ${fmtMoney(1_200_000)}`)
{
  const pool = generateMarket('plenty')
  const team = autoAssemble(pool)
  const pay = payroll(team, pool)
  const manual = POSTS.reduce((s, p) => s + (pool.find((c) => c.ru === team[p.id])?.salary ?? 0), 0)
  check('ФОТ команды = сумма зарплат нанятых', pay === manual, `— ${pay} vs ${manual}`)
  check('образования кандидатов — из справочника',
    pool.every((c) => EDUCATIONS.some((e) => e.text === c.education)))
}

// ---------- 9. Кадровый рынок ----------

section('9) Кадровый рынок: размеры, уникальность, подмножество 16 типов')
const allRu = new Set(TYPES.map((t) => t.ru))
const droughtSeen = new Set<string>()
for (let iter = 0; iter < 300; iter++) {
  for (const mode of Object.keys(MARKET_MODES) as MarketMode[]) {
    const pool = generateMarket(mode)
    check(`[iter ${iter}] ${mode}: ровно ${MARKET_MODES[mode].size} кандидатов`,
      pool.length === MARKET_MODES[mode].size, `— ${pool.length}`)
    check(`[iter ${iter}] ${mode}: типы не повторяются`, new Set(pool.map((c) => c.ru)).size === pool.length)
    check(`[iter ${iter}] ${mode}: все типы существуют`, pool.every((c) => allRu.has(c.ru)))
    check(`[iter ${iter}] ${mode}: у всех есть имя, возраст, стаж, резюме`,
      pool.every((c) => c.name.length > 0 && c.age >= 26 && c.age <= 55 && c.years >= 1 && c.tagline.length > 0))
    check(`[iter ${iter}] ${mode}: профессиональное досье заполнено`,
      pool.every((c) => POSTS.some((p) => p.id === c.profession) &&
        EDUCATIONS.some((e) => e.text === c.education) &&
        c.achievement.length > 5 && ACHIEVEMENTS[c.profession].includes(c.achievement)))
    check(`[iter ${iter}] ${mode}: зарплата и профпригодность в границах (грн)`,
      pool.every((c) => c.salary >= 28_000 && c.salary <= 150_000 && c.cur === 'uah' &&
        POSTS.every((p) => profFit(c, p) >= 10 && profFit(c, p) <= 98)))
    check(`[iter ${iter}] ${mode}: отсутствуют ровно 16 − size`,
      absentTypes(pool).length === 16 - pool.length)
    if (mode === 'drought') pool.forEach((c) => droughtSeen.add(c.ru))
  }
}
check('за 300 итераций «голодного» рынка каждый тип побывал в кадрах хотя бы раз',
  droughtSeen.size === 16, `— видели ${droughtSeen.size} из 16`)

section('10) Строки резюме есть для всех 16 типов')
check('резюме заполнены для всех типов', TYPES.every((t) => (CANDIDATE_TAGLINES[t.ru] ?? '').length > 5))
const c1 = makeCandidate(typeByRu('ЛИЭ'))
check('makeCandidate: возраст 26–55, стаж ≥ 1', c1.age >= 26 && c1.age <= 55 && c1.years >= 1 && c1.ru === 'ЛИЭ')
check('makeCandidate: досье заполнено (сфера, образование, достижение, зарплата в грн)',
  POSTS.some((p) => p.id === c1.profession) && c1.education.length > 0 &&
  c1.achievement.length > 5 && c1.salary >= 30_000 && c1.cur === 'uah')
{
  const stripped = { ru: 'ЛСИ', name: 'Старое сохранение', age: 40, years: 12, tagline: 'тест' } as unknown as Candidate
  const fixed = normalizeCandidate(stripped)
  check('normalizeCandidate дозаполняет старые сохранения (стаж 12 сохранён, гривна проставлена)',
    POSTS.some((p) => p.id === fixed.profession) && fixed.education.length > 0 &&
    fixed.achievement.length > 5 && fixed.salary >= 30_000 && fixed.years === 12 && fixed.cur === 'uah')
  // Миграция «рублёвой эпохи»: зарплата без cur пересчитывается по гривневой шкале
  const rubleEra = {
    ru: 'ЛСИ', name: 'Рублёвое сохранение', age: 40, years: 12, profession: 'fin',
    education: 'Профильный вуз', achievement: ACHIEVEMENTS.fin[0], salary: 165_000, tagline: 'тест',
  } as unknown as Candidate
  const reprice = normalizeCandidate(rubleEra)
  const finPost = POSTS.find((p) => p.id === 'fin')!
  const expected = salaryFor(profFit(reprice, finPost), 12, 'fin')
  check('normalizeCandidate пересчитывает рублёвую зарплату в гривну',
    reprice.cur === 'uah' && reprice.salary === expected && reprice.salary < 165_000,
    `— ${reprice.salary} (ожидалось ${expected})`)
  // А украинская зарплата не трогается
  const uahEra = { ...rubleEra, salary: 99_000, cur: 'uah' as const }
  check('normalizeCandidate не трогает украинскую зарплату',
    normalizeCandidate(uahEra).salary === 99_000)
  check('normalizeCandidate не трогает полное досье', normalizeCandidate(c1) === c1)
}

section('11) Хедхантер: заменяет только незанятых, без дублей')
{
  const pool = generateMarket('normal')
  const team = { ...EMPTY_TEAM }
  // нанимаем 8, оставляем 2 в запасе
  const hired = pool.slice(0, 8).map((c) => c.ru)
  POSTS.forEach((p, i) => { team[p.id] = hired[i] })
  const next = rerollBench(pool, team)
  check('размер рынка не изменился', next.length === pool.length)
  check('типы по-прежнему уникальны', new Set(next.map((c) => c.ru)).size === next.length)
  check('нанятые сотрудники не тронуты', hired.every((ru) => next.some((c) => c.ru === ru)))
  const replaced = pool.filter((c) => !next.some((n) => n.ru === c.ru))
  const added = next.filter((c) => !pool.some((p) => p.ru === c.ru))
  check('заменили ровно 2 запасных', replaced.length === 2 && added.length === 2,
    `— убрано ${replaced.length}, добавлено ${added.length}`)
  check('новые типы ранее на рынке не встречались',
    added.every((c) => !pool.some((p) => p.ru === c.ru) && !hired.includes(c.ru)))
  check('повторный вызов не меняет (флаг в UI), функция всё ещё корректна',
    rerollBench(next, team).length === next.length)
}

// ---------- 12. Автосборка ----------

section('12) Автосборка из пула')
{
  const pool = generateMarket('plenty')
  const team = autoAssemble(pool)
  check('все 8 должностей закрыты', POSTS.every((p) => team[p.id]))
  const hired = POSTS.map((p) => team[p.id]!)
  check('каждый кандидат нанят не более одного раза', new Set(hired).size === 8)
  check('все наняты из пула', hired.every((ru) => pool.some((c) => c.ru === ru)))
  // Голодный режим: пул ровно 8 — тоже все закрыты
  for (let iter = 0; iter < 100; iter++) {
    const small = generateMarket('drought')
    const smallTeam = autoAssemble(small)
    if (!POSTS.every((p) => smallTeam[p.id])) {
      check('голодный рынок: все 8 закрыты (100 итераций)', false, `— итерация ${iter}`)
      break
    }
    if (iter === 99) check('голодный рынок: все 8 закрыты (100 итераций)', true)
  }
  // Автосборка максимизирует итоговый рейтинг (проф + соц)
  const autoFit = POSTS.reduce((s, p) => {
    const cand = pool.find((c) => c.ru === team[p.id])!
    return s + overallFit(cand, p)
  }, 0)
  const worstFit = POSTS.reduce((s, p, i) => s + overallFit(pool[(i + 3) % pool.length], p), 0)
  check('автосборка лучше сдвинутой случайной (по итоговому рейтингу)', autoFit > worstFit,
    `— ${autoFit} vs ${worstFit}`)
}

// ---------- 13. Кризисы ----------

section('13) Бизнес-кризисы: структура и симуляция')
check('кризисов ровно 8', CRISES.length === 8)
check('id кризисов уникальны', new Set(CRISES.map((c) => c.id)).size === 8)
check('все задействованные должности существуют',
  CRISES.every((c) => c.involved.every((id) => POSTS.some((p) => p.id === id))))
check('каждая должность задействована минимум в двух кризисах',
  POSTS.every((p) => CRISES.filter((c) => c.involved.includes(p.id)).length >= 2))
check('в требованиях только реальные функции',
  CRISES.every((c) => Object.keys(c.demands).every((fn) =>
    ['ЧИ', 'БИ', 'ЧС', 'БС', 'ЧЛ', 'БЛ', 'ЧЭ', 'БЭ'].includes(fn))))
{
  const pool = generateMarket('plenty')
  const team = autoAssemble(pool)
  const teamRu = POSTS.map((p) => team[p.id]!)
  const results = CRISES.map((c) => simulateCrisis(team, c))
  check('полная команда: очки в диапазоне 3–100', results.every((r) => r.score >= 3 && r.score <= 100))
  const emptyResult = simulateCrisis({ ...EMPTY_TEAM }, CRISES[0])
  check('пустая команда: минимальные очки', emptyResult.score === 3)
  check('пустая команда: штраф за вакансии = 30 (3 задействованные должности)',
    emptyResult.emptyPenalty === 30)
  // Вклады: у каждого требования нашёлся носитель, указана профпригодность
  const full = simulateCrisis(team, CRISES[0], pool)
  check('вклады соответствуют числу требований', full.contributions.length === Object.keys(CRISES[0].demands).length)
  check('вклады содержат силу функции и профпригодность',
    full.contributions.every((c) => c.fnWeight > 0 && c.prof >= 10 && c.prof <= 98))
  // Вклад профессионализма: тот же состав типов, но более сильные досье — очки выше
  const strongPool: Candidate[] = teamRu.map((ru) => ({
    ru, name: `Про ${ru}`, age: 45, years: 20,
    profession: POSTS.find((p) => team[p.id] === ru)!.id,
    education: 'MBA', achievement: 'тест', salary: 110_000, tagline: '',
  }))
  const weakPool: Candidate[] = teamRu.map((ru, i) => ({
    ru, name: `Новичок ${ru}`, age: 26, years: 1,
    profession: POSTS[(i + 3) % POSTS.length].id,
    education: 'Профкурсы', achievement: 'тест', salary: 40_000, tagline: '',
  }))
  const strongScores = CRISES.map((c) => simulateCrisis(team, c, strongPool).score)
  const weakScores = CRISES.map((c) => simulateCrisis(team, c, weakPool).score)
  check('профессионалы решают кризисы лучше новичков при том же составе типов',
    strongScores.every((s, i) => s >= weakScores[i]) && strongScores.some((s, i) => s > weakScores[i]),
    `— ${strongScores.join(',')} vs ${weakScores.join(',')}`)
  // Конфликтная пара в задействованных должностях понижает очки
  const conflictTeam = { ...EMPTY_TEAM }
  conflictTeam.com = 'ИЛЭ'  // Дон Кихот
  conflictTeam.log = 'ЭСИ'  // Драйзер — конфликтёр ИЛЭ
  conflictTeam.qa = 'СЛЭ'
  const withConflict = simulateCrisis(conflictTeam, CRISES[0])
  check('конфликт внутри задействованных должностей даёт отрицательную поправку',
    withConflict.relationPenalty < 0, `— ${withConflict.relationPenalty}`)
}

// ---------- 14. Сплочённость и отчёт ----------

section('14) Сплочённость и итоговый отчёт')
check('пустая команда: сплочённость 50', cohesion({ ...EMPTY_TEAM }) === 50)
{
  const dualTeam: Record<string, string | null> = { ...EMPTY_TEAM, com: 'ЛИЭ', fin: 'ЭСИ' } // дуалы
  const conflictTeam: Record<string, string | null> = { ...EMPTY_TEAM, com: 'ИЛЭ', fin: 'ЭСИ' } // конфликт
  check('дуальная пара: сплочённость 53', cohesion(dualTeam) === 53)
  check('конфликтная пара: сплочённость 48 (47.5 с округлением вверх)', cohesion(conflictTeam) === 48)

  const pool = generateMarket('normal')
  const team = autoAssemble(pool)
  const results: Record<string, ReturnType<typeof simulateCrisis>> = {}
  for (const c of CRISES) results[c.id] = simulateCrisis(team, c, pool)
  const rep = buildReport(team, results, {
    mode: 'normal', poolSize: pool.length, absent: absentTypes(pool), benchCount: pool.length - 8,
  }, pool)
  check('ранг из диапазона S–D', ['S', 'A', 'B', 'C', 'D'].includes(rep.rank))
  const expectedPenalty = rep.payrollOver > 0 ? Math.min(10, Math.round(rep.payrollOver / 2)) : 0
  check('overall = 0.5×кризисы + 0.25×итог назначений + 0.25×сплочённость − штраф за ФОТ',
    rep.overall === Math.max(0, Math.min(100,
      Math.round(0.5 * rep.avgCrisis + 0.25 * rep.avgFit + 0.25 * rep.cohesionValue) - expectedPenalty)),
    `— ${rep.overall}, ФОТ +${rep.payrollOver}%`)
  check('средняя профпригодность посчитана по пулу',
    rep.avgProf === Math.round(POSTS.reduce((s, p) => s + profFit(pool.find((c) => c.ru === team[p.id])!, p), 0) / 8))
  check('ФОТ в отчёте совпадает с суммой зарплат', rep.payroll === payroll(team, pool))
  check('кадровый контекст сохранён', rep.mode === 'normal' && rep.poolSize === pool.length &&
    rep.benchCount === pool.length - 8)
  check('отсутствующие типы в отчёте совпадают с рынком',
    JSON.stringify([...(rep.absent ?? [])].sort()) === JSON.stringify(absentTypes(pool).sort()))
  check('сильные стороны и риски не пусты', rep.strengths.length > 0 && rep.risks.length > 0)

  const noCrisisRep = buildReport(team, {})
  check('без кризисов отчёт строится', noCrisisRep.avgCrisis === 0 && noCrisisRep.rank === 'D')

  // Одна квадра — риск слепых зон
  const betaPool: Candidate[] = ['СЛЭ', 'ИЭИ', 'ЭИЭ', 'ЛСИ', 'СЛЭ', 'ИЭИ', 'ЭИЭ', 'ЛСИ'].map((ru) => ({
    ru, name: `Кандидат ${ru}`, age: 35, years: 10,
    profession: bestPostFor(typeByRu(ru)).post.id, education: 'Профильный вуз',
    achievement: 'тест', salary: 80_000, tagline: 'тест',
  }))
  const betaTeam = autoAssemble(betaPool)
  const betaRep = buildReport(betaTeam, {})
  check('команда из одной квадры помечена как риск',
    betaRep.risks.some((r) => r.includes('одной квадры')), `— ${betaRep.risks.join(' | ')}`)

  // Две оси найма: сильные досье дают комплимент профпригодности
  // (команда собирается вручную: каждый — в своей профессиональной сфере)
  const proTypes = ['ЛИЭ', 'ЭСИ', 'ЛСИ', 'СЛЭ', 'ИЭИ', 'ИЛИ', 'ЭИЭ', 'СЛИ']
  const proPool: Candidate[] = proTypes.map((ru, i) => ({
    ru, name: `Про ${ru}`, age: 45, years: 20,
    profession: POSTS[i]!.id, education: 'MBA',
    achievement: 'тест', salary: 90_000, tagline: '',
  }))
  const proTeam: Record<string, string | null> = { ...EMPTY_TEAM }
  POSTS.forEach((p, i) => { proTeam[p.id] = proTypes[i] })
  const proRep = buildReport(proTeam, {}, undefined, proPool)
  check('профессионально сильная команда отмечена в отчёте',
    proRep.avgProf === 90 && proRep.strengths.some((s) => s.includes('рациональн')),
    `— avgProf ${proRep.avgProf}`)

  // …а слабые досье (не в своей сфере, без образования) — предупреждение
  const weakRep = buildReport(proTeam, {}, undefined, proPool.map((c, i) => ({
    ...c, years: 1, education: 'Профкурсы', profession: POSTS[(i + 3) % POSTS.length].id,
  })))
  check('низкий профуровень отмечен как риск',
    weakRep.avgProf < 55 && weakRep.risks.some((r) => r.includes('Профессиональный уровень невысок')),
    `— avgProf ${weakRep.avgProf}`)

  // ФОТ выше бюджета — риск и штраф к overall
  const expensivePool: Candidate[] = proPool.map((c) => ({ ...c, salary: 114_000 }))
  const expensiveRep = buildReport(proTeam, {}, undefined, expensivePool)
  check('перерасход ФОТ замечен (8×114 тыс. = 912 тыс. при бюджете 800 тыс.)',
    expensiveRep.payrollOver === 14, `— ${expensiveRep.payrollOver}%`)
  check('риск про ФОТ сформулирован', expensiveRep.risks.some((r) => r.includes('ФОТ')))
  check('штраф за ФОТ уменьшает overall на 7 очков',
    expensiveRep.overall === Math.max(0, Math.min(100,
      Math.round(0.5 * expensiveRep.avgCrisis + 0.25 * expensiveRep.avgFit + 0.25 * expensiveRep.cohesionValue) - 7)))
}

// ---------- 15. Режимы рынка ----------

section('15) Режимы рынка заданы корректно')
check('три режима', Object.keys(MARKET_MODES).length === 3)
check('изобилие 12 / обычный 10 / голод 8',
  MARKET_MODES.plenty.size === 12 && MARKET_MODES.normal.size === 10 && MARKET_MODES.drought.size === 8)
check('все режимы с подписями', Object.values(MARKET_MODES).every((m) => m.label.length > 0 && m.hint.length > 0))
check('весовые коэффициенты позиций модели А на месте',
  POSITION_WEIGHTS[1] === 100 && POSITION_WEIGHTS[2] === 80 && POSITION_WEIGHTS[4] === 5)

// ---------- Итог ----------

console.log(`\n==========================================`)
console.log(`Пройдено: ${passed}, провалено: ${failed}`)
console.log(failed === 0 ? '✅ ВСЕ ПРОВЕРКИ ПРОШЛИ' : '❌ ЕСТЬ ОШИБКИ')
process.exit(failed === 0 ? 0 : 1)
