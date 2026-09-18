// ---------- 가계부(household) ----------
export interface Person {
  id: string          // p1, p2 …  (계정과 별개 — 배우자가 아직 가입 전이어도 열이 존재)
  name: string
  uid?: string        // 연결된 계정
}
export interface Household {
  id: string
  name: string
  persons: Person[]
  memberUids: string[]
  inviteCode?: string
  createdAt?: number
}
export interface UserDoc { hid?: string; name?: string; email?: string }

// ---------- 월 ----------
export interface Item {
  id: string
  c: string                       // 분류
  g?: string                      // 묶음 id (분류 설정이 우선)
  n: string                       // 이름
  a: Record<string, number>       // 사람별 금액 {p1: 605000}
  d?: Record<string, boolean>     // 사람별 지출 완료
  cur?: number; tot?: number      // 할부 회차
}
export interface MonthDoc {
  m: string                       // YYYY-MM
  note?: string
  income: Record<string, number>
  items: Item[]
}

// ---------- 설정 ----------
export interface Cat { n: string; g: string }
export interface Group { id: string; n: string; sub: boolean }
export interface Settings { cats: Cat[]; groups: Group[] }

// ---------- 대출·자산 ----------
export type LoanKind = 'debt' | 'saving' | 'asset'
export interface Loan {
  id: string; kind: LoanKind; name: string
  amount: number; rate: number; start: string; monthly: number; delta: number
  history: Record<string, number>
}
export interface LoansDoc { items: Loan[] }

// ---------- 주식 ----------
export interface Holding {
  id: string; market: 'KR' | 'US'; ticker: string; name: string
  qty: number; price: number; updatedAt: string; account: string
}
export interface StocksDoc { holdings: Holding[]; accounts: string[]; fx: { USDKRW?: number; updatedAt?: string } }

export const DEFAULT_GROUPS: Group[] = [
  { id: 'fixed', n: '고정 지출', sub: true },
  { id: 'life', n: '생활비 지출', sub: true },
]
export const DEFAULT_CATS: Cat[] = [
  { n: '주거비', g: 'fixed' }, { n: '보험료', g: 'fixed' }, { n: '통신비', g: 'fixed' },
  { n: '적금', g: 'fixed' }, { n: '기타', g: 'fixed' }, { n: '카드할부', g: 'fixed' }, { n: '생활', g: 'life' },
]
