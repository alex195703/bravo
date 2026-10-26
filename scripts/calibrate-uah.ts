// Калибровка ФОТ под гривну: сколько платит автоподбор и ручной найм
// Запуск: bun scripts/calibrate-uah.ts
import {
  generateMarket, autoAssemble, payroll, PAYROLL_BUDGET, salaryFor,
  FIELD_PREMIUM, POSTS, type MarketMode,
} from '../src/lib/bravo'

const stats: Record<string, number[]> = { plenty: [], normal: [], drought: [] }
for (let i = 0; i < 400; i++) {
  for (const mode of Object.keys(stats) as MarketMode[]) {
    const pool = generateMarket(mode)
    stats[mode].push(payroll(autoAssemble(pool), pool))
  }
}
const fmt = (n: number) => `${Math.round(n / 1000)}k`
for (const [mode, arr] of Object.entries(stats)) {
  const sorted = [...arr].sort((a, b) => a - b)
  const avg = arr.reduce((s, x) => s + x, 0) / arr.length
  const p5 = sorted[Math.floor(arr.length * 0.05)]
  const p50 = sorted[Math.floor(arr.length * 0.5)]
  const p95 = sorted[Math.floor(arr.length * 0.95)]
  const overPct = Math.round((p50 / PAYROLL_BUDGET - 1) * 100)
  const overRuns = Math.round(arr.filter((x) => x > PAYROLL_BUDGET).length / arr.length * 100)
  console.log(`${mode.padEnd(8)} ср=${fmt(avg)} p5=${fmt(p5)} p50=${fmt(p50)} (${overPct > 0 ? '+' : ''}${overPct}% к бюджету) p95=${fmt(p95)} | перерасход в ${overRuns}% запусков`)
}

console.log('\nБазовые точки зарплат (грн):')
console.log('слабый (проф 25, стаж 2): ', salaryFor(25, 2))
console.log('медианный (проф 62, стаж 10):', salaryFor(62, 10))
console.log('звезда (проф 90, стаж 20): ', salaryFor(90, 20))
console.log('медианный финдир:         ', salaryFor(62, 10, 'fin'), '(work.ua медиана 85k)')
console.log('медианный комдир:         ', salaryFor(62, 10, 'com'), '(work.ua медиана 78k)')
console.log('медианный IT:             ', salaryFor(62, 10, 'it'))
console.log('качество:                 ', salaryFor(62, 10, 'qa'))
console.log('надбавки по сферам:', POSTS.map((p) => `${p.id} ×${FIELD_PREMIUM[p.id]}`).join(', '))
