import { useState } from 'react'
import type { Session } from '../App'
import { auth, logout } from '../firebase'
import { deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { leaveHousehold, regenerateInvite, renameHousehold, savePersons } from '../household'
import { putMonth, updateLoans, updateSettings, updateStocks, useData } from '../store'
import type { MonthDoc, Person } from '../types'
import { TextInput } from './AmountInput'

export default function Settings({ session, onClose }: { session: Session; onClose: () => void }) {
  const { household, user } = session
  const data = useData()
  const [persons, setPersons] = useState<Person[]>(household.persons.map(p => ({ ...p })))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [armLeave, setArmLeave] = useState(false)
  const [armDel, setArmDel] = useState(false)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const run = async (fn: () => Promise<any>, ok?: string) => { setBusy(true); try { await fn(); if (ok) flash(ok) } catch (e: any) { flash(e?.message || '실패했어요') } setBusy(false) }

  const exportJson = () => {
    const out = { version: 2, exportedAt: new Date().toISOString(), household: { name: household.name, persons: household.persons.map(p => ({ id: p.id, name: p.name })) }, months: data.months, settings: data.settings, loans: data.loans, stocks: data.stocks }
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `banban-${household.name}-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  const importJson = async (file: File) => {
    try {
      const j = JSON.parse(await file.text())
      if (!j.months || typeof j.months !== 'object') throw new Error('가계부 파일 형식이 아니에요')
      // 사람 id 매핑: 파일의 첫 사람 → 내 첫 사람 …
      const filePersons: { id: string }[] = j.household?.persons || []
      const map: Record<string, string> = {}
      filePersons.forEach((p, i) => { if (household.persons[i]) map[p.id] = household.persons[i].id })
      const remap = (o: Record<string, any> | undefined) => { const r: Record<string, any> = {}; Object.entries(o || {}).forEach(([k, v]) => { r[map[k] || k] = v }); return r }
      let n = 0
      Object.values(j.months as Record<string, MonthDoc>).forEach(mo => {
        const doc: MonthDoc = { m: mo.m, note: mo.note || '', income: remap(mo.income), items: (mo.items || []).map(r => ({ ...r, a: remap(r.a), d: r.d ? remap(r.d) : undefined })) }
        doc.items.forEach(r => { if (r.d === undefined) delete r.d })
        putMonth(doc); n++
      })
      if (j.settings) updateSettings(s => { s.cats = j.settings.cats || s.cats; s.groups = j.settings.groups || s.groups })
      if (j.loans) updateLoans(l => { l.items = j.loans.items || [] })
      if (j.stocks) updateStocks(s => { s.holdings = j.stocks.holdings || []; s.accounts = j.stocks.accounts || []; s.fx = j.stocks.fx || {} })
      flash(n + '개월 데이터를 가져왔어요')
    } catch (e: any) { flash('가져오기 실패: ' + (e?.message || '')) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>설정</h2>
          <button className="btn ghost" onClick={onClose}>닫기</button>
        </div>

        <div className="setting-sec">
          <h3>가계부 이름</h3>
          <TextInput className="inp" style={{ border: '1px solid var(--grid)', width: '100%' }} value={household.name} onCommit={v => run(() => renameHousehold(household.id, v.trim() || '우리집'), '바꿨어요')} />
        </div>

        <div className="setting-sec persons">
          <h3>사람 (표의 열)</h3>
          {persons.map((p, i) => (
            <div className="prow" key={p.id}>
              <span className="dot" style={{ ['--pc' as any]: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'][i % 4] }} />
              <input className="inp" style={{ border: '1px solid var(--grid)' }} value={p.name} onChange={e => setPersons(ps => ps.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} />
              <span className="pill">{p.uid ? (p.uid === user.uid ? '나' : '연결됨') : '미연결'}</span>
              {!p.uid && persons.length > 1 && <button className="del" onClick={() => setPersons(ps => ps.filter(x => x.id !== p.id))} aria-label="삭제">×</button>}
            </div>
          ))}
          <div className="row">
            {persons.length < 4 && <button className="btn" onClick={() => setPersons(ps => [...ps, { id: 'p' + (Math.max(0, ...ps.map(x => +x.id.slice(1) || 0)) + 1), name: '' }])}>＋ 사람 추가</button>}
            <button className="btn primary" disabled={busy || persons.some(p => !p.name.trim())} onClick={() => run(() => savePersons(household.id, persons.map(p => ({ ...p, name: p.name.trim() }))), '저장했어요')}>이름 저장</button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>사람을 지우면 그 열의 금액은 표에서 보이지 않게 돼요 (데이터는 남아요).</p>
        </div>

        <div className="setting-sec">
          <h3>배우자 초대</h3>
          <p className="hint">상대방이 반반에 구글 로그인한 뒤 「초대 코드로 참여」에 이 코드를 넣으면 같은 가계부에 들어와요.</p>
          <div className="row">
            <span className="code">{household.inviteCode || '------'}</span>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(household.inviteCode || ''); flash('복사했어요') }}>복사</button>
            <button className="btn ghost" disabled={busy} onClick={() => run(() => regenerateInvite(household.id, household.inviteCode, user.uid), '새 코드를 만들었어요')}>새 코드</button>
          </div>
        </div>

        <div className="setting-sec">
          <h3>내보내기 · 가져오기</h3>
          <div className="row">
            <button className="btn" onClick={exportJson}>JSON으로 내보내기</button>
            <label className="btn" style={{ cursor: 'pointer' }}>JSON 가져오기<input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} /></label>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>가져오면 같은 달은 파일 내용으로 덮어써요.</p>
        </div>

        <div className="setting-sec">
          <h3>계정</h3>
          <div className="row">
            <button className="btn" onClick={() => logout()}>로그아웃</button>
            <button className="btn ghost" style={armLeave ? { color: '#fff', background: 'var(--bad)', borderColor: 'var(--bad)' } : undefined} disabled={busy}
              onClick={() => { if (!armLeave) { setArmLeave(true); setTimeout(() => setArmLeave(false), 4000); return } run(() => leaveHousehold(user.uid)) }}>{armLeave ? '정말 나가기' : '이 가계부에서 나가기'}</button>
            <button className="btn ghost" style={armDel ? { color: '#fff', background: 'var(--bad)', borderColor: 'var(--bad)' } : undefined} disabled={busy}
              onClick={() => { if (!armDel) { setArmDel(true); setTimeout(() => setArmDel(false), 4000); return } run(async () => { const u = auth.currentUser!; try { await deleteUser(u) } catch { await reauthenticateWithPopup(u, new GoogleAuthProvider()); await deleteUser(u) } }) }}>{armDel ? '정말 계정 삭제' : '계정 삭제'}</button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>계정을 삭제하면 로그인 정보가 지워져요. 가계부 데이터는 함께 쓰는 사람에게 남고, 아무도 없으면 접근할 수 없게 돼요.</p>
        </div>

        <p className="hint" style={{ marginTop: 18 }}><a href="privacy.html" target="_blank" rel="noreferrer">개인정보 처리방침</a> · 반반 {(import.meta as any).env?.VITE_BUILD || 'web'}</p>
        {msg && <div className="toast">{msg}</div>}
      </div>
    </div>
  )
}
