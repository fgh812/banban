// AI 코멘트: Cloud Function 을 통해 LLM 호출. URL 이 비어 있으면 기능 숨김.
import { auth } from './firebase'
import { MOCK } from './store'

export const AI_URL: string = (import.meta as any).env?.VITE_AI_URL || ''
export const aiEnabled = () => MOCK || !!AI_URL

export async function askAI(kind: 'month' | 'range' | 'goal', summary: string): Promise<string> {
  if (MOCK) { await new Promise(r => setTimeout(r, 800)); return '(mock) 이번 달은 고정 지출 비중이 높은 편이에요. 보험료를 한 번 점검해 보고, 남는 돈의 절반은 적금으로 자동이체해 두는 걸 추천해요.' }
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('로그인이 필요해요')
  const r = await fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ kind, summary }) })
  if (!r.ok) throw new Error(r.status === 429 ? '오늘 AI 분석 횟수를 다 썼어요. 내일 다시 시도해 주세요.' : 'AI 분석에 실패했어요 (' + r.status + ')')
  const j = await r.json()
  return j.text || ''
}
