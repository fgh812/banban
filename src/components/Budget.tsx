import { useEffect, useMemo, useState } from 'react'
import type { Session } from '../App'
import { useData, putMonth, removeMonth, updateLoans } from '../store'
import { buildNextMonth, label, nextKey, personColor, sums, thisMonth, won, balanceAt } from '../lib/util'
import Header from './Header'
import MonthRail from './MonthRail'
import Tiles from './Tiles'
import Ledger from './Ledger'
import MultiView from './MultiView'
import FlowChart from './FlowChart'
import Loans from './Loans'
import Settings from './Settings'

type View = 'one' | 'multi'
const SEC_DEFAULT = ['ledger', 'flow', 'loans']

function loadPref<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
function savePref(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }

export default function Budget({ session }: { session: Session }) {
  const data = useData()
  const { household } = session
  const persons = household.persons
  const keys = useMemo(() => Object.keys(data.months).sort(), [data.months])
  const [cur, setCur] = useState<string>(() => loadPref('cur', ''))
  const [view, setView] = useState<View>(() => loadPref('view', 'one'))
  const [range, setRange] = useState<number>(() => loadPref('range', 6))
  const [combine, setCombine] = useState<boolean>(() => loadPref('combine', false))
  const [order, setOrder] = useState<string[]>(() => { const o = loadPref<string[]>('sec-order', SEC_DEFAULT); return o.length === 3 && SEC_DEFAULT.every(x => o.includes(x)) ? o : SEC_DEFAULT })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [armDel, setArmDel] = useState(false)

  // 현재 달 결정: 저장된 값 → 이번 달 → 마지막 달
  useEffect(() => {
    if (!keys.length) return
    if (cur && keys.includes(cur)) return
    const tm = thisMonth()
    setCur(keys.includes(tm) ? tm : keys[keys.length - 1])
  }, [keys.join(','), cur])
  useEffect(() => { if (cur) savePref('cur', cur) }, [cur])
  useEffect(() => { savePref('view', view); savePref('range', range); savePref('combine', combine); savePref('sec-order', order) }, [view, range, combine, order])
  useEffect(() => { if (!armDel) return; const t = setTimeout(() => setArmDel(false), 4000); return () => clearTimeout(t) }, [armDel])

  const mo = cur ? data.months[cur] : undefined
  const s = mo ? sums(mo, data.settings, persons) : null
  const pcolors = Object.fromEntries(persons.map((p, i) => [p.id, personColor(i)]))

  function makeNext() {
    const last = keys[keys.length - 1]
    const k = last ? nextKey(last) : thisMonth()
    if (data.months[k]) { setCur(k); return }
    const src = last ? data.months[last] : { m: k, income: {}, items: [] }
    const doc = buildNextMonth(src, k)
    putMonth(doc)
    // 대출·적금 잔액: 매달 변화 반영
    if (data.loans.items.length && last) updateLoans(l => l.items.forEach(d => { d.history = d.history || {}; d.history[k] = Math.max(0, balanceAt(d, last) + (+d.delta || 0)) }))
    setCur(k)
  }
  async function deleteMonth() {
    if (!cur || keys.length <= 1) return
    if (!armDel) { setArmDel(true); return }
    setArmDel(false)
    const ci = keys.indexOf(cur); const k = cur
    setCur(keys[ci + 1] ?? keys[ci - 1])
    await removeMonth(k)
    updateLoans(l => l.items.forEach(d => { if (d.history && d.history[k] != null) delete d.history[k] }))
  }
  function moveSec(id: string, dir: -1 | 1) {
    const i = order.indexOf(id), j = i + dir
    if (j < 0 || j >= order.length) return
    const o = order.slice(); o.splice(i, 1); o.splice(j, 0, id); setOrder(o)
  }

  if (!keys.length) {
    return (
      <div className="wrap">
        <Header session={session} cur={null} onSettings={() => setSettingsOpen(true)} />
        <div className="card empty">
          아직 기록한 달이 없어요.<br />
          <button className="btn primary" onClick={makeNext}>{label(thisMonth())} 시작하기</button>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>엑셀이나 이전 가계부에서 옮기려면 설정 → 가져오기를 쓰세요.</div>
        </div>
        {settingsOpen && <Settings session={session} onClose={() => setSettingsOpen(false)} />}
      </div>
    )
  }
  if (!mo || !s) return null

  const sections: Record<string, React.ReactNode> = {
    ledger: (
      <section className="card" key="ledger" data-sec="ledger">
        <div className="ledhead">
          <div style={{ minWidth: 0 }}>
            <h2 id="ledtitle">{view === 'multi' ? '여러 달 나란히' : label(cur) + (mo.note ? '  ·  ' + mo.note : '')}</h2>
            {view === 'one' && <Progress s={s} />}
            <p className="hint" style={{ margin: 0 }}>{view === 'multi' ? '같은 이름의 항목끼리 한 줄로 묶여요. 달 이름을 누르면 그 달을 편집할 수 있어요.' : '금액을 눌러 바로 고치세요. 할부는 회차만 적어두면 다음 달 복사할 때 자동으로 넘어가요.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <SecMove id="ledger" order={order} onMove={moveSec} inline />
            <span className="save">{data.saving}</span>
            <button className={'btn ghost' + (armDel ? ' arm' : '')} style={armDel ? { background: 'var(--bad)', borderColor: 'var(--bad)', color: '#fff' } : undefined} onClick={deleteMonth} disabled={keys.length <= 1}>{armDel ? label(cur) + ' 정말 지우기' : '이 달 지우기'}</button>
            <button className="btn primary" onClick={makeNext}>다음 달 만들기</button>
          </div>
        </div>
        <div className="viewbar">
          <div className="seg" role="tablist">
            <button className="segbtn" aria-selected={view === 'one'} onClick={() => setView('one')}>한 달씩</button>
            <button className="segbtn" aria-selected={view === 'multi'} onClick={() => setView('multi')}>여러 달 나란히</button>
          </div>
          {view === 'multi' && <>
            <div className="seg">{[3, 6, 12, 0].map(r => <button key={r} className="segbtn" aria-selected={range === r} onClick={() => setRange(r)}>{r ? r + '개월' : '전체'}</button>)}</div>
            <label className="chk"><input type="checkbox" checked={combine} onChange={e => setCombine(e.target.checked)} /> 모두 합쳐서</label>
          </>}
        </div>
        {view === 'one'
          ? <Ledger cur={cur} mo={mo} s={s} persons={persons} pcolors={pcolors} />
          : <MultiView keys={keys} cur={cur} range={range} combine={combine} persons={persons} pcolors={pcolors} onJump={k => { setCur(k); setView('one') }} />}
      </section>
    ),
    flow: (
      <section className="card" key="flow" data-sec="flow">
        <SecMove id="flow" order={order} onMove={moveSec} />
        <h2>월별 흐름</h2>
        <p className="hint">수입과 지출, 그리고 남는 돈(모두 합계).</p>
        <FlowChart keys={keys} persons={persons} />
      </section>
    ),
    loans: (
      <section className="card" key="loans" data-sec="loans">
        <SecMove id="loans" order={order} onMove={moveSec} />
        <Loans cur={cur} keys={keys} />
      </section>
    ),
  }

  return (
    <div className="wrap">
      <Header session={session} cur={cur} onSettings={() => setSettingsOpen(true)} />
      <MonthRail keys={keys} cur={cur} onPick={k => setCur(k)} persons={persons} />
      <Tiles s={s} persons={persons} pcolors={pcolors} />
      {order.map(id => sections[id])}
      {settingsOpen && <Settings session={session} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function Progress({ s }: { s: ReturnType<typeof sums> }) {
  if (!s.n) return null
  const left = s.expense - Object.values(s.done).reduce((a, b) => a + b, 0)
  const pct = Math.round(100 * (s.expense ? (s.expense - left) / s.expense : s.dn / s.n))
  return (
    <div className={'prog' + (s.dn === s.n ? ' all' : '')}>
      <span className="pbar"><i style={{ width: pct + '%' }} /></span>
      <span>지출 완료 {s.dn}/{s.n}{left ? ' · 남은 지출 ' + won(left) : ' · 이번 달 지출 끝!'}</span>
    </div>
  )
}

function SecMove({ id, order, onMove, inline }: { id: string; order: string[]; onMove: (id: string, d: -1 | 1) => void; inline?: boolean }) {
  const i = order.indexOf(id)
  return (
    <span className={'secmove' + (inline ? ' inline' : '')}>
      <button className="mv" disabled={i === 0} title="위로" onClick={() => onMove(id, -1)}>▲</button>
      <button className="mv" disabled={i === order.length - 1} title="아래로" onClick={() => onMove(id, 1)}>▼</button>
    </span>
  )
}

