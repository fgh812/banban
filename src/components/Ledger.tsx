import { useEffect, useMemo, useRef, useState } from 'react'
import { updateMonth, updateSettings, useData } from '../store'
import { allDone, catGroup, catList, itemTotal, newId, slotCount, won, type Sums } from '../lib/util'
import type { Item, MonthDoc, Person } from '../types'
import AmountInput, { TextInput } from './AmountInput'
import { useRowDrag } from '../hooks/useRowDrag'

interface Props { cur: string; mo: MonthDoc; s: Sums; persons: Person[]; pcolors: Record<string, string> }

export default function Ledger({ cur, mo, s, persons, pcolors }: Props) {
  const data = useData()
  const { settings, months } = data
  const pids = persons.map(p => p.id)
  const cats = catList(settings, months)
  const tableRef = useRef<HTMLTableElement>(null)
  const [newCat, setNewCat] = useState('')
  const [newCatG, setNewCatG] = useState(settings.groups[0]?.id || 'fixed')
  const [armCat, setArmCat] = useState<string | null>(null)
  const [armGrp, setArmGrp] = useState<string | null>(null)
  const mobile = useMobile()
  const nCols = (mobile ? 2 : 4) + pids.length
  // 금액 열 폭: 이 달에 나오는 가장 긴 금액(콤마 포함) 자릿수 기준으로 동적 계산
  const { amtW, sumW } = useMemo(() => {
    let mx = 6, mxSum = 7
    const len = (n: number) => won(n).length
    pids.forEach(pid => { mx = Math.max(mx, len(mo.income?.[pid] || 0), len(s.net[pid] || 0), len(s.now[pid] || 0)); Object.values(s.g).forEach(v => { mx = Math.max(mx, len(v[pid] || 0)) }) })
    mo.items.forEach(r => pids.forEach(pid => { mx = Math.max(mx, len(+(r.a?.[pid] || 0))) }))
    mxSum = Math.max(mxSum, len(s.income), len(s.netAll), len(s.nowAll), mx)
    const ch = mobile ? 7.2 : 8.2            // 모노 글꼴 한 글자 폭(px)
    return { amtW: Math.ceil(mx * ch) + (mobile ? 26 : 44), sumW: Math.ceil(mxSum * 7.6) + 20 }
  }, [mo, s, pids.join(','), mobile])

  const catIndex = (c: string) => cats.indexOf(c) % 7
  const grpOf = (c: string, rows: Item[]) => { const g = catGroup(settings, c) || rows[0]?.g || settings.groups[0].id; return settings.groups.some(x => x.id === g) ? g : settings.groups[0].id }

  // ----- 항목 편집 -----
  const setAmt = (id: string, pid: string, n: number) => updateMonth(cur, m => { const r = m.items.find(x => x.id === id); if (r) { r.a = r.a || {}; r.a[pid] = n; if (!n) delete r.a[pid] } })
  const setName = (id: string, n: string) => updateMonth(cur, m => { const r = m.items.find(x => x.id === id); if (r) r.n = n })
  const setDone = (id: string, pid: string, v: boolean) => updateMonth(cur, m => { const r = m.items.find(x => x.id === id); if (r) { r.d = r.d || {}; if (v) r.d[pid] = true; else delete r.d[pid] } })
  const setInst = (id: string, f: 'cur' | 'tot', n: number) => updateMonth(cur, m => { const r = m.items.find(x => x.id === id); if (r) r[f] = n })
  const addInst = (id: string) => updateMonth(cur, m => { const r = m.items.find(x => x.id === id); if (r) { r.cur = 1; r.tot = 12 } })
  const delInst = (id: string) => updateMonth(cur, m => { const r = m.items.find(x => x.id === id); if (r) { delete r.cur; delete r.tot } })
  const delItem = (id: string) => updateMonth(cur, m => { m.items = m.items.filter(x => x.id !== id) })
  const addItem = (c: string) => {
    const id = newId()
    updateMonth(cur, m => m.items.push({ id, c, g: grpOf(c, []), n: '', a: {} }))
    setTimeout(() => (document.querySelector(`input[data-name="${id}"]`) as HTMLInputElement | null)?.focus(), 30)
  }
  const setIncome = (pid: string, n: number) => updateMonth(cur, m => { m.income = m.income || {}; m.income[pid] = n })

  // ----- 분류 -----
  const renameCat = (oldN: string, newN: string) => {
    newN = newN.trim(); if (!newN || newN === oldN || cats.includes(newN)) return
    updateSettings(st => { const d = st.cats.find(x => x.n === oldN); if (d) d.n = newN; else st.cats.push({ n: newN, g: catGroup(settings, oldN) || settings.groups[0].id }) })
    Object.keys(months).forEach(k => { if (months[k].items.some(r => r.c === oldN)) updateMonth(k, m => m.items.forEach(r => { if (r.c === oldN) r.c = newN })) })
  }
  const setCatGroup = (c: string, gid: string) => {
    updateSettings(st => { const d = st.cats.find(x => x.n === c); if (d) d.g = gid; else st.cats.push({ n: c, g: gid }) })
    updateMonth(cur, m => m.items.forEach(r => { if (r.c === c) r.g = gid }))
  }
  const delCat = (c: string) => {
    const inMonth = mo.items.filter(r => r.c === c).length
    if (inMonth > 0 && armCat !== c) { setArmCat(c); setTimeout(() => setArmCat(x => x === c ? null : x), 4000); return }
    setArmCat(null)
    if (inMonth) updateMonth(cur, m => { m.items = m.items.filter(r => r.c !== c) })
    const usedElsewhere = Object.keys(months).some(k => k !== cur && months[k].items.some(r => r.c === c))
    if (!usedElsewhere) updateSettings(st => { st.cats = st.cats.filter(x => x.n !== c) })
  }
  const addCat = () => {
    const nm = newCat.trim(); if (!nm) return
    if (cats.includes(nm)) return
    updateSettings(st => st.cats.push({ n: nm, g: newCatG })); setNewCat('')
    setTimeout(() => addItem(nm), 50)
  }
  // ----- 묶음 -----
  const renameGroup = (gid: string, n: string) => { n = n.trim(); if (n) updateSettings(st => { const g = st.groups.find(x => x.id === gid); if (g) g.n = n }) }
  const setGroupSub = (gid: string, sub: boolean) => updateSettings(st => { const g = st.groups.find(x => x.id === gid); if (g) g.sub = sub })
  const addGroup = () => { const id = 'g' + Date.now().toString(36); updateSettings(st => st.groups.push({ id, n: '새 묶음', sub: true })); setTimeout(() => { const el = document.querySelector(`input[data-grp="${id}"]`) as HTMLInputElement | null; el?.focus(); el?.select() }, 50) }
  const delGroup = (gid: string) => {
    if (settings.groups.length <= 1) return
    if (armGrp !== gid) { setArmGrp(gid); setTimeout(() => setArmGrp(x => x === gid ? null : x), 3000); return }
    setArmGrp(null)
    const first = settings.groups.find(g => g.id !== gid)!.id
    updateSettings(st => { st.groups = st.groups.filter(g => g.id !== gid); st.cats.forEach(c => { if (c.g === gid) c.g = first }) })
    Object.keys(months).forEach(k => { if (months[k].items.some(r => r.g === gid)) updateMonth(k, m => m.items.forEach(r => { if (r.g === gid) r.g = first })) })
  }

  // ----- 끌어서 옮기기 -----
  const dragCb = useMemo(() => ({
    onMoveItem: (id: string, cat: string, beforeId: string) => updateMonth(cur, m => {
      const idx = m.items.findIndex(x => x.id === id); if (idx < 0) return
      const r = m.items.splice(idx, 1)[0]; r.c = cat; r.g = grpOf(cat, [])
      let at = -1
      if (beforeId) at = m.items.findIndex(x => x.id === beforeId)
      else m.items.forEach((x, i) => { if (x.c === cat) at = i + 1 })
      if (at < 0) m.items.push(r); else m.items.splice(at, 0, r)
    }),
    onMoveCat: (name: string, refName: string, after: boolean) => updateSettings(st => {
      const full = cats.map(n => ({ n, g: catGroup(st, n) || st.groups[0].id }))
      const mi = full.findIndex(x => x.n === name); if (mi < 0) return
      const m = full.splice(mi, 1)[0]
      const ri = full.findIndex(x => x.n === refName); if (ri < 0) return
      full.splice(after ? ri + 1 : ri, 0, m); st.cats = full
    }),
    onMoveGroup: (gid: string, refGid: string, after: boolean) => updateSettings(st => {
      const mi = st.groups.findIndex(g => g.id === gid); if (mi < 0) return
      const m = st.groups.splice(mi, 1)[0]
      const ri = st.groups.findIndex(g => g.id === refGid)
      if (ri < 0) st.groups.push(m); else st.groups.splice(after ? ri + 1 : ri, 0, m)
    }),
    ghostFor: (kind: 'item' | 'cat' | 'grp', id: string) => {
      const esc = (x: string) => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
      if (kind === 'item') { const r = mo.items.find(x => x.id === id); return `<span>${esc(r?.n || '(이름 없음)')}</span><span class="num">${won(r ? itemTotal(r) : 0)}</span>` }
      if (kind === 'cat') { const t = mo.items.filter(r => r.c === id).reduce((a, r) => a + itemTotal(r), 0); return `<span style="font-weight:700">${esc(id)}</span><span class="num">${won(t)}</span><span style="color:var(--muted);font-size:11px">분류 전체</span>` }
      const g = settings.groups.find(x => x.id === id); return `<span style="font-weight:700">${esc(g?.n || '')}</span><span style="color:var(--muted);font-size:11px">지출 묶음</span>`
    },
  }), [cur, mo, settings, cats.join('|')])
  useRowDrag(tableRef, dragCb)

  const pc = (pid: string) => ({ ['--pc' as any]: pcolors[pid] })

  return (
    <div className="scroll">
      <table className="led" ref={tableRef} style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col /><col style={{ width: mobile ? 44 : 92 }} />
          {persons.map(p => <col key={p.id} style={{ width: amtW }} />)}
          {!mobile && <col style={{ width: sumW }} />}{!mobile && <col style={{ width: 34 }} />}
        </colgroup>
        <thead><tr>
          <th className="l">항목</th><th className="l">회차</th>
          {persons.map(p => <th key={p.id} className="pcol" style={pc(p.id)}>{p.name}</th>)}
          {!mobile && <th>합계</th>}{!mobile && <th></th>}
        </tr></thead>
        <tbody>
          <tr className="income">
            <td className="cname">월급</td><td></td>
            {persons.map(p => <td key={p.id} className="pcol" style={pc(p.id)}><AmountInput value={mo.income?.[p.id] || 0} onChange={n => setIncome(p.id, n)} ariaLabel={p.name + ' 월급'} /></td>)}
            {!mobile && <td className="rt num rowtot">{won(s.income)}</td>}{!mobile && <td></td>}
          </tr>

          {cats.map(c => {
            const rows = mo.items.filter(r => r.c === c)
            const ci = catIndex(c), sl = slotCount(rows, pids), gid = grpOf(c, rows)
            const ct = rows.reduce((a, r) => a + itemTotal(r), 0)
            const catDel = <button className="del catdel" style={armCat === c ? { opacity: 1, color: '#fff', background: 'var(--bad)', fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' } : undefined} onClick={() => delCat(c)} aria-label="분류 삭제">{armCat === c ? (mobile ? rows.length + '개 지우기' : '항목 ' + rows.length + '개와 함께 지우기') : '×'}</button>
            return [
              <tr key={'c' + c} className={'cat k' + ci} data-cat={c}>
                <td className="cname"><span className="namecell">
                  <span className="cgrab grab" title="끌어서 분류 옮기기" aria-hidden="true">⠿</span>
                  <TextInput className="catname" value={c} onCommit={v => renameCat(c, v)} ariaLabel="분류 이름" />
                  <span className="cnt">{sl.n ? sl.d + '/' + sl.n : ''}</span>
                  {mobile && catDel}
                </span></td>
                <td><select className="grpsel" value={gid} onChange={e => setCatGroup(c, e.target.value)} aria-label="지출 묶음">{settings.groups.map(g => <option key={g.id} value={g.id}>{g.n}</option>)}</select></td>
                {persons.map(p => <td key={p.id}></td>)}
                {!mobile && <td className="csum num">{won(ct)}</td>}
                {!mobile && <td className="rt">{catDel}</td>}
              </tr>,
              ...rows.map(r => (
                <tr key={r.id} className={'item k' + ci + (allDone(r, pids) ? ' isdone' : '')} data-row={r.id} data-cat={c}>
                  <td><span className="namecell">
                    <span className="grab" title="끌어서 옮기기" aria-hidden="true">⠿</span>
                    <TextInput className="inp" value={r.n} onCommit={v => setName(r.id, v)} ariaLabel="항목 이름" placeholder="항목 이름" style={{ flex: 1 }} {...({ 'data-name': r.id } as any)} />
                    {mobile && <button className="del mdel" onClick={() => delItem(r.id)} aria-label="삭제" title="삭제">×</button>}
                  </span></td>
                  <td>{r.cur != null && r.tot != null
                    ? <span className={'inst' + (+r.cur >= +r.tot ? ' done' : '')}>
                        <InstInput value={r.cur} onCommit={n => setInst(r.id, 'cur', n)} label="현재 회차" /><span>/</span><InstInput value={r.tot} onCommit={n => setInst(r.id, 'tot', n)} label="총 회차" />
                        <button className="uninst" onClick={() => delInst(r.id)} title="일시불로 되돌리기" aria-label="할부 해제">×</button>
                      </span>
                    : <button className="addinst" onClick={() => addInst(r.id)}>할부</button>}</td>
                  {persons.map(p => {
                    const v = +(r.a?.[p.id] || 0), dn = !!r.d?.[p.id]
                    return (
                      <td key={p.id} className={'pcol' + (v > 0 && dn ? ' dn' : '')} style={pc(p.id)}><span className="amtwrap">
                        <input type="checkbox" className="done" checked={dn} style={v > 0 ? undefined : { visibility: 'hidden' }} onChange={e => setDone(r.id, p.id, e.target.checked)} aria-label={p.name + ' 지출 완료'} />
                        <AmountInput value={v} onChange={n => setAmt(r.id, p.id, n)} ariaLabel={p.name + ' 금액'} />
                      </span></td>
                    )
                  })}
                  {!mobile && <td className="rt num rowtot">{won(itemTotal(r))}</td>}
                  {!mobile && <td className="rt"><button className="del" onClick={() => delItem(r.id)} aria-label="삭제" title="삭제">×</button></td>}
                </tr>
              )),
              <tr key={'a' + c} className="addrow" data-cat={c}><td colSpan={nCols}><button className="addbtn" onClick={() => addItem(c)}>＋ {c} 항목</button></td></tr>,
            ]
          })}

          <tr className="addcat"><td colSpan={nCols}><span className="addcatform">
            <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat() } }} placeholder="새 분류 이름 (예: 육아, 자동차)" aria-label="새 분류 이름" />
            <select value={newCatG} onChange={e => setNewCatG(e.target.value)} aria-label="지출 구분">{settings.groups.map(g => <option key={g.id} value={g.id}>{g.n}에 포함</option>)}</select>
            <button className="btn" onClick={addCat}>＋ 분류 추가</button>
          </span></td></tr>

          {settings.groups.map(g => {
            const v = s.g[g.id] || {}
            const tot = Object.values(v).reduce((a, b) => a + b, 0)
            const grpDel = settings.groups.length > 1 ? <button className="del" style={armGrp === g.id ? { color: 'var(--bad-ink)', fontSize: 11 } : undefined} onClick={() => delGroup(g.id)} aria-label="묶음 삭제">{armGrp === g.id ? '지우기?' : '×'}</button> : null
            return (
              <tr key={g.id} className="tot grp" data-gid={g.id}>
                <td><span className="namecell"><span className="ggrab grab" title="끌어서 순서 바꾸기" aria-hidden="true">⠿</span>
                  <TextInput className="grpname" value={g.n} onCommit={n => renameGroup(g.id, n)} ariaLabel="묶음 이름" {...({ 'data-grp': g.id } as any)} />
                  {mobile && grpDel}</span></td>
                <td><label className="grpsub" title="켜면 남는 돈에서 이 묶음을 빼요. 끄면 따로만 집계돼요."><input type="checkbox" checked={g.sub !== false} onChange={e => setGroupSub(g.id, e.target.checked)} /> 남는돈 반영</label></td>
                {persons.map(p => <td key={p.id} className="rt num pcol" style={pc(p.id)}>{won(v[p.id] || 0)}</td>)}
                {!mobile && <td className="rt num">{won(tot)}</td>}
                {!mobile && <td className="rt">{grpDel}</td>}
              </tr>
            )
          })}
          <tr className="addrow"><td colSpan={nCols}><button className="addbtn" onClick={addGroup}>＋ 지출 묶음 추가</button></td></tr>

          <tr className="tot grand">
            <td>남는 돈</td><td></td>
            {persons.map(p => <td key={p.id} className="rt num" style={{ color: (s.net[p.id] || 0) >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>{won(s.net[p.id] || 0)}</td>)}
            {!mobile && <td className="rt num" style={{ color: s.netAll >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>{won(s.netAll)}</td>}{!mobile && <td></td>}
          </tr>
          <tr className="tot now">
            <td>지금 남은 돈 <span className="sub">체크한 지출만 뺌</span></td><td></td>
            {persons.map(p => <td key={p.id} className="rt num">{won(s.now[p.id] || 0)}</td>)}
            {!mobile && <td className="rt num">{won(s.nowAll)}</td>}{!mobile && <td></td>}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function useMobile() {
  const q = '(max-width: 600px)'
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])
  return m
}

function InstInput({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label: string }) {
  const [t, setT] = useState(String(value))
  const [f, setF] = useState(false)
  if (!f && t !== String(value)) setT(String(value))
  return <input value={t} inputMode="numeric" aria-label={label} onFocus={() => setF(true)} onChange={e => setT(e.target.value)}
    onBlur={() => { setF(false); const n = parseInt(t, 10); if (!isNaN(n) && n !== value) onCommit(n); else setT(String(value)) }}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}
