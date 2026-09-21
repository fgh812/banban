import type { Group, Item, MonthDoc, Settings, Person, Loan, LoansDoc, StocksDoc, Holding } from '../types'

export const won = (n: number) => '₩' + Math.round(n || 0).toLocaleString('ko-KR')
export const wonShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 100000000) { const eok = Math.floor(a / 100000000), rest = Math.round((a % 100000000) / 10000); return (n < 0 ? '-' : '') + eok + '억' + (rest ? ' ' + rest.toLocaleString('ko-KR') + '만' : '') }
  if (a >= 10000000) return (n / 10000000).toFixed(1).replace(/\.0$/, '') + '천만'
  if (a >= 10000) return Math.round(n / 10000).toLocaleString('ko-KR') + '만'
  return Math.round(n).toLocaleString('ko-KR')
}
// 그래프 축용 짧은 표기: 2.5억 / 3천만 / 850만
export const wonAxis = (n: number) => {
  const a = Math.abs(n), sg = n < 0 ? '-' : ''
  if (a >= 100000000) return sg + (a / 100000000).toFixed(a >= 1000000000 ? 0 : 1).replace(/\.0$/, '') + '억'
  if (a >= 10000000) return sg + (a / 10000000).toFixed(1).replace(/\.0$/, '') + '천만'
  if (a >= 10000) return sg + Math.round(a / 10000).toLocaleString('ko-KR') + '만'
  return Math.round(n).toLocaleString('ko-KR')
}
export const fmtIn = (v?: number) => (!v ? '' : (+v).toLocaleString('ko-KR'))
export const parseNum = (v: string) => { const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n }
export const parseDec = (v: string) => { const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n }
export const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export const label = (k: string) => k.slice(0, 4) + '년 ' + (+k.slice(5, 7)) + '월'
export const short = (k: string) => k.slice(2).replace('-', '.')
export function nextKey(k: string) {
  let y = +k.slice(0, 4), m = +k.slice(5, 7) + 1
  if (m > 12) { m = 1; y++ }
  return y + '-' + (m < 10 ? '0' : '') + m
}
export const thisMonth = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }

// 사람별 색 (검증된 팔레트 순서)
export const PERSON_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
export const personColor = (i: number) => PERSON_COLORS[i % PERSON_COLORS.length]

// ---------- 분류/묶음 ----------
export function catGroup(settings: Settings, c: string) {
  const d = settings.cats.find(x => x.n === c); return d ? d.g : null
}
export function groupOf(settings: Settings, r: Item) {
  const g = catGroup(settings, r.c) || r.g
  return settings.groups.some(x => x.id === g) ? g! : settings.groups[0].id
}
export function catList(settings: Settings, months: Record<string, MonthDoc>) {
  const names = settings.cats.map(c => c.n); const extra: string[] = []
  Object.values(months).forEach(mo => (mo.items || []).forEach(r => { if (!names.includes(r.c) && !extra.includes(r.c)) extra.push(r.c) }))
  return names.concat(extra)
}

// ---------- 합계 ----------
export interface Sums {
  g: Record<string, Record<string, number>>   // 묶음별 사람별
  exp: Record<string, number>                 // 사람별 지출(남는 돈 반영 묶음만)
  inc: Record<string, number>
  net: Record<string, number>
  done: Record<string, number>                // 사람별 체크된 지출
  now: Record<string, number>
  n: number; dn: number
  income: number; expense: number; netAll: number; nowAll: number
}
export function sums(mo: MonthDoc, settings: Settings, persons: Person[]): Sums {
  const pids = persons.map(p => p.id)
  const z = () => Object.fromEntries(pids.map(p => [p, 0])) as Record<string, number>
  const o: Sums = { g: {}, exp: z(), inc: z(), net: z(), done: z(), now: z(), n: 0, dn: 0, income: 0, expense: 0, netAll: 0, nowAll: 0 }
  settings.groups.forEach(g => { o.g[g.id] = z() })
  ;(mo.items || []).forEach(r => {
    const gid = groupOf(settings, r), gr = settings.groups.find(x => x.id === gid)!
    pids.forEach(p => {
      const v = +(r.a?.[p] || 0)
      o.g[gid][p] += v
      if (gr.sub !== false) o.exp[p] += v
      if (v > 0) { o.n++; if (r.d?.[p]) { o.dn++; if (gr.sub !== false) o.done[p] += v } }
    })
  })
  pids.forEach(p => {
    o.inc[p] = +(mo.income?.[p] || 0)
    o.net[p] = o.inc[p] - o.exp[p]
    o.now[p] = o.inc[p] - o.done[p]
    o.income += o.inc[p]; o.expense += o.exp[p]; o.netAll += o.net[p]; o.nowAll += o.now[p]
  })
  return o
}
export const itemTotal = (r: Item) => Object.values(r.a || {}).reduce((a, b) => a + (+b || 0), 0)
export function allDone(r: Item, pids: string[]) {
  const has = pids.filter(p => (+(r.a?.[p] || 0)) > 0)
  return has.length > 0 && has.every(p => !!r.d?.[p])
}
export function slotCount(rows: Item[], pids: string[]) {
  let n = 0, d = 0
  rows.forEach(r => pids.forEach(p => { if ((+(r.a?.[p] || 0)) > 0) { n++; if (r.d?.[p]) d++ } }))
  return { n, d }
}

// ---------- 대출 ----------
export function balanceAt(d: Loan, k: string) {
  const h = d.history || {}; let best: string | null = null
  Object.keys(h).forEach(hk => { if (hk <= k && (best === null || hk > best)) best = hk })
  return best === null ? (+d.amount || 0) : (+h[best] || 0)
}
export function stockValue(h: Holding, fx: number) {
  let v = (+h.qty || 0) * (+h.price || 0)
  if (h.market === 'US') v *= fx || 0
  return Math.round(v)
}
export function stockTotal(s: StocksDoc | null) {
  if (!s) return 0
  const fx = +(s.fx?.USDKRW || 0)
  return (s.holdings || []).reduce((a, h) => a + stockValue(h, fx), 0)
}
export function loanTotals(loans: LoansDoc | null, stocks: StocksDoc | null, k: string) {
  const o = { debt: 0, saving: 0, asset: 0, pay: 0, stock: stockTotal(stocks), plus: 0 }
  ;(loans?.items || []).forEach(d => {
    const b = balanceAt(d, k)
    if (d.kind === 'debt') { o.debt += b; o.pay += +d.monthly || 0 }
    else if (d.kind === 'saving') o.saving += b
    else o.asset += b
  })
  o.plus = o.saving + o.asset + o.stock
  return o
}

// 다음 달 만들기: 할부 회차 +1, 끝난 할부 제외, 체크 초기화
export function buildNextMonth(src: MonthDoc, key: string): MonthDoc {
  const items: Item[] = []
  ;(src.items || []).forEach(r => {
    const n: Item = { id: newId(), c: r.c, n: r.n, a: { ...(r.a || {}) } }
    if (r.g) n.g = r.g
    if (r.cur != null && r.tot != null) {
      if (+r.cur >= +r.tot) return
      n.cur = +r.cur + 1; n.tot = +r.tot
    }
    items.push(n)
  })
  return { m: key, note: '', income: { ...(src.income || {}) }, items }
}

export function groupLabel(g: Group) { return g.n }

// 받침에 따라 조사 선택: josa('할부','은는') → '할부는', josa('적금','이가') → '적금이'
export function josa(w: string, kind: '은는' | '이가' | '을를' | '과와') {
  const c = w.charCodeAt(w.length - 1)
  const hasFinal = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : /[0-9]/.test(w.slice(-1)) ? !/[2459]/.test(w.slice(-1)) : /[a-zA-Z]/.test(w.slice(-1)) ? /[lmnrLMNR]/.test(w.slice(-1)) : true
  const [a, b] = kind === '은는' ? ['은', '는'] : kind === '이가' ? ['이', '가'] : kind === '을를' ? ['을', '를'] : ['과', '와']
  return w + (hasFinal ? a : b)
}
