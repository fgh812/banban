import { useEffect, useRef, useState } from 'react'
import type { Session } from '../App'
import { logout } from '../firebase'
import { useData } from '../store'
import { label, loanTotals, short, won } from '../lib/util'

export default function Header({ session, cur, onSettings }: { session: Session; cur: string | null; onSettings: () => void }) {
  const data = useData()
  const keys = Object.keys(data.months).sort()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  const t = cur ? loanTotals(data.loans, data.stocks, cur) : null
  const u = session.user
  return (
    <header className="top">
      <div>
        <h1>{session.household.name} <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'IBM Plex Sans KR, sans-serif', fontWeight: 500 }}>반반</span></h1>
        <div className="sub">{keys.length ? keys.length + '개월 기록 · ' + label(keys[0]) + ' ~ ' + label(keys[keys.length - 1]) : '첫 달을 만들어 보세요'}</div>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
        {t && (t.debt > 0 || t.pay > 0) && (
          <div className="topstat">
            <div><div className="k">총 부채 · {short(cur!)}</div><div className="v num">{won(t.debt)}</div></div>
            <div><div className="k">월 상환액</div><div className="v num">{won(t.pay)}</div></div>
          </div>
        )}
        <div className="menu" ref={ref}>
          {u.photoURL
            ? <img className="avatar" src={u.photoURL} alt="" referrerPolicy="no-referrer" onClick={() => setOpen(o => !o)} />
            : <button className="avatar" onClick={() => setOpen(o => !o)} aria-label="메뉴">☰</button>}
          {open && (
            <div className="panel">
              <div style={{ padding: '6px 10px 8px', fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
              <button onClick={() => { setOpen(false); onSettings() }}>설정 · 초대 · 가져오기</button>
              <button onClick={() => logout()}>로그아웃</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
