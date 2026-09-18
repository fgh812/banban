import { useEffect, useRef } from 'react'
import { useData } from '../store'
import { short, sums, wonShort } from '../lib/util'
import type { Person } from '../types'

export default function MonthRail({ keys, cur, onPick, persons }: { keys: string[]; cur: string; onPick: (k: string) => void; persons: Person[] }) {
  const data = useData()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-current="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [cur])
  return (
    <div className="rail" ref={ref}>
      {keys.map(k => {
        const s = sums(data.months[k], data.settings, persons)
        return (
          <button key={k} className="chip" aria-current={k === cur} onClick={() => onPick(k)}>
            <b>{short(k)}</b>
            <span className={s.netAll >= 0 ? 'up' : 'down'}>{s.netAll >= 0 ? '+' : '−'}{wonShort(Math.abs(s.netAll))}</span>
          </button>
        )
      })}
    </div>
  )
}
