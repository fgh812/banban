import { useData } from '../store'
import { won, type Sums } from '../lib/util'
import type { Person } from '../types'

export default function Tiles({ s, persons, pcolors }: { s: Sums; persons: Person[]; pcolors: Record<string, string> }) {
  const { settings } = useData()
  const split = (v: Record<string, number>) => (
    <div className="split">{persons.map(p => <i key={p.id}><span className="dot" style={{ ['--pc' as any]: pcolors[p.id] }} />{won(v[p.id] || 0)}</i>)}</div>
  )
  const nowSum = s.nowAll
  return (
    <div className="tiles" style={{ marginBottom: 16 }}>
      <div className="tile"><div className="k">수입</div><div className="v num">{won(s.income)}</div>{split(s.inc)}</div>
      {settings.groups.map(g => {
        const v = s.g[g.id] || {}
        const tot = Object.values(v).reduce((a, b) => a + b, 0)
        return <div className="tile" key={g.id}><div className="k">{g.n}{g.sub === false && <span className="k2"> 남는 돈에서 안 뺌</span>}</div><div className="v num">{won(tot)}</div>{split(v)}</div>
      })}
      <div className="tile net">
        <div className="k">남는 돈 <span className="k2">(전부 나가면)</span></div>
        <div className={'v num ' + (s.netAll >= 0 ? 'pos' : 'neg')}>{s.netAll < 0 ? '−' : ''}{won(Math.abs(s.netAll))}</div>
        {split(s.net)}
        {s.dn > 0 && <div className="now">체크한 지출만 빼면 지금 <b className="num">{won(nowSum)}</b></div>}
      </div>
    </div>
  )
}
