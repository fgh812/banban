import { useData } from '../store'
import { catList, label, short, sums, won } from '../lib/util'
import type { Item, Person } from '../types'

interface Props { keys: string[]; cur: string; range: number; combine: boolean; persons: Person[]; pcolors: Record<string, string>; onJump: (k: string) => void }

export default function MultiView({ keys, cur, range, combine, persons, pcolors, onJump }: Props) {
  const { months, settings } = useData()
  const pids = persons.map(p => p.id)
  let ks = range ? keys.slice(-range) : keys.slice()
  if (range && !ks.includes(cur)) { const ci = keys.indexOf(cur); ks = keys.slice(Math.max(0, ci - range + 1), ci + 1) }
  const cats = catList(settings, months)
  const order: { c: string; n: string; key: string }[] = []; const seen = new Set<string>()
  ks.forEach(k => months[k].items.forEach(r => { const key = r.c + '\u0000' + r.n; if (!seen.has(key)) { seen.add(key); order.push({ c: r.c, n: r.n, key }) } }))
  type Agg = { a: Record<string, number>; d: Record<string, boolean>; cur?: number; tot?: number }
  const byMonth: Record<string, Record<string, Agg>> = {}
  ks.forEach(k => {
    const m: Record<string, Agg> = {}
    months[k].items.forEach((r: Item) => {
      const key = r.c + '\u0000' + r.n
      if (!m[key]) m[key] = { a: {}, d: Object.fromEntries(pids.map(p => [p, true])), cur: r.cur, tot: r.tot }
      pids.forEach(p => { const v = +(r.a?.[p] || 0); m[key].a[p] = (m[key].a[p] || 0) + v; if (v > 0 && !r.d?.[p]) m[key].d[p] = false })
    })
    byMonth[k] = m
  })
  const alt = (k: string) => ks.indexOf(k) % 2 === 1
  const S = Object.fromEntries(ks.map(k => [k, sums(months[k], settings, persons)]))
  const pc = (pid: string) => ({ ['--pc' as any]: pcolors[pid] })

  const cell = (v: number, opts: { inst?: string; sep?: boolean; cls?: string; pid?: string; k: string; done?: boolean }) => {
    const z = !v
    return <td key={opts.k + '|' + (opts.pid || 'all') + '|' + (opts.cls || '')} className={'c' + (z ? ' zero' : '') + (opts.sep ? ' sep' : '') + (opts.cls ? ' ' + opts.cls : '') + (opts.pid ? ' pcol' : '') + (alt(opts.k) ? ' alt' : '') + (opts.done && v > 0 ? ' dn' : '')} style={opts.pid ? pc(opts.pid) : undefined}>
      {z ? '–' : v.toLocaleString('ko-KR')}{opts.inst && <small>{opts.inst}</small>}
    </td>
  }
  const cellsFor = (k: string, a: Record<string, number>, d?: Record<string, boolean>, inst?: string, cls?: string) => {
    if (combine) { const tot = pids.reduce((x, p) => x + (a[p] || 0), 0); const dn = !!d && pids.every(p => !(a[p] > 0) || d[p]) && tot > 0; return [cell(tot, { inst, sep: true, cls, k, done: dn })] }
    return pids.map((p, i) => cell(a[p] || 0, { inst: i === 0 ? inst : undefined, sep: i === 0, cls, pid: p, k, done: !!d?.[p] }))
  }
  const totRow = (labelNode: React.ReactNode, pick: (s: ReturnType<typeof sums>) => Record<string, number>, signed?: boolean, key?: string) => (
    <tr key={key || String(labelNode)} className={'tot' + (signed ? ' grand' : '')}>
      <td className="name">{labelNode}</td>
      {ks.flatMap(k => {
        const v = pick(S[k])
        if (combine) { const n = pids.reduce((x, p) => x + (v[p] || 0), 0); return [cell(n, { sep: true, cls: signed ? (n >= 0 ? 'pos' : 'neg') : '', k })] }
        return pids.map((p, i) => cell(v[p] || 0, { sep: i === 0, cls: signed ? ((v[p] || 0) >= 0 ? 'pos' : 'neg') : '', pid: p, k }))
      })}
    </tr>
  )

  return (
    <div className="scroll">
      <table className="led multi">
        <thead>
          <tr>
            <th className="l name" rowSpan={combine ? 1 : 2}>항목</th>
            {ks.map(k => <th key={k} className={'mh sep' + (k === cur ? ' cur' : '') + (alt(k) ? ' alt' : '')} colSpan={combine ? 1 : pids.length} onClick={() => onJump(k)} title="이 달 편집하기">{short(k)}{months[k].note ? <span style={{ fontWeight: 400, color: 'var(--muted)' }}> {months[k].note}</span> : null}</th>)}
          </tr>
          {!combine && <tr>{ks.flatMap(k => persons.map((p, i) => <th key={k + p.id} className={'sub pcol' + (i === 0 ? ' sep' : '')} style={pc(p.id)}>{p.name}</th>))}</tr>}
        </thead>
        <tbody>
          <tr className="income"><td className="name cname">월급</td>{ks.flatMap(k => cellsFor(k, S[k].inc))}</tr>
          {cats.map((c, ci) => {
            const rows = order.filter(o => o.c === c); if (!rows.length) return null
            return [
              <tr key={'c' + c} className={'cat k' + (ci % 7)}><td className="name cname">{c}</td>
                {ks.flatMap(k => {
                  const v: Record<string, number> = {}; months[k].items.forEach(r => { if (r.c === c) pids.forEach(p => { v[p] = (v[p] || 0) + (+(r.a?.[p] || 0)) }) })
                  if (combine) return [<td key={k} className={'csum num sep' + (alt(k) ? ' alt' : '')}>{won(pids.reduce((x, p) => x + (v[p] || 0), 0))}</td>]
                  return pids.map((p, i) => <td key={k + p} className={'csum num pcol' + (i === 0 ? ' sep' : '') + (alt(k) ? ' alt' : '')} style={pc(p)}>{won(v[p] || 0)}</td>)
                })}
              </tr>,
              ...rows.map(o => (
                <tr key={o.key} className={'item k' + (ci % 7)}><td className="name">{o.n || '(이름 없음)'}</td>
                  {ks.flatMap(k => { const v = byMonth[k][o.key]; if (!v) return cellsFor(k, {}); const inst = v.cur != null && v.tot != null ? v.cur + '/' + v.tot : undefined; return cellsFor(k, v.a, v.d, inst) })}
                </tr>
              )),
            ]
          })}
          {settings.groups.map(g => totRow(<>{g.n}{g.sub === false && <span className="sub"> 남는 돈에서 안 뺌</span>}</>, s => s.g[g.id] || {}, false, g.id))}
          {totRow('남는 돈', s => s.net, true, 'net')}
          {!combine && <tr className="tot"><td className="name" style={{ fontWeight: 400, color: 'var(--ink-2)' }}>모두 합계</td>{ks.map(k => <td key={k} className={'c sep ' + (S[k].netAll >= 0 ? 'pos' : 'neg')} colSpan={pids.length}>{won(S[k].netAll)}</td>)}</tr>}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 8 }}>{ks.length ? label(ks[0]) + ' ~ ' + label(ks[ks.length - 1]) : ''}</p>
    </div>
  )
}
