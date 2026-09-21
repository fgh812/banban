import { useRef, useState } from 'react'
import { useData } from '../store'
import { label, short, sums, won, wonShort, wonAxis } from '../lib/util'
import type { Person } from '../types'

// 월별 수입·지출 막대 + 남는 돈 선. 한 축, 세 시리즈 (검증된 팔레트 1~3번)
export default function FlowChart({ keys, persons }: { keys: string[]; persons: Person[] }) {
  const { months, settings } = useData()
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ i: number; x: number; y: number; w: number } | null>(null)
  const W = 940, H = 320, L = 66, R = 16, T = 18, B = 46
  const data = keys.map(k => { const s = sums(months[k], settings, persons); return { k, inc: s.income, exp: s.expense, net: s.netAll } })
  let hi = 0, lo = 0
  data.forEach(d => { hi = Math.max(hi, d.inc, d.exp, d.net); lo = Math.min(lo, d.net) })
  const step = 1000000
  let top = Math.ceil(hi / step) * step; const bot = Math.floor(lo / step) * step
  if (top === bot) top = bot + step
  const pw = W - L - R, ph = H - T - B
  const y = (v: number) => T + ph - (v - bot) / (top - bot) * ph
  const bw = pw / Math.max(1, data.length), gap = Math.min(10, bw * 0.18), inner = (bw - gap * 2) / 2 - 1
  const ticks: number[] = []; for (let v = bot; v <= top + 1; v += step * 2) ticks.push(v); if (!ticks.includes(0)) ticks.push(0)
  const z = y(0)
  const pts = data.map((d, i) => [L + i * bw + gap + inner + 1, y(d.net)] as const)
  const bar = (x: number, val: number, fill: string, key: string) => <rect key={key} x={x.toFixed(1)} y={Math.min(y(val), z).toFixed(1)} width={inner.toFixed(1)} height={Math.max(2, Math.abs(y(val) - z)).toFixed(1)} rx={3} fill={fill} />

  return (
    <>
      <div className="legend">
        <i><span className="dot" style={{ ['--pc' as any]: 'var(--tae)' }} />수입</i>
        <i><span className="dot" style={{ ['--pc' as any]: 'var(--ye)' }} />지출</i>
        <i><span className="dot" style={{ ['--pc' as any]: 'var(--net)', borderRadius: '50%' }} />남는 돈</i>
      </div>
      <div className="chartbox" ref={box}>
        <div className="cs"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="월별 수입·지출·남는 돈 추이"
          onMouseLeave={() => setTip(null)}
          onMouseMove={e => {
            const t = e.target as SVGElement
            if (!t.classList?.contains('hit')) return
            const r = box.current!.getBoundingClientRect()
            setTip({ i: +t.getAttribute('data-i')!, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
          }}>
          {ticks.map(v => <g key={v}>
            <line x1={L} y1={y(v).toFixed(1)} x2={W - R} y2={y(v).toFixed(1)} stroke={v === 0 ? 'var(--line)' : 'var(--grid)'} />
            <text x={L - 9} y={(y(v) + 4).toFixed(1)} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="IBM Plex Mono, monospace">{v === 0 ? '0' : wonAxis(v)}</text>
          </g>)}
          {data.map((d, i) => { const x0 = L + i * bw + gap; return <g key={d.k}>
            {bar(x0, d.inc, 'var(--tae)', 'i')}{bar(x0 + inner + 2, d.exp, 'var(--ye)', 'e')}
            <text x={(x0 + inner + 1).toFixed(1)} y={H - B + 17} textAnchor="middle" fontSize={10.5} fill="var(--muted)" fontFamily="IBM Plex Mono, monospace">{short(d.k)}</text>
          </g> })}
          <polyline fill="none" stroke="var(--surface)" strokeWidth={5} strokeLinejoin="round" points={pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} />
          <polyline fill="none" stroke="var(--net)" strokeWidth={2} strokeLinejoin="round" points={pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} />
          {pts.map((p, i) => <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={4.5} fill="var(--net)" stroke="var(--surface)" strokeWidth={2} />)}
          {data.map((_, i) => <rect key={'h' + i} className="hit" data-i={i} x={(L + i * bw).toFixed(1)} y={T} width={bw.toFixed(1)} height={ph} fill="transparent" />)}
        </svg></div>
        {tip && (() => { const d = data[tip.i]; return (
          <div className="tip" style={tip.x > tip.w / 2 ? { right: Math.max(4, tip.w - tip.x + 14), top: Math.max(4, tip.y - 10) } : { left: Math.max(4, tip.x + 14), top: Math.max(4, tip.y - 10) }}>
            <b>{label(d.k)}</b>
            <div><span><span className="dot" style={{ ['--pc' as any]: 'var(--tae)' }} /> 수입</span><span className="num">{won(d.inc)}</span></div>
            <div><span><span className="dot" style={{ ['--pc' as any]: 'var(--ye)' }} /> 지출</span><span className="num">{won(d.exp)}</span></div>
            <div><span><span className="dot" style={{ ['--pc' as any]: 'var(--net)', borderRadius: '50%' }} /> 남는 돈</span><span className="num" style={{ color: d.net >= 0 ? 'var(--good-ink)' : 'var(--bad-ink)' }}>{won(d.net)}</span></div>
          </div>) })()}
      </div>
    </>
  )
}
