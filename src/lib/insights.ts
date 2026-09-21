// 규칙 기반 분석: 한 달 / 여러 달 수입·지출을 읽고 사람이 읽을 문장으로
import type { MonthDoc, Person, Settings, LoansDoc, StocksDoc } from '../types'
import { sums, groupOf, itemTotal, won, label, loanTotals, josa } from './util'

export type Tone = 'good' | 'warn' | 'bad' | 'info'
export interface Insight { tone: Tone; title: string; body?: string }

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const sign = (n: number) => (n > 0 ? '+' : '') + won(n)
const short = (k: string) => (+k.slice(5, 7)) + '월'

function catTotals(mo: MonthDoc, settings: Settings) {
  const o: Record<string, number> = {}
  mo.items.forEach(r => { const g = settings.groups.find(x => x.id === groupOf(settings, r)); if (g && g.sub === false) return; o[r.c] = (o[r.c] || 0) + itemTotal(r) })
  return o
}

// ---------- 한 달 ----------
export function analyzeMonth(cur: string, months: Record<string, MonthDoc>, settings: Settings, persons: Person[]): Insight[] {
  const mo = months[cur]; if (!mo) return []
  const keys = Object.keys(months).sort()
  const prev = keys.filter(k => k < cur).slice(-6)          // 직전 최대 6개월
  const s = sums(mo, settings, persons)
  const out: Insight[] = []

  // 1. 이번 달 한 줄 요약
  const rate = pct(s.netAll, s.income)
  out.push({
    tone: s.netAll < 0 ? 'bad' : rate >= 30 ? 'good' : 'info',
    title: `수입 ${won(s.income)} · 지출 ${won(s.expense)} → 남는 돈 ${sign(s.netAll)}`,
    body: s.income ? `수입의 ${rate}%가 남아요. ${rate >= 30 ? '저축 여력이 좋은 달이에요.' : rate >= 10 ? '보통 수준이에요.' : rate >= 0 ? '빠듯한 달이에요.' : '지출이 수입을 넘었어요.'}` : '수입을 적어두면 저축률을 계산해 드려요.',
  })

  // 2. 평균 대비
  if (prev.length >= 2) {
    const ps = prev.map(k => sums(months[k], settings, persons))
    const avgExp = ps.reduce((a, x) => a + x.expense, 0) / ps.length
    const avgInc = ps.reduce((a, x) => a + x.income, 0) / ps.length
    const dExp = s.expense - avgExp, dp = pct(dExp, avgExp)
    if (Math.abs(dp) >= 5) out.push({
      tone: dp > 15 ? 'warn' : dp > 0 ? 'info' : 'good',
      title: `지출이 최근 ${prev.length}개월 평균보다 ${Math.abs(dp)}% ${dp > 0 ? '많아요' : '적어요'}`,
      body: `평균 ${won(avgExp)} → 이번 달 ${won(s.expense)} (${sign(dExp)})`,
    })
    const dInc = s.income - avgInc
    if (avgInc && Math.abs(pct(dInc, avgInc)) >= 10) out.push({ tone: dInc > 0 ? 'good' : 'warn', title: `수입이 평소보다 ${Math.abs(pct(dInc, avgInc))}% ${dInc > 0 ? '많아요' : '적어요'}`, body: `평균 ${won(avgInc)} → ${won(s.income)}` })

    // 분류별로 평소보다 튀는 것
    const ct = catTotals(mo, settings)
    const avgCat: Record<string, number> = {}
    prev.forEach(k => { const c = catTotals(months[k], settings); Object.keys(c).forEach(n => { avgCat[n] = (avgCat[n] || 0) + c[n] / prev.length }) })
    const jumps = Object.keys(ct).map(n => ({ n, v: ct[n], a: avgCat[n] || 0, d: ct[n] - (avgCat[n] || 0) })).filter(x => x.a > 0 && x.d > 50000 && pct(x.d, x.a) >= 25).sort((a, b) => b.d - a.d).slice(0, 2)
    jumps.forEach(j => out.push({ tone: 'warn', title: `${josa(j.n, '이가')} 평소보다 ${pct(j.d, j.a)}% 늘었어요`, body: `평균 ${won(j.a)} → ${won(j.v)}` }))
    const drops = Object.keys(avgCat).map(n => ({ n, v: ct[n] || 0, a: avgCat[n], d: (ct[n] || 0) - avgCat[n] })).filter(x => x.a > 50000 && x.d < -50000 && pct(-x.d, x.a) >= 30).sort((a, b) => a.d - b.d).slice(0, 1)
    drops.forEach(j => out.push({ tone: 'good', title: `${josa(j.n, '은는')} 평소보다 ${won(-j.d)} 줄었어요`, body: `평균 ${won(j.a)} → ${won(j.v)}` }))
  }

  // 3. 가장 큰 지출 분류
  const ct = catTotals(mo, settings)
  const top = Object.entries(ct).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (top.length && s.expense) out.push({ tone: 'info', title: `지출의 ${pct(top[0][1], s.expense)}%가 ${top[0][0]}`, body: top.map(([n, v]) => `${n} ${won(v)} (${pct(v, s.expense)}%)`).join(' · ') })

  // 4. 사람별 부담
  if (persons.length >= 2 && s.expense) {
    const parts = persons.map(p => ({ p, e: s.exp[p.id] || 0, i: s.inc[p.id] || 0 }))
    const shares = parts.map(x => `${x.p.name} ${pct(x.e, s.expense)}%`).join(' · ')
    const tight = parts.filter(x => x.i > 0 && x.e / x.i > 0.9)
    out.push({ tone: tight.length ? 'warn' : 'info', title: `지출 분담: ${shares}`, body: tight.length ? `${josa(tight.map(x => x.p.name).join(', '), '은는')} 수입의 90% 이상을 쓰고 있어요. 분담 비율을 조정해 볼 만해요.` : parts.map(x => `${josa(x.p.name, '은는')} 수입의 ${pct(x.e, x.i)}%`).join(', ') })
  }

  // 5. 고정 지출 비율
  const fixedG = settings.groups.find(g => g.id === 'fixed') || settings.groups[0]
  if (fixedG && s.income) {
    const f = Object.values(s.g[fixedG.id] || {}).reduce((a, b) => a + b, 0)
    const fp = pct(f, s.income)
    if (fp >= 60) out.push({ tone: 'warn', title: `${josa(fixedG.n, '이가')} 수입의 ${fp}%`, body: '고정 지출이 60%를 넘으면 예상 밖 지출에 대응하기 어려워요. 보험·구독·할부 중 줄일 수 있는 게 있는지 봐요.' })
    else if (fp > 0) out.push({ tone: 'info', title: `${josa(fixedG.n, '은는')} 수입의 ${fp}%`, body: fp <= 40 ? '고정비 비중이 낮아 유연한 구조예요.' : '보통 수준이에요.' })
  }

  // 6. 할부
  const inst = mo.items.filter(r => r.cur != null && r.tot != null)
  if (inst.length) {
    const ending = inst.filter(r => +r.cur! >= +r.tot!)
    const monthly = inst.reduce((a, r) => a + itemTotal(r), 0)
    const left = inst.reduce((a, r) => a + itemTotal(r) * Math.max(0, +r.tot! - +r.cur!), 0)
    out.push({ tone: ending.length ? 'good' : 'info', title: `할부 ${inst.length}건, 이번 달 ${won(monthly)}`, body: (ending.length ? `${ending.map(r => r.n).join(', ')} 이번 달로 끝! 다음 달부터 ${won(ending.reduce((a, r) => a + itemTotal(r), 0))} 여유가 생겨요. ` : '') + (left ? `남은 할부 원금 합계 ${won(left)}` : '') })
  }

  // 7. 진행률
  if (s.n) {
    const leftPay = s.expense - Object.values(s.done).reduce((a, b) => a + b, 0)
    if (s.dn === s.n) out.push({ tone: 'good', title: '이번 달 지출을 모두 처리했어요', body: `실제 남은 돈 ${won(s.nowAll - leftPay)}` })
    else out.push({ tone: 'info', title: `아직 안 낸 지출 ${s.n - s.dn}건, ${won(leftPay)}`, body: `지금 통장에 ${won(s.nowAll)} 있다면 다 내고 ${won(s.nowAll - leftPay)} 남아요.` })
  }
  return out
}

// ---------- 여러 달 ----------
export interface Trend { keys: string[]; income: number[]; expense: number[]; net: number[] }
export function analyzeRange(keys: string[], months: Record<string, MonthDoc>, settings: Settings, persons: Person[]): { insights: Insight[]; trend: Trend } {
  const ks = keys.filter(k => months[k])
  const ss = ks.map(k => sums(months[k], settings, persons))
  const trend: Trend = { keys: ks, income: ss.map(x => x.income), expense: ss.map(x => x.expense), net: ss.map(x => x.netAll) }
  const out: Insight[] = []
  if (ks.length < 2) return { insights: [{ tone: 'info', title: '두 달 이상 기록되면 흐름을 분석해 드려요' }], trend }
  const n = ks.length
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const tInc = sum(trend.income), tExp = sum(trend.expense), tNet = sum(trend.net)
  const rate = pct(tNet, tInc)
  out.push({ tone: tNet < 0 ? 'bad' : rate >= 30 ? 'good' : 'info', title: `${n}개월 동안 ${won(tNet)} 남았어요 (저축률 ${rate}%)`, body: `수입 ${won(tInc)} · 지출 ${won(tExp)} · 월평균 남는 돈 ${won(tNet / n)}` })

  // 추세: 앞 절반 vs 뒤 절반
  if (n >= 4) {
    const h = Math.floor(n / 2)
    const a = sum(trend.expense.slice(0, h)) / h, b = sum(trend.expense.slice(n - h)) / h
    const d = pct(b - a, a)
    if (Math.abs(d) >= 8) out.push({ tone: d > 0 ? 'warn' : 'good', title: `지출이 ${d > 0 ? '늘어나는' : '줄어드는'} 추세예요 (${Math.abs(d)}%)`, body: `앞 ${h}개월 평균 ${won(a)} → 뒤 ${h}개월 평균 ${won(b)}` })
    else out.push({ tone: 'info', title: '지출이 꾸준한 편이에요', body: `월평균 ${won(tExp / n)} 전후로 유지` })
  }

  // 최고·최저
  const maxI = trend.expense.indexOf(Math.max(...trend.expense)), minI = trend.expense.indexOf(Math.min(...trend.expense))
  out.push({ tone: 'info', title: `가장 많이 쓴 달 ${label(ks[maxI])} ${won(trend.expense[maxI])}`, body: `가장 적게 쓴 달 ${label(ks[minI])} ${won(trend.expense[minI])} · 차이 ${won(trend.expense[maxI] - trend.expense[minI])}` })
  const negs = ks.filter((_, i) => trend.net[i] < 0)
  if (negs.length) out.push({ tone: 'bad', title: `적자였던 달 ${negs.length}번`, body: negs.map(k => `${short(k)} ${won(trend.net[ks.indexOf(k)])}`).join(' · ') })

  // 분류별 합계 및 증가 분류
  const catSum: Record<string, number[]> = {}
  ks.forEach((k, i) => { const c = catTotals(months[k], settings); Object.keys(c).forEach(nm => { catSum[nm] = catSum[nm] || Array(n).fill(0); catSum[nm][i] = c[nm] }) })
  const ranked = Object.entries(catSum).map(([nm, arr]) => ({ nm, t: sum(arr), arr })).sort((a, b) => b.t - a.t)
  if (ranked.length) out.push({ tone: 'info', title: `${n}개월 지출 1위 ${ranked[0].nm} ${won(ranked[0].t)}`, body: ranked.slice(0, 4).map(r => `${r.nm} 월평균 ${won(r.t / n)}`).join(' · ') })
  if (n >= 4) {
    const h = Math.floor(n / 2)
    const grow = ranked.map(r => { const a = sum(r.arr.slice(0, h)) / h, b = sum(r.arr.slice(n - h)) / h; return { nm: r.nm, a, b, d: b - a } }).filter(x => x.a > 30000 && x.d > 30000 && pct(x.d, x.a) >= 20).sort((x, y) => y.d - x.d).slice(0, 2)
    grow.forEach(g => out.push({ tone: 'warn', title: `${josa(g.nm, '이가')} 계속 늘고 있어요`, body: `월평균 ${won(g.a)} → ${won(g.b)} (+${pct(g.d, g.a)}%)` }))
  }

  // 사람별
  if (persons.length >= 2) {
    const per = persons.map(p => ({ p, i: sum(ss.map(x => x.inc[p.id] || 0)), e: sum(ss.map(x => x.exp[p.id] || 0)) }))
    out.push({ tone: 'info', title: '사람별 ' + n + '개월 합계', body: per.map(x => `${x.p.name}: 수입 ${won(x.i)} · 지출 ${won(x.e)} · 남김 ${won(x.i - x.e)}`).join('  /  ') })
  }
  return { insights: out, trend }
}

// ---------- 목표 ----------
export interface Goal {
  id: string; name: string
  target: number            // 목표 금액
  start: string             // 시작 달 YYYY-MM
  months: number            // 기간(개월)
  seed: number              // 시작 시점 보유액(직접 입력)
  linkAssets?: boolean      // 적금·자산·주식 잔액을 현재액으로
  rate?: number             // 기대 연수익률 % (투자 시뮬레이션용)
}
export interface GoalsDoc { items: Goal[] }

export const monthsBetween = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7))
export const addMonths = (k: string, n: number) => { const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }

// 매달 얼마 넣어야 목표에 닿는지 (연 r% 복리, 월 적립) — r=0 이면 단순 나눗셈
export function monthlyNeeded(gap: number, months: number, annualRate = 0) {
  if (months <= 0) return gap
  const i = annualRate / 100 / 12
  if (!i) return gap / months
  return gap * i / (Math.pow(1 + i, months) - 1)
}
// 매달 m원 넣으면 n개월 뒤 얼마 (현재 보유 c 포함)
export function futureValue(c: number, m: number, months: number, annualRate = 0) {
  const i = annualRate / 100 / 12
  if (!i) return c + m * months
  return c * Math.pow(1 + i, months) + m * (Math.pow(1 + i, months) - 1) / i
}
// 매달 m원 넣을 때 목표까지 몇 달
export function monthsToReach(c: number, m: number, target: number, annualRate = 0) {
  if (c >= target) return 0
  if (m <= 0 && annualRate <= 0) return Infinity
  const i = annualRate / 100 / 12
  if (!i) return Math.ceil((target - c) / m)
  // 닫힌 식: n = ln((target*i + m) / (c*i + m)) / ln(1+i)
  const num = target * i + m, den = c * i + m
  if (den <= 0 || num / den <= 0) return Infinity
  return Math.ceil(Math.log(num / den) / Math.log(1 + i))
}

export interface GoalStat {
  goal: Goal
  cur: string
  current: number          // 현재 모은 돈
  elapsed: number          // 지난 개월
  remain: number           // 남은 개월
  end: string              // 목표 달
  progress: number         // 0~1
  needMonthly: number      // 남은 기간 매달 필요액(수익률 0)
  needMonthlyRate: number  // 기대수익률 적용 시
  paceMonthly: number      // 최근 평균 남는 돈
  paceMonths: number       // 지금 페이스로 몇 달 걸리는지
  paceEnd: string | null
  onTrack: boolean
  scenarios: { rate: number; monthly: number; months: number }[]
}
export function goalStat(goal: Goal, cur: string, months: Record<string, MonthDoc>, settings: Settings, persons: Person[], loans: LoansDoc, stocks: StocksDoc): GoalStat {
  const keys = Object.keys(months).sort()
  const elapsed = Math.max(0, monthsBetween(goal.start, cur))
  const remain = Math.max(0, goal.months - elapsed)
  const end = addMonths(goal.start, goal.months)
  // 현재액: 자산 연동이면 적금+자산+주식, 아니면 시작액 + 시작 이후 남는 돈 누적
  let current = goal.seed || 0
  if (goal.linkAssets) current = loanTotals(loans, stocks, cur).plus
  else keys.filter(k => k >= goal.start && k <= cur).forEach(k => { current += sums(months[k], settings, persons).netAll })
  current = Math.max(0, current)
  const gap = Math.max(0, goal.target - current)
  const recent = keys.filter(k => k <= cur).slice(-6)
  const paceMonthly = recent.length ? recent.reduce((a, k) => a + sums(months[k], settings, persons).netAll, 0) / recent.length : 0
  const rate = goal.rate || 0
  const paceMonths = monthsToReach(current, paceMonthly, goal.target, rate)
  const needMonthly = monthlyNeeded(gap, remain, 0)
  const needMonthlyRate = monthlyNeeded(gap, remain, rate)
  return {
    goal, cur, current, elapsed, remain, end,
    progress: goal.target ? Math.min(1, current / goal.target) : 0,
    needMonthly, needMonthlyRate, paceMonthly, paceMonths,
    paceEnd: isFinite(paceMonths) ? addMonths(cur, paceMonths) : null,
    onTrack: gap === 0 || (remain > 0 && paceMonthly >= needMonthlyRate * 0.98),
    scenarios: [0, 3, 5, 8].map(r => ({ rate: r, monthly: monthlyNeeded(gap, remain, r), months: monthsToReach(current, paceMonthly, goal.target, r) })),
  }
}

// AI 분석에 보낼 요약 텍스트 (개인 식별 정보 없이 숫자만)
export function summaryForAI(kind: 'month' | 'range', keys: string[], months: Record<string, MonthDoc>, settings: Settings, persons: Person[], goals: Goal[], loans: LoansDoc, stocks: StocksDoc): string {
  const lines: string[] = []
  const ks = keys.filter(k => months[k])
  lines.push(`사람: ${persons.map((p, i) => `P${i + 1}`).join(', ')} (부부/커플 가계부, 단위: 원)`)
  ks.forEach(k => {
    const s = sums(months[k], settings, persons)
    const ct = catTotals(months[k], settings)
    lines.push(`[${k}] 수입 ${Math.round(s.income)} / 지출 ${Math.round(s.expense)} / 남는돈 ${Math.round(s.netAll)}`)
    lines.push('  사람별: ' + persons.map((p, i) => `P${i + 1} 수입 ${Math.round(s.inc[p.id] || 0)} 지출 ${Math.round(s.exp[p.id] || 0)}`).join(', '))
    lines.push('  분류별: ' + Object.entries(ct).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${Math.round(v)}`).join(', '))
    if (kind === 'month') {
      lines.push('  항목: ' + months[k].items.map(r => `${r.c}/${r.n} ${Math.round(itemTotal(r))}${r.cur != null ? ` (할부 ${r.cur}/${r.tot})` : ''}`).join(', '))
    }
  })
  const last = ks[ks.length - 1]
  if (last) { const t = loanTotals(loans, stocks, last); lines.push(`[자산] 대출 ${Math.round(t.debt)} (월상환 ${Math.round(t.pay)}), 적금 ${Math.round(t.saving)}, 자산 ${Math.round(t.asset)}, 주식 ${Math.round(t.stock)}`) }
  goals.forEach(g => { const st = goalStat(g, last, months, settings, persons, loans, stocks); lines.push(`[목표] ${g.name}: 목표 ${g.target}, ${g.months}개월 중 ${st.elapsed}개월 경과, 현재 ${Math.round(st.current)}, 남은 기간 매달 필요 ${Math.round(st.needMonthly)}, 최근 페이스 ${Math.round(st.paceMonthly)}/월`) })
  return lines.join('\n')
}
