import { useRef, useState } from 'react'
import { updateLoans, updateStocks, useData } from '../store'
import { balanceAt, label, loanTotals, newId, parseDec, short, stockTotal, stockValue, won, wonShort, wonAxis } from '../lib/util'
import type { Holding, Loan, LoanKind } from '../types'
import AmountInput, { TextInput } from './AmountInput'

const KIND_LABEL: Record<LoanKind, string> = { debt: '대출', saving: '적금', asset: '자산' }
const HUES = ['var(--tae)', 'var(--ye)', 'var(--net)']

export default function Loans({ cur, keys }: { cur: string; keys: string[] }) {
  const { loans, stocks } = useData()
  const t = loanTotals(loans, stocks, cur)
  const debts = loans.items.filter(x => x.kind === 'debt')
  const ci = keys.indexOf(cur), prevK = ci > 0 ? keys[ci - 1] : null
  const [arm, setArm] = useState<string | null>(null)
  const armDel = (id: string, fn: () => void) => { if (arm === id) { setArm(null); fn() } else { setArm(id); setTimeout(() => setArm(x => x === id ? null : x), 3000) } }

  const setField = (id: string, fn: (d: Loan) => void) => updateLoans(l => { const d = l.items.find(x => x.id === id); if (d) fn(d) })
  const addLoan = (kind: LoanKind) => {
    const id = newId()
    updateLoans(l => l.items.push({ id, kind, name: '새 ' + KIND_LABEL[kind], amount: 0, rate: 0, start: '', monthly: 0, delta: 0, history: { [cur]: 0 } }))
    setTimeout(() => { const el = document.querySelector(`input[data-lname="${id}"]`) as HTMLInputElement | null; el?.focus(); el?.select() }, 50)
  }

  return (
    <>
      <h2>대출과 자산</h2>
      <p className="hint">{label(cur)} 기준 · 부채 {won(t.debt)} · 적금 {won(t.saving)} · 자산 {won(t.asset)}{t.stock ? ' · 주식 ' + won(t.stock) : ''}</p>
      {debts.length > 0 && <div className="bar">{debts.map((d, i) => <span key={d.id} style={{ flex: Math.max(1, balanceAt(d, cur)), background: HUES[i % 3] }} title={d.name} />)}</div>}

      {(['debt', 'saving', 'asset'] as LoanKind[]).map(kind => {
        const items = loans.items.filter(d => (d.kind === 'saving' ? 'saving' : d.kind === 'debt' ? 'debt' : 'asset') === kind)
        const sum = kind === 'debt' ? t.debt : kind === 'saving' ? t.saving : t.asset
        return (
          <div className="lgroup" key={kind}>
            <div className="lhead"><h3>{KIND_LABEL[kind]}</h3><span className="num">{won(sum)}</span><button className="btn" onClick={() => addLoan(kind)}>＋ {KIND_LABEL[kind]}</button></div>
            <div className="loans">
              {items.map(d => {
                const c = d.kind === 'debt' ? HUES[debts.indexOf(d) % 3] : d.kind === 'saving' ? 'var(--asset)' : 'var(--muted)'
                const bal = balanceAt(d, cur)
                const diff = prevK ? bal - balanceAt(d, prevK) : null
                const delta = +d.delta || 0
                return (
                  <div className="loan" key={d.id}>
                    <div className="n"><span className="dot" style={{ ['--pc' as any]: c }} />
                      <TextInput value={d.name} onCommit={v => setField(d.id, x => { x.name = v })} ariaLabel="이름" {...({ 'data-lname': d.id } as any)} />
                      <button className="del" style={arm === d.id ? { color: 'var(--bad-ink)', fontSize: 11 } : undefined} onClick={() => armDel(d.id, () => updateLoans(l => { l.items = l.items.filter(x => x.id !== d.id) }))} aria-label="삭제">{arm === d.id ? '지우기?' : '×'}</button>
                    </div>
                    <div className="a num"><AmountInput value={bal} zeroAsBlank={false} style={{ textAlign: 'left', fontSize: 18, paddingLeft: 0 }} onChange={n => setField(d.id, x => { x.history = x.history || {}; x.history[cur] = n })} ariaLabel={d.name + ' ' + label(cur) + ' 잔액'} /></div>
                    {diff !== null && (diff === 0 ? <div className="chg flat">지난달과 같음</div>
                      : <div className={'chg ' + ((d.kind === 'debt' ? diff < 0 : diff > 0) ? 'pos' : 'neg')}>지난달보다 {diff > 0 ? '+' : '−'}{won(Math.abs(diff)).slice(1)}</div>)}
                    <div className="m">
                      <label className="lf"><DecInput value={d.rate} onCommit={v => setField(d.id, x => { x.rate = v })} width={52} placeholder="0" />%</label>
                      <label className="lf">월 <AmountInput value={d.monthly} style={{ width: 84, textAlign: 'right', fontSize: 11.5, padding: '2px 5px', border: '1px solid var(--grid)' }} onChange={n => setField(d.id, x => { x.monthly = n })} ariaLabel="월 납입액" /></label>
                      <label className="lf"><TextInput value={d.start || ''} onCommit={v => setField(d.id, x => { x.start = v })} placeholder="시작일" style={{ width: 82 }} ariaLabel="시작일" /></label>
                      <select value={kind} onChange={e => setField(d.id, x => { x.kind = e.target.value as LoanKind })} aria-label="구분">{(['debt', 'saving', 'asset'] as LoanKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                    </div>
                    <div className="delta"><span>매달</span><DeltaInput value={delta} onCommit={v => setField(d.id, x => { x.delta = v })} /><span>{d.kind === 'debt' ? '갚음 −' : '붓기 +'}</span></div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <Stocks />

      <p className="note">잔액은 위에서 고른 달 기준이에요. 「매달」 칸에 갚는 금액(−)이나 붓는 금액(+)을 적어두면 다음 달을 만들 때 잔액이 자동으로 바뀌어요.</p>
      <LoanChart keys={keys} />
    </>
  )
}

function DecInput({ value, onCommit, width, placeholder }: { value: number; onCommit: (n: number) => void; width: number; placeholder?: string }) {
  const [t, setT] = useState(value ? String(value) : '')
  const [f, setF] = useState(false)
  if (!f && t !== (value ? String(value) : '')) setT(value ? String(value) : '')
  return <input value={t} inputMode="decimal" style={{ width }} placeholder={placeholder} onFocus={() => setF(true)} onChange={e => setT(e.target.value)}
    onBlur={() => { setF(false); const n = parseDec(t); if (n !== value) onCommit(n) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}
function DeltaInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const fmt = (v: number) => (v > 0 ? '+' : '') + v.toLocaleString('ko-KR')
  const [t, setT] = useState(fmt(value)); const [f, setF] = useState(false)
  if (!f && t !== fmt(value)) setT(fmt(value))
  return <input value={t} inputMode="numeric" aria-label="매달 잔액 변화" onFocus={() => setF(true)} onChange={e => setT(e.target.value)}
    onBlur={() => { setF(false); const n = parseInt(t.replace(/[^0-9-]/g, ''), 10) || 0; if (n !== value) onCommit(n); else setT(fmt(value)) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}

// ---------- 주식 ----------
function Stocks() {
  const { stocks } = useData()
  const fx = +(stocks.fx?.USDKRW || 0)
  const [newAcct, setNewAcct] = useState('')
  const [arm, setArm] = useState<string | null>(null)
  const accts = (() => { const names = (stocks.accounts || []).slice(); stocks.holdings.forEach(h => { const a = h.account || ''; if (!names.includes(a)) names.push(a) }); return names })()
  const setH = (id: string, fn: (h: Holding) => void) => updateStocks(s => { const h = s.holdings.find(x => x.id === id); if (h) fn(h) })
  const addAcct = () => { const a = newAcct.trim(); if (!a || accts.includes(a)) return; updateStocks(s => { s.accounts = s.accounts || []; s.accounts.push(a) }); setNewAcct('') }
  const addStock = (account: string) => {
    const id = newId()
    updateStocks(s => s.holdings.push({ id, market: 'KR', ticker: '', name: '', qty: 0, price: 0, updatedAt: '', account }))
    setTimeout(() => (document.querySelector(`input[data-ticker="${id}"]`) as HTMLInputElement | null)?.focus(), 50)
  }
  const renameAcct = (oa: string, na: string) => { na = na.trim(); if (!na || na === oa || accts.includes(na)) return; updateStocks(s => { s.accounts = (s.accounts || []).map(a => a === oa ? na : a); if (!s.accounts.includes(na)) s.accounts.push(na); s.holdings.forEach(h => { if ((h.account || '') === oa) h.account = na }) }) }
  const today = () => new Date().toISOString().slice(0, 10)

  return (
    <div className="lgroup">
      <div className="lhead"><h3>주식</h3><span className="num">{stockTotal(stocks) ? won(stockTotal(stocks)) : ''}</span>
        <label className="fx">환율 <DecInput value={fx} width={78} placeholder="1,380" onCommit={v => updateStocks(s => { s.fx = { USDKRW: v, updatedAt: today() + ' (직접)' } })} /> 원/$ <span>{fx && stocks.fx?.updatedAt ? '(' + stocks.fx.updatedAt.slice(5, 10) + ')' : ''}</span></label>
        <span className="addacct"><input className="inp" value={newAcct} onChange={e => setNewAcct(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAcct() } }} placeholder="새 계좌 이름 (예: 키움 ISA)" style={{ width: 170, padding: '5px 8px', borderColor: 'var(--grid)' }} /><button className="btn" onClick={addAcct}>＋ 계좌</button></span>
      </div>
      <div className="scroll">
        <table className="led stocks">
          {(!stocks.holdings.length && !accts.length)
            ? <tbody><tr><td style={{ color: 'var(--muted)', fontSize: 12, padding: '10px 6px' }}>아직 계좌가 없어요. 위에 계좌 이름을 적고 ＋ 계좌를 누른 뒤, 그 계좌에 종목을 넣어주세요.</td></tr></tbody>
            : <>
              <thead><tr><th className="l">시장</th><th className="l">코드</th><th className="l">이름</th><th>수량</th><th>현재가</th><th>평가금액</th><th>갱신</th><th></th></tr></thead>
              <tbody>
                {accts.map(a => {
                  const rows = stocks.holdings.filter(h => (h.account || '') === a)
                  const sub = rows.reduce((x, h) => x + stockValue(h, fx), 0)
                  return [
                    <tr key={'a' + a} className="acct"><td colSpan={5}><TextInput className="acctname" value={a} onCommit={v => renameAcct(a, v)} placeholder="계좌 미지정" ariaLabel="계좌 이름" /> <button className="addbtn" onClick={() => addStock(a)}>＋ 종목</button></td>
                      <td className="asum num">{won(sub)}</td><td colSpan={2} className="rt">{!rows.length && <button className="del" onClick={() => updateStocks(s => { s.accounts = (s.accounts || []).filter(x => x !== a) })} aria-label="계좌 삭제" title="빈 계좌 지우기">×</button>}</td></tr>,
                    ...rows.map(h => (
                      <tr key={h.id}>
                        <td><select value={h.market} onChange={e => setH(h.id, x => { x.market = e.target.value as 'KR' | 'US' })}><option value="KR">국내</option><option value="US">미국</option></select></td>
                        <td><TextInput className="inp" style={{ width: 90, fontFamily: 'IBM Plex Mono, monospace' }} value={h.ticker} onCommit={v => setH(h.id, x => { x.ticker = v.trim().toUpperCase() })} placeholder="005930" {...({ 'data-ticker': h.id } as any)} /></td>
                        <td><TextInput className="inp" value={h.name} onCommit={v => setH(h.id, x => { x.name = v.trim() })} placeholder="이름" /></td>
                        <td><DecInput value={h.qty} width={80} placeholder="0" onCommit={v => setH(h.id, x => { x.qty = v })} /></td>
                        <td><DecInput value={h.price} width={110} placeholder={h.market === 'US' ? '$' : '₩'} onCommit={v => setH(h.id, x => { x.price = v; x.updatedAt = today() + ' (직접)' })} /></td>
                        <td className="rt num">{h.market === 'US' && !fx ? <span style={{ color: 'var(--muted)', fontSize: 11 }}>환율 필요</span> : won(stockValue(h, fx))}</td>
                        <td className="upd">{h.updatedAt ? h.updatedAt.slice(0, 10) : '–'}</td>
                        <td className="rt" style={{ whiteSpace: 'nowrap' }}>
                          <select value={h.account || ''} onChange={e => setH(h.id, x => { x.account = e.target.value })} aria-label="계좌 옮기기" style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 90 }}>{accts.map(x => <option key={x} value={x}>{x || '계좌 미지정'}</option>)}</select>
                          <button className="del" style={arm === h.id ? { color: 'var(--bad-ink)', fontSize: 11 } : undefined} onClick={() => { if (arm === h.id) { setArm(null); updateStocks(s => { s.holdings = s.holdings.filter(x => x.id !== h.id) }) } else { setArm(h.id); setTimeout(() => setArm(x => x === h.id ? null : x), 3000) } }} aria-label="삭제">{arm === h.id ? '지우기?' : '×'}</button>
                        </td>
                      </tr>
                    )),
                  ]
                })}
                <tr className="tot"><td colSpan={5}>주식 평가금액 합계</td><td className="rt num">{won(stockTotal(stocks))}</td><td colSpan={2}></td></tr>
              </tbody>
            </>}
        </table>
      </div>
      <p className="note" style={{ marginTop: 8 }}>종목 코드와 수량만 적어두면 평일 아침마다 전날 종가로 평가금액이 갱신돼요. 현재가를 직접 고쳐도 돼요.</p>
    </div>
  )
}

// ---------- 부채/자산 추이 ----------
function LoanChart({ keys }: { keys: string[] }) {
  const { loans, stocks } = useData()
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ i: number; x: number; y: number; w: number } | null>(null)
  if (!keys.length) return null
  const W = 940, H = 220, L = 66, R = 92, T = 16, B = 40
  const data = keys.map(k => { const t = loanTotals(loans, stocks, k); return { k, debt: t.debt, asset: t.plus } })
  let hi = 0; data.forEach(d => { hi = Math.max(hi, d.debt, d.asset) })
  if (!hi) return null
  const step = hi > 100000000 ? 50000000 : 10000000
  const top = Math.max(step, Math.ceil(hi / step) * step)
  const pw = W - L - R, ph = H - T - B
  const x = (i: number) => L + (data.length === 1 ? pw / 2 : i * pw / (data.length - 1))
  const y = (v: number) => T + ph - v / top * ph
  const ticks: number[] = []; for (let v = 0; v <= top; v += step) ticks.push(v)
  const series: [keyof typeof data[0], string, string][] = [['debt', 'var(--debt)', '부채'], ['asset', 'var(--asset)', '적금+자산+주식']]
  return (
    <>
      <div className="legend" style={{ marginTop: 18 }}>
        <i><span className="dot" style={{ ['--pc' as any]: 'var(--debt)' }} />총 부채</i>
        <i><span className="dot" style={{ ['--pc' as any]: 'var(--asset)' }} />적금 + 자산 + 주식</i>
      </div>
      <div className="chartbox" ref={box}>
        <div className="cs"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="월별 총 부채·총 자산 추이" onMouseLeave={() => setTip(null)}
          onMouseMove={e => { const t = e.target as SVGElement; if (!t.classList?.contains('hit')) return; const r = box.current!.getBoundingClientRect(); setTip({ i: +t.getAttribute('data-i')!, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }) }}>
          {ticks.map(v => <g key={v}><line x1={L} y1={y(v).toFixed(1)} x2={W - R} y2={y(v).toFixed(1)} stroke={v === 0 ? 'var(--line)' : 'var(--grid)'} /><text x={L - 9} y={(y(v) + 4).toFixed(1)} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="IBM Plex Mono, monospace">{v === 0 ? '0' : wonAxis(v)}</text></g>)}
          {data.map((d, i) => (data.length > 10 && i % 2 === 1) ? null : <text key={d.k} x={x(i).toFixed(1)} y={H - B + 17} textAnchor="middle" fontSize={10.5} fill="var(--muted)" fontFamily="IBM Plex Mono, monospace">{short(d.k)}</text>)}
          {series.map(([key, col, name]) => { const last = data[data.length - 1]; return <g key={key}>
            <polyline fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round" points={data.map((d, i) => x(i).toFixed(1) + ',' + y(d[key] as number).toFixed(1)).join(' ')} />
            <circle cx={x(data.length - 1).toFixed(1)} cy={y(last[key] as number).toFixed(1)} r={4} fill={col} stroke="var(--surface)" strokeWidth={2} />
            <text x={(x(data.length - 1) + 9).toFixed(1)} y={(y(last[key] as number) + 4).toFixed(1)} fontSize={11} fill="var(--ink-2)" fontFamily="IBM Plex Mono, monospace">{name.split('+')[0]} {wonAxis(last[key] as number)}</text>
          </g> })}
          {data.map((_, i) => { const x0 = i === 0 ? L : (x(i - 1) + x(i)) / 2, x1 = i === data.length - 1 ? W - R : (x(i) + x(i + 1)) / 2; return <rect key={'h' + i} className="hit" data-i={i} x={x0.toFixed(1)} y={T} width={(x1 - x0).toFixed(1)} height={ph} fill="transparent" /> })}
        </svg></div>
        {tip && (() => { const d = data[tip.i]; return <div className="tip" style={tip.x > tip.w / 2 ? { right: Math.max(4, tip.w - tip.x + 14), top: Math.max(4, tip.y - 10) } : { left: Math.max(4, tip.x + 14), top: Math.max(4, tip.y - 10) }}>
          <b>{label(d.k)}</b>
          <div><span><span className="dot" style={{ ['--pc' as any]: 'var(--debt)' }} /> 총 부채</span><span className="num">{won(d.debt)}</span></div>
          <div><span><span className="dot" style={{ ['--pc' as any]: 'var(--asset)' }} /> 적금+자산+주식</span><span className="num">{won(d.asset)}</span></div>
        </div> })()}
      </div>
    </>
  )
}
