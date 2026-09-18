import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db, type User } from './firebase'
import type { Household, Person, UserDoc } from './types'

export function watchUserDoc(uid: string, cb: (u: UserDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), s => cb(s.exists() ? (s.data() as UserDoc) : null), () => cb(null))
}
export function watchHousehold(hid: string, cb: (h: Household | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'households', hid), s => {
    if (!s.exists()) return cb(null)
    const d = s.data() as any
    cb({ id: s.id, name: d.name || '우리집', persons: d.persons || [], memberUids: d.memberUids || [], inviteCode: d.inviteCode })
  }, () => cb(null))
}

function code(n = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''
  const arr = new Uint8Array(n); crypto.getRandomValues(arr)
  for (let i = 0; i < n; i++) s += chars[arr[i] % chars.length]
  return s
}

export async function createHousehold(user: User, name: string, myName: string, partnerName: string) {
  const hid = 'h' + code(10).toLowerCase()
  const persons: Person[] = [{ id: 'p1', name: myName, uid: user.uid }]
  if (partnerName.trim()) persons.push({ id: 'p2', name: partnerName.trim() })
  const inviteCode = code(6)
  await setDoc(doc(db, 'households', hid), { name, persons, memberUids: [user.uid], inviteCode, createdAt: serverTimestamp() })
  await setDoc(doc(db, 'invites', inviteCode), { hid, active: true, createdBy: user.uid, createdAt: serverTimestamp() })
  await setDoc(doc(db, 'users', user.uid), { hid, name: myName, email: user.email || '' }, { merge: true })
  return hid
}

export async function lookupInvite(codeStr: string): Promise<{ hid: string; household: Household } | null> {
  const c = codeStr.trim().toUpperCase()
  if (!c) return null
  const inv = await getDoc(doc(db, 'invites', c))
  if (!inv.exists() || inv.data().active === false) return null
  const hid = inv.data().hid as string
  const h = await getDoc(doc(db, 'households', hid))
  if (!h.exists()) return null
  const d = h.data() as any
  return { hid, household: { id: hid, name: d.name, persons: d.persons || [], memberUids: d.memberUids || [], inviteCode: d.inviteCode } }
}

// 초대 코드로 참여: 아직 계정이 연결되지 않은 사람 자리를 고르거나 새 자리를 만든다
export async function joinHousehold(user: User, codeStr: string, personId: string | null, newName: string) {
  const found = await lookupInvite(codeStr)
  if (!found) throw new Error('초대 코드를 찾을 수 없어요')
  const { hid, household } = found
  const persons = household.persons.map(p => ({ ...p }))
  let myName = newName
  if (personId) {
    const p = persons.find(x => x.id === personId)
    if (!p || (p.uid && p.uid !== user.uid)) throw new Error('이미 다른 사람이 연결된 자리예요')
    p.uid = user.uid; myName = p.name
  } else {
    const id = 'p' + (persons.length + 1)
    persons.push({ id, name: newName.trim() || (user.displayName || '나'), uid: user.uid })
  }
  await updateDoc(doc(db, 'households', hid), { persons, memberUids: arrayUnion(user.uid), joinCode: codeStr.trim().toUpperCase() })
  await setDoc(doc(db, 'users', user.uid), { hid, name: myName, email: user.email || '' }, { merge: true })
  return hid
}

export async function renameHousehold(hid: string, name: string) { await updateDoc(doc(db, 'households', hid), { name }) }
export async function savePersons(hid: string, persons: Person[]) { await updateDoc(doc(db, 'households', hid), { persons }) }
export async function regenerateInvite(hid: string, oldCode: string | undefined, uid: string) {
  const c = code(6)
  await setDoc(doc(db, 'invites', c), { hid, active: true, createdBy: uid, createdAt: serverTimestamp() })
  await updateDoc(doc(db, 'households', hid), { inviteCode: c })
  if (oldCode) await updateDoc(doc(db, 'invites', oldCode), { active: false }).catch(() => {})
  return c
}
export async function leaveHousehold(uid: string) {
  await setDoc(doc(db, 'users', uid), { hid: null }, { merge: true })
}
