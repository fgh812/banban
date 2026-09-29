import { useEffect, useState } from 'react'
import { watchAuth, IS_APP_LOGIN_PAGE, type User } from './firebase'
import { watchUserDoc, watchHousehold } from './household'
import { subscribe, useData, MOCK, loadMock } from './store'
import type { Household, UserDoc } from './types'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Budget from './components/Budget'

export interface Session { user: User; household: Household; me: string /* person id */ }

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [udoc, setUdoc] = useState<UserDoc | null | undefined>(undefined)
  const [household, setHousehold] = useState<Household | null | undefined>(undefined)
  const data = useData()

  useEffect(() => watchAuth(u => { setUser(u); if (!u) { setUdoc(undefined); setHousehold(undefined) } }), [])
  useEffect(() => {
    if (!user) return
    setUdoc(undefined)
    return watchUserDoc(user.uid, d => setUdoc(d || {}))
  }, [user?.uid])
  const hid = udoc?.hid || null
  useEffect(() => {
    if (!hid) { setHousehold(null); subscribe(null); return }
    setHousehold(undefined)
    subscribe(hid)
    return watchHousehold(hid, h => setHousehold(h))
  }, [hid])

  if (MOCK) return <MockApp />
  if (IS_APP_LOGIN_PAGE) return <Login />   // 앱 로그인 중계 페이지는 항상 로그인 화면
  if (user === undefined) return <Splash />
  if (user === null) return <Login />
  if (udoc === undefined) return <Splash />
  if (!hid || household === null) return <Onboarding user={user} />
  if (household === undefined || !data.loaded) return <Splash />

  const me = household.persons.find(p => p.uid === user.uid)?.id || household.persons[0]?.id || 'p1'
  return <Budget session={{ user, household, me }} />
}

function Splash() {
  return <div className="center"><div style={{ color: 'var(--muted)', fontSize: 13 }}>불러오는 중…</div></div>
}

function MockApp() {
  const data = useData()
  // ?mock&file=sample.json&p1=지호&p2=수아 로 데이터 파일과 이름을 바꿀 수 있음(스크린샷용)
  const q = new URLSearchParams(location.search)
  useEffect(() => { loadMock('/' + (q.get('file') || 'mock.json')) }, [])
  if (!data.loaded) return <Splash />
  const n1 = q.get('p1') || '태행', n2 = q.get('p2') || '예슬'
  const household: Household = { id: 'mock', name: '우리집', persons: [{ id: 'p1', name: n1, uid: 'u1' }, { id: 'p2', name: n2 }], memberUids: ['u1'], inviteCode: 'ABC123' }
  const user = { uid: 'u1', email: 'mock@example.com', displayName: n1, photoURL: null } as unknown as User
  return <Budget session={{ user, household, me: 'p1' }} />
}
