import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCMSEVlPh_rQPuNz-DxS0Inx0tXGT4XHvI',
  authDomain: 'banban-e9eaf.firebaseapp.com',
  projectId: 'banban-e9eaf',
  storageBucket: 'banban-e9eaf.firebasestorage.app',
  messagingSenderId: '920872071338',
  appId: '1:920872071338:web:b4d965d9bfb58c6fcce0d3',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
auth.languageCode = 'ko'

// 오프라인 캐시 (지원 안 되는 브라우저면 조용히 넘어감)
enableIndexedDbPersistence(db).catch(() => {})

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, provider)
  } catch (e: any) {
    // 팝업이 막힌 환경(iOS 홈화면 앱 등)은 리디렉션으로
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
    } else if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
      throw e
    }
  }
}
export function logout() { return signOut(auth) }
export function watchAuth(cb: (u: User | null) => void) { return onAuthStateChanged(auth, cb) }
export type { User }
