// 반반 AI 분석 — Firebase Cloud Function (2세대)
// 배포: firebase deploy --only functions   (Blaze 요금제 필요)
// 비밀: firebase functions:secrets:set GEMINI_API_KEY
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const DAILY_LIMIT = 10          // 사용자당 하루 호출 횟수
const MODEL = 'gemini-2.0-flash'

const SYSTEM = {
  month: '너는 부부 가계부 앱 "반반"의 재무 코치야. 아래 한 달 가계부 요약을 보고 한국어로 4~6문장, 친근한 말투(해요체)로 코멘트해 줘. 구조: (1) 이번 달 한 줄 평가 (2) 눈에 띄는 지출 1~2개와 이유 추정 (3) 다음 달 실천 제안 1~2개(구체적인 금액 포함). 숫자는 만원 단위로 반올림해서 말해. 사람 이름 대신 P1, P2 로 부르지 말고 "첫 번째 분/두 번째 분"이라고 해. 투자 상품 추천은 하지 마.',
  range: '너는 부부 가계부 앱 "반반"의 재무 코치야. 아래 여러 달 가계부 요약을 보고 한국어로 5~7문장, 해요체로 흐름을 분석해 줘. 구조: (1) 기간 전체 평가(저축률) (2) 추세(늘거나 줄어드는 항목) (3) 반복되는 패턴 (4) 개선 제안 2개(구체적 금액). 숫자는 만원 단위. 사람은 "첫 번째 분/두 번째 분". 투자 상품 추천 금지.',
  goal: '너는 부부 가계부 앱 "반반"의 재무 코치야. 아래 목표와 가계부 요약을 보고 한국어 4~6문장, 해요체로 목표 달성 코칭을 해 줘. 지금 페이스로 가능한지, 부족하면 어디서 얼마를 줄이거나 늘릴지 구체적으로. 수익률 가정은 보수적으로. 특정 투자 상품 추천 금지.',
}

export const ai = onRequest({ region: 'asia-northeast3', secrets: [GEMINI_API_KEY], cors: true, maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return }
  try {
    const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '')
    if (!m) { res.status(401).send('no token'); return }
    const user = await getAuth().verifyIdToken(m[1])
    const { kind, summary } = req.body || {}
    if (!SYSTEM[kind] || typeof summary !== 'string' || summary.length > 20000) { res.status(400).send('bad request'); return }

    // 하루 호출 제한
    const day = new Date().toISOString().slice(0, 10)
    const ref = getFirestore().doc(`aiUsage/${user.uid}_${day}`)
    const snap = await ref.get()
    if ((snap.data()?.n || 0) >= DAILY_LIMIT) { res.status(429).send('limit'); return }
    await ref.set({ n: FieldValue.increment(1), uid: user.uid, day }, { merge: true })

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY.value()}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM[kind] }] }, contents: [{ role: 'user', parts: [{ text: summary }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 600 } }),
    })
    if (!r.ok) { console.error(await r.text()); res.status(502).send('llm error'); return }
    const j = await r.json()
    const text = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
    res.json({ text })
  } catch (e) { console.error(e); res.status(500).send('error') }
})
