import { useMemo, useState } from 'react'
import { useData } from '../store'
import { analyzeMonth, analyzeRange, summaryForAI, type Insight } from '../lib/insights'
import { aiEnabled, askAI } from '../ai'
import type { Person } from '../types'
import { label, wonShort } from '../lib/util'

interface Props { cur: string; keys: string[]; view: 'one' | 'multi'; range: number; persons: Person[] }

export default function Insights({ cur, keys, view, range, persons }: Props) {
  const { months, settings, loans, stocks, goals } = useData()
  const rangeKeys = useMemo(() => {
    if (view === 'one') return [cur]
    const upto = keys.filter(k => k <= cur)
    return range ? upto.slice(-range) : upto
  }, [view, cur, keys.join(','), range])

  const result = useMemo(() => view === 'one'
    ? { insights: analyzeMonth(cur, months, settings, persons), trend: null }
    : analyzeRange(rangeKeys, months, settings, persons)
  , [view, cur, rangeKeys.join(','), months, settings, persons])

  const [ai, setAi] = useState<{ key: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const aiKey = view + ':' + rangeKeys.join(',')
  const runAI = async () => {
    setBusy(true); setErr('')
    try {
      const sum = summaryForAI(view === 'one' ? 'month' : 'range', rangeKeys, months, settings, persons, goals.items, loans, stocks)
      setAi({ key: aiKey, text: await askAI(view === 'one' ? 'month' : 'range', sum) })
    } catch (e: any) { setErr(e?.message || 'AI 분석 실패') }
    setBusy(false)
  }

  const title = view === 'one' ? label(cur) + ' 분석' : `${rangeKeys.length}개월 흐름 분석`
  return (
    <div className="insights">
      <div className="inshead">
        <h3>{title}</h3>
        {aiEnabled() && <button className="btn aibtn" disabled={busy} onClick={runAI}>{busy ? '분석 중…' : ai?.key === aiKey ? 'AI 코멘트 다시 받기' : '✦ AI 코멘트 받기'}</button>}
      </div>
      {result.trend && <TrendBars t={result.trend} />}
      <ul className="inslist">
        {result.insights.map((x, i) => <InsightRow key={i} x={x} />)}
      </ul>
      {ai?.key === aiKey && <div className="aibox"><span className="aitag">✦ AI</span>{ai.text}</div>}
      {err && <div className="aibox err">{err}</div>}
      {!aiEnabled() && <p className="hint" style={{ margin: '8px 0 0' }}>규칙 기반 분석이에요. AI 코멘트 기능은 준비 중.</p>}
    </div>
  )
}

function InsightRow({ x }: { x: Insight }) {
  return (
    <li className={'ins ' + x.tone}>
      <span className="insdot" aria-hidden="true" />
      <div><div className="institle">{x.title}</div>{x.body && <div className="insbody">{x.body}</div>}</div>
    </li>
  )
}

// 작은 막대: 달별 수입(연한) / 지출(진한) / 남는 돈(점)
function TrendBars({ t }: { t: { keys: string[]; income: number[]; expense: number[]; net: number[] } }) {
  const max = Math.max(1, ...t.income, ...t.expense)
  return (
    <div className="trend" role="img" aria-label="달별 수입·지출 막대">
      {t.keys.map((k, i) => (
        <div className="tcol" key={k} title={`${label(k)} 수입 ${wonShort(t.income[i])} · 지출 ${wonShort(t.expense[i])} · 남음 ${wonShort(t.net[i])}`}>
          <div className="tbars">
            <i className="inc" style={{ height: (100 * t.income[i] / max) + '%' }} />
            <i className={'exp' + (t.net[i] < 0 ? ' over' : '')} style={{ height: (100 * t.expense[i] / max) + '%' }} />
          </div>
          <span className="tk">{+k.slice(5, 7)}월</span>
        </div>
      ))}
    </div>
  )
}
