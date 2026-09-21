import { useState } from 'react'
import { updateGoals, useData } from '../store'
import { goalStat, summaryForAI, type Goal, type GoalStat, monthsToReach, addMonths } from '../lib/insights'
import { aiEnabled, askAI } from '../ai'
import { label, newId, won, wonShort, parseNum } from '../lib/util'
import type { Person } from '../types'
import AmountInput, { TextInput } from './AmountInput'

interface Props { cur: string; keys: string[]; persons: Person[]; tools?: React.ReactNode }

export default function Goals({ cur, keys, persons, tools }: Props) {
  const { goals, months, settings, loans, stocks } = useData()
  const [adding, setAdding] = useState(false)
  const items = goals.items

  const add = (g: Omit<Goal, 'id'>) => { updateGoals(d => d.items.push({ id: newId(), ...g })); setAdding(false) }
  const patch = (id: string, f: (g: Goal) => void) => updateGoals(d => { const g = d.items.find(x => x.id === id); if (g) f(g) })
  const del = (id: string) => updateGoals(d => { d.items = d.items.filter(x => x.id !== id) })

  return (
    <div className="goals">
      <div className="ledhead sechead" style={{ marginBottom: 6 }}>
        <div><h2 style={{ margin: 0 }}>목표</h2><p className="hint" style={{ margin: 0 }}>목표액과 기간을 정하면 매달 얼마씩 모아야 하는지, 지금 페이스로 언제 닿는지 계산해요.</p></div>
        <span className="row" style={{ gap: 7 }}>{!adding && <button className="btn primary" onClick={() => setAdding(true)}>＋ 목표 추가</button>}{tools}</span>
      </div>
      {adding && <GoalForm cur={cur} onSave={add} onCancel={() => setAdding(false)} />}
      {!items.length && !adding && <div className="empty" style={{ padding: '18px 0 6px', fontSize: 13, color: 'var(--muted)' }}>예: 「1억 모으기 · 1년」 「전세 보증금 5천 · 2년」</div>}
      {items.map(g => <GoalCard key={g.id} st={goalStat(g, cur, months, settings, persons, loans, stocks)} keys={keys} persons={persons} onPatch={f => patch(g.id, f)} onDel={() => del(g.id)} />)}
    </div>
  )
}

function GoalForm({ cur, onSave, onCancel }: { cur: string; onSave: (g: Omit<Goal, 'id'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState(100000000)
  const [months, setMonths] = useState(12)
  const [seed, setSeed] = useState(0)
  const [link, setLink] = useState(false)
  const [rate, setRate] = useState(0)
  return (
    <div className="goalform">
      <label>이름<input className="inp" style={{ border: '1px solid var(--grid)' }} value={name} onChange={e => setName(e.target.value)} placeholder="예: 1억 모으기" autoFocus /></label>
      <label>목표액<AmountInput value={target} onChange={setTarget} className="boxed" zeroAsBlank={false} /></label>
      <label>기간<span className="row" style={{ gap: 4 }}><input className="inp" style={{ border: '1px solid var(--grid)', width: 64, textAlign: 'right' }} inputMode="numeric" value={months} onChange={e => setMonths(Math.max(1, parseNum(e.target.value) || 1))} /><span style={{ fontSize: 12, color: 'var(--muted)' }}>개월</span></span></label>
      <label>지금 모은 돈<AmountInput value={seed} onChange={setSeed} className="boxed" zeroAsBlank={false} /></label>
      <label className="chk" style={{ alignSelf: 'end', paddingBottom: 6 }}><input type="checkbox" checked={link} onChange={e => setLink(e.target.checked)} /> 적금·자산·주식 잔액을 현재액으로</label>
      <label>기대 연수익률<span className="row" style={{ gap: 4 }}><input className="inp" style={{ border: '1px solid var(--grid)', width: 64, textAlign: 'right' }} inputMode="decimal" value={rate} onChange={e => setRate(+e.target.value || 0)} /><span style={{ fontSize: 12, color: 'var(--muted)' }}>% (예금·투자 안 하면 0)</span></span></label>
      <div className="row" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onCancel}>취소</button>
        <button className="btn primary" disabled={!name.trim() || target <= 0} onClick={() => onSave({ name: name.trim(), target, months, seed, linkAssets: link, rate, start: cur })}>목표 만들기</button>
      </div>
      <p className="hint" style={{ gridColumn: '1 / -1', margin: 0 }}>시작 달은 {label(cur)}로 잡혀요. 자산 연동을 끄면 「지금 모은 돈 + 매달 남는 돈」으로 진행률을 계산해요.</p>
    </div>
  )
}

function GoalCard({ st, keys, persons, onPatch, onDel }: { st: GoalStat; keys: string[]; persons: Person[]; onPatch: (f: (g: Goal) => void) => void; onDel: () => void }) {
  const { goal: g } = st
  const { months, settings, loans, stocks, goals } = useData()
  const [arm, setArm] = useState(false)
  const [open, setOpen] = useState(false)
  const [ai, setAi] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const pct = Math.round(st.progress * 100)
  const done = st.current >= g.target
  const gap = Math.max(0, g.target - st.current)

  const runAI = async () => {
    setBusy(true); setErr('')
    try { setAi(await askAI('goal', `[분석 대상 목표] ${g.name}\n` + summaryForAI('range', keys.filter(k => k <= st.cur).slice(-6), months, settings, persons, goals.items, loans, stocks))) }
    catch (e: any) { setErr(e?.message || 'AI 분석 실패') }
    setBusy(false)
  }

  return (
    <div className={'goal' + (done ? ' done' : st.onTrack ? ' ok' : ' behind')}>
      <div className="goalhead">
        <TextInput className="goalname" value={g.name} onCommit={v => onPatch(x => { x.name = v.trim() || x.name })} ariaLabel="목표 이름" />
        <span className="goalpct">{pct}%</span>
        <button className="del" onClick={() => setOpen(o => !o)} title="설정">{open ? '▲' : '⚙'}</button>
        <button className="del" style={arm ? { color: 'var(--bad-ink)', fontSize: 11 } : undefined} onClick={() => { if (!arm) { setArm(true); setTimeout(() => setArm(false), 3000); return } onDel() }} aria-label="목표 삭제">{arm ? '지우기?' : '×'}</button>
      </div>
      <div className="gbar"><i style={{ width: pct + '%' }} /><b style={{ left: Math.min(100, 100 * st.elapsed / g.months) + '%' }} title="시간 경과" /></div>
      <div className="gmeta">
        <span><b>{wonShort(st.current)}</b> / {wonShort(g.target)}</span>
        <span>{st.elapsed}개월 지남 · {st.remain}개월 남음 ({label(st.end)}까지)</span>
      </div>

      {done ? <div className="gmsg good">목표 달성! 🎉</div> : (
        <div className="gstats">
          <div className="gstat"><span className="k">남은 기간 매달</span><span className="v">{won(st.needMonthlyRate)}</span>{g.rate ? <span className="s">연 {g.rate}% 가정 · 수익 없이는 {won(st.needMonthly)}</span> : <span className="s">남은 {wonShort(gap)} ÷ {st.remain}개월</span>}</div>
          <div className="gstat"><span className="k">최근 6개월 페이스</span><span className="v" style={{ color: st.onTrack ? 'var(--good-ink)' : 'var(--bad-ink)' }}>{won(st.paceMonthly)}/월</span><span className="s">{!isFinite(st.paceMonths) ? '이 페이스로는 도달 못 해요' : st.paceEnd ? `이대로면 ${label(st.paceEnd)} 도달` + (st.paceMonths > st.remain ? ` (${st.paceMonths - st.remain}개월 늦음)` : ` (${st.remain - st.paceMonths}개월 빠름)`) : ''}</span></div>
          <div className="gstat"><span className="k">{st.onTrack ? '여유' : '부족'}</span><span className="v">{won(Math.abs(st.paceMonthly - st.needMonthlyRate))}/월</span><span className="s">{st.onTrack ? '지금처럼만 하면 돼요' : '매달 이만큼 더 남겨야 기간 안에 닿아요'}</span></div>
        </div>
      )}

      {!done && <Scenarios st={st} />}

      {aiEnabled() && !done && <div className="row" style={{ marginTop: 8 }}><button className="btn aibtn" disabled={busy} onClick={runAI}>{busy ? '분석 중…' : '✦ AI 코칭 받기'}</button></div>}
      {ai && <div className="aibox"><span className="aitag">✦ AI</span>{ai}</div>}
      {err && <div className="aibox err">{err}</div>}

      {open && (
        <div className="goalform" style={{ marginTop: 10 }}>
          <label>목표액<AmountInput value={g.target} onChange={n => onPatch(x => { x.target = n })} className="boxed" zeroAsBlank={false} /></label>
          <label>기간(개월)<input className="inp" style={{ border: '1px solid var(--grid)', width: 80, textAlign: 'right' }} inputMode="numeric" defaultValue={g.months} onBlur={e => onPatch(x => { x.months = Math.max(1, parseNum(e.target.value) || 1) })} /></label>
          <label>시작 달<select className="inp" style={{ border: '1px solid var(--grid)' }} value={g.start} onChange={e => onPatch(x => { x.start = e.target.value })}>{[...new Set([g.start, ...keys])].sort().map(k => <option key={k} value={k}>{label(k)}</option>)}</select></label>
          <label>시작 시 모은 돈<AmountInput value={g.seed} onChange={n => onPatch(x => { x.seed = n })} className="boxed" zeroAsBlank={false} /></label>
          <label className="chk" style={{ alignSelf: 'end', paddingBottom: 6 }}><input type="checkbox" checked={!!g.linkAssets} onChange={e => onPatch(x => { x.linkAssets = e.target.checked })} /> 적금·자산·주식 잔액 연동</label>
          <label>기대 연수익률 %<input className="inp" style={{ border: '1px solid var(--grid)', width: 80, textAlign: 'right' }} inputMode="decimal" defaultValue={g.rate || 0} onBlur={e => onPatch(x => { x.rate = +e.target.value || 0 })} /></label>
        </div>
      )}
    </div>
  )
}

// 투자 시뮬레이션: 수익률별 필요 월 적립액 / 지금 페이스 도달 시점, 월 적립액 조절 슬라이더
function Scenarios({ st }: { st: GoalStat }) {
  const { goal: g } = st
  const [m, setM] = useState(Math.round(Math.max(0, st.paceMonthly) / 10000) * 10000)
  const [open, setOpen] = useState(false)
  const rates = [0, 3, 5, 8]
  return (
    <div className="scen">
      <button className="linkbtn" onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} 투자 시뮬레이션</button>
      {open && <>
        <div className="row" style={{ gap: 8, alignItems: 'center', margin: '6px 0 8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>매달</span>
          <input type="range" min={0} max={Math.max(1000000, Math.ceil(st.needMonthly * 2 / 100000) * 100000)} step={50000} value={m} onChange={e => setM(+e.target.value)} style={{ flex: 1, minWidth: 120 }} />
          <b className="num" style={{ fontSize: 13 }}>{won(m)}</b>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>넣으면</span>
        </div>
        <table className="scentbl">
          <thead><tr><th>연수익률</th><th>필요 월 적립</th><th>{wonShort(m)}/월이면</th></tr></thead>
          <tbody>
            {rates.map(r => {
              const need = st.scenarios.find(s => s.rate === r)!.monthly
              const n = monthsToReach(st.current, m, g.target, r)
              return (
                <tr key={r} className={r === (g.rate || 0) ? 'cur' : ''}>
                  <td>{r === 0 ? '없음 (0%)' : `연 ${r}%`}</td>
                  <td className="num">{won(need)}</td>
                  <td className={'num' + (isFinite(n) && n <= st.remain ? ' ok' : ' late')}>{!isFinite(n) ? '도달 불가' : n === 0 ? '달성' : `${n}개월 (${label(addMonths(st.cur, n))})`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="hint" style={{ margin: '6px 0 0' }}>수익률은 가정일 뿐이고, 실제 투자는 손실이 날 수 있어요. 세금·수수료는 계산에 안 들어가 있어요.</p>
      </>}
    </div>
  )
}
