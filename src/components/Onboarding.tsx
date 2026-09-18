import { useState } from 'react'
import { logout, type User } from '../firebase'
import { createHousehold, joinHousehold, lookupInvite } from '../household'
import type { Household } from '../types'

export default function Onboarding({ user }: { user: User }) {
  const [tab, setTab] = useState<'new' | 'join'>('new')
  const [name, setName] = useState('우리집')
  const [my, setMy] = useState(user.displayName?.split(' ')[0] || '')
  const [partner, setPartner] = useState('')
  const [code, setCode] = useState('')
  const [found, setFound] = useState<Household | null>(null)
  const [pick, setPick] = useState<string | 'new'>('new')
  const [newName, setNewName] = useState(user.displayName?.split(' ')[0] || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run(fn: () => Promise<any>) {
    setBusy(true); setErr('')
    try { await fn() } catch (e: any) { setErr(e?.message || '문제가 생겼어요. 다시 시도해 주세요.') }
    setBusy(false)
  }

  return (
    <div className="wrap">
      <div className="onb">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>반반</h1>
          <button className="btn ghost" onClick={() => logout()}>다른 계정으로</button>
        </div>
        <div className="tabs">
          <button className={'btn' + (tab === 'new' ? ' primary' : '')} onClick={() => setTab('new')}>새 가계부 만들기</button>
          <button className={'btn' + (tab === 'join' ? ' primary' : '')} onClick={() => setTab('join')}>초대 코드로 참여</button>
        </div>

        {tab === 'new' && (
          <section className="card">
            <h2>새 가계부</h2>
            <p>두 사람 이름은 표의 열 이름으로 쓰여요. 배우자는 나중에 초대 코드로 들어와서 자기 열에 연결돼요.</p>
            <div className="field"><label>가계부 이름</label><input value={name} onChange={e => setName(e.target.value)} placeholder="우리집" /></div>
            <div className="field"><label>내 이름</label><input value={my} onChange={e => setMy(e.target.value)} placeholder="예: 태행" /></div>
            <div className="field"><label>배우자 이름 (선택)</label><input value={partner} onChange={e => setPartner(e.target.value)} placeholder="예: 예슬" /></div>
            <button className="btn primary big" disabled={busy || !my.trim()} onClick={() => run(() => createHousehold(user, name.trim() || '우리집', my.trim(), partner))}>만들기</button>
            {err && <div className="err-msg">{err}</div>}
          </section>
        )}

        {tab === 'join' && (
          <section className="card">
            <h2>초대 코드로 참여</h2>
            <p>배우자가 설정 화면에서 보여준 6자리 코드를 넣어주세요.</p>
            <div className="row">
              <input className="inp" style={{ border: '1px solid var(--grid)', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.15em', textTransform: 'uppercase', width: 160, fontSize: 16 }}
                value={code} maxLength={6} onChange={e => { setCode(e.target.value.toUpperCase()); setFound(null) }} placeholder="ABC123" />
              <button className="btn" disabled={busy || code.length < 6} onClick={() => run(async () => {
                const r = await lookupInvite(code); if (!r) throw new Error('코드를 찾을 수 없어요. 다시 확인해 주세요.')
                setFound(r.household); const free = r.household.persons.find(p => !p.uid); setPick(free ? free.id : 'new')
              })}>찾기</button>
            </div>
            {found && (
              <div style={{ marginTop: 16 }}>
                <p>「{found.name}」 가계부를 찾았어요. 나는 누구인가요?</p>
                <div className="field">
                  {found.persons.map(p => (
                    <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, opacity: p.uid ? .5 : 1 }}>
                      <input type="radio" name="pick" disabled={!!p.uid} checked={pick === p.id} onChange={() => setPick(p.id)} />
                      {p.name}{p.uid ? ' (이미 연결됨)' : ''}
                    </label>
                  ))}
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                    <input type="radio" name="pick" checked={pick === 'new'} onChange={() => setPick('new')} /> 새 이름으로 추가
                  </label>
                  {pick === 'new' && <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="내 이름" />}
                </div>
                <button className="btn primary big" disabled={busy} onClick={() => run(() => joinHousehold(user, code, pick === 'new' ? null : pick, newName))}>참여하기</button>
              </div>
            )}
            {err && <div className="err-msg">{err}</div>}
          </section>
        )}
      </div>
    </div>
  )
}
