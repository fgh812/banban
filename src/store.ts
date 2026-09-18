// 가계부 데이터 저장소: Firestore 구독 + 로컬 편집 + 디바운스 저장
// 저장 대기 중인 로컬 편집이 서버 스냅샷에 덮이지 않도록 dirty 추적
import { collection, doc, onSnapshot, setDoc, deleteDoc, type Unsubscribe } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'
import { db } from './firebase'
import { DEFAULT_CATS, DEFAULT_GROUPS, type MonthDoc, type Settings, type LoansDoc, type StocksDoc } from './types'

export interface DataState {
  hid: string | null
  loaded: boolean
  months: Record<string, MonthDoc>
  settings: Settings
  loans: LoansDoc
  stocks: StocksDoc
  saving: string       // 상태 표시 문구
}

const EMPTY_LOANS: LoansDoc = { items: [] }
const EMPTY_STOCKS: StocksDoc = { holdings: [], accounts: [], fx: {} }
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

let state: DataState = {
  hid: null, loaded: false, months: {},
  settings: { cats: clone(DEFAULT_CATS), groups: clone(DEFAULT_GROUPS) },
  loans: clone(EMPTY_LOANS), stocks: clone(EMPTY_STOCKS), saving: '',
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
function set(patch: Partial<DataState>) { state = { ...state, ...patch }; emit() }

const dirty: Record<string, boolean> = {}
const seq: Record<string, number> = {}
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  set({ saving: msg }); clearTimeout(flashTimer)
  flashTimer = setTimeout(() => set({ saving: '' }), 1800)
}
function markDirty(key: string) { dirty[key] = true; seq[key] = (seq[key] || 0) + 1; return seq[key] }
function settle(key: string, my: number) { if (seq[key] === my) dirty[key] = false }

let unsubs: Unsubscribe[] = []
let monthsLoaded = false

export const MOCK = typeof location !== 'undefined' && location.hostname === 'localhost' && location.search.includes('mock')
export async function loadMock(url: string) {
  const j = await (await fetch(url)).json()
  const months: Record<string, MonthDoc> = {}
  Object.values(j.months as Record<string, any>).forEach((m: any) => { months[m.m] = normalizeMonth(m.m, m) })
  monthsLoaded = true
  set({ hid: 'mock', loaded: true, months, settings: j.settings, loans: j.loans, stocks: j.stocks })
}
export function subscribe(hid: string | null) {
  if (MOCK) return
  unsubs.forEach(u => u()); unsubs = []
  monthsLoaded = false
  Object.keys(dirty).forEach(k => { dirty[k] = false })
  set({ hid, loaded: false, months: {}, settings: { cats: clone(DEFAULT_CATS), groups: clone(DEFAULT_GROUPS) }, loans: clone(EMPTY_LOANS), stocks: clone(EMPTY_STOCKS) })
  if (!hid) return
  const base = doc(db, 'households', hid)
  unsubs.push(onSnapshot(collection(base, 'months'), snap => {
    const months = { ...state.months }
    const seen = new Set<string>()
    snap.docs.forEach(d => { seen.add(d.id); if (!dirty['m:' + d.id]) months[d.id] = normalizeMonth(d.id, d.data()) })
    Object.keys(months).forEach(k => { if (!seen.has(k) && !dirty['m:' + k]) delete months[k] })
    monthsLoaded = true
    set({ months, loaded: true })
  }))
  unsubs.push(onSnapshot(doc(base, 'meta', 'settings'), s => {
    if (dirty['settings'] || !s.exists()) return
    const b = s.data() as Partial<Settings>
    set({ settings: {
      cats: Array.isArray(b.cats) && b.cats.length ? clone(b.cats) : clone(DEFAULT_CATS),
      groups: Array.isArray(b.groups) && b.groups.length ? clone(b.groups) : clone(DEFAULT_GROUPS),
    } })
  }))
  unsubs.push(onSnapshot(doc(base, 'meta', 'loans'), s => {
    if (dirty['loans'] || !s.exists()) return
    const b = s.data() as Partial<LoansDoc>
    set({ loans: { items: Array.isArray(b.items) ? clone(b.items) : [] } })
  }))
  unsubs.push(onSnapshot(doc(base, 'meta', 'stocks'), s => {
    if (dirty['stocks'] || !s.exists()) return
    const b = s.data() as Partial<StocksDoc>
    set({ stocks: { holdings: clone(b.holdings || []), accounts: clone(b.accounts || []), fx: clone(b.fx || {}) } })
  }))
}

function normalizeMonth(id: string, raw: any): MonthDoc {
  const mo: MonthDoc = { m: id, note: raw.note || '', income: raw.income || {}, items: Array.isArray(raw.items) ? raw.items : [] }
  mo.items.forEach((r: any) => { if (!r.a) r.a = {}; if (!r.id) r.id = 'r' + Math.random().toString(36).slice(2) })
  return mo
}

// ---------- 쓰기 ----------
function write(key: string, path: string[], data: any, delay = 550) {
  if (!state.hid) return
  if (MOCK) { flash('저장됨 (mock)'); return }
  const my = markDirty(key)
  clearTimeout(timers[key])
  timers[key] = setTimeout(async () => {
    try {
      set({ saving: '저장 중…' })
      await setDoc(doc(db, 'households', state.hid!, ...path), clone(data))
      settle(key, my); flash('저장됨')
    } catch (e: any) {
      console.error(e)
      flash(e?.code === 'permission-denied' ? '저장 권한이 없어요' : '저장 실패 — 다시 시도해 주세요')
    }
  }, delay)
}

export function updateMonth(k: string, fn: (mo: MonthDoc) => void) {
  const mo = clone(state.months[k]); if (!mo) return
  fn(mo)
  set({ months: { ...state.months, [k]: mo } })
  write('m:' + k, ['months', k], mo)
}
export function putMonth(mo: MonthDoc) {
  set({ months: { ...state.months, [mo.m]: mo } })
  write('m:' + mo.m, ['months', mo.m], mo, 0)
}
export async function removeMonth(k: string) {
  if (!state.hid) return
  clearTimeout(timers['m:' + k]); dirty['m:' + k] = false
  const months = { ...state.months }; delete months[k]
  set({ months })
  await deleteDoc(doc(db, 'households', state.hid, 'months', k))
}
export function updateSettings(fn: (s: Settings) => void) {
  const s = clone(state.settings); fn(s); set({ settings: s }); write('settings', ['meta', 'settings'], s, 300)
}
export function updateLoans(fn: (l: LoansDoc) => void) {
  const l = clone(state.loans); fn(l); set({ loans: l }); write('loans', ['meta', 'loans'], l)
}
export function updateStocks(fn: (s: StocksDoc) => void) {
  const s = clone(state.stocks); fn(s); set({ stocks: s }); write('stocks', ['meta', 'stocks'], s)
}
export function isMonthsLoaded() { return monthsLoaded }

export function useData() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l) }, () => state)
}
