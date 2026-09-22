import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithCredential, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

// 앱 → 브라우저 로그인 → 앱으로 돌아오는 딥링크
export const WEB_LOGIN_URL = 'https://fgh812.github.io/banban/?app=1'
export const APP_SCHEME = 'kr.banban.app'
export const IS_APP_LOGIN_PAGE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('app') === '1'

export const isNative = Capacitor.isNativePlatform()

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
  if (isNative) {
    // 앱(안드로이드/iOS): 네이티브 구글 로그인 → 같은 계정으로 JS SDK 도 로그인
    // 일부 기기(삼성 등)에서 Credential Manager 가 "[16] Account reauth failed" 를 내므로
    // 기존 Google Sign-In 방식을 먼저 쓰고, 실패하면 Credential Manager 로 한 번 더 시도
    let r
    try { r = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false }) }
    catch (e1: any) {
      if (/cancel/i.test(e1?.message || '')) return
      try { r = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true }) }
      catch (e2: any) {
        if (/cancel/i.test(e2?.message || '')) return
        // 네이티브 로그인이 기기 문제(예: "[16] Account reauth failed")로 막히면 브라우저에서 로그인
        console.warn('native google sign-in failed, falling back to browser', e2)
        await loginViaBrowser()
        return
      }
    }
    const idToken = r.credential?.idToken
    if (!idToken) throw new Error('구글 로그인 정보를 받지 못했어요')
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, r.credential?.accessToken))
    return
  }
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
// 브라우저(Chrome)에서 웹 버전으로 로그인한 뒤 kr.banban.app://auth#… 딥링크로 토큰을 받아 앱에 로그인
export async function loginViaBrowser() {
  await Browser.open({ url: WEB_LOGIN_URL, presentationStyle: 'popover' })
}
let deepLinkReady = false
export function initDeepLinkLogin(onError: (m: string) => void) {
  if (!isNative || deepLinkReady) return
  deepLinkReady = true
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(APP_SCHEME + '://auth')) return
    try {
      const h = new URLSearchParams(url.split('#')[1] || '')
      const idToken = h.get('id'), accessToken = h.get('at') || undefined
      if (!idToken) throw new Error('토큰이 없어요')
      try { await Browser.close() } catch {}
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))
    } catch (e: any) { onError('앱 로그인에 실패했어요 (' + (e?.code || e?.message || '') + ')') }
  })
}
// 웹(브라우저) 쪽: ?app=1 로 열렸으면 로그인 후 앱으로 토큰을 돌려보냄
export async function loginForApp(): Promise<string> {
  const result = await signInWithPopup(auth, provider)
  const cred = GoogleAuthProvider.credentialFromResult(result)
  if (!cred?.idToken) throw new Error('구글 토큰을 받지 못했어요')
  const link = `${APP_SCHEME}://auth#id=${encodeURIComponent(cred.idToken)}${cred.accessToken ? '&at=' + encodeURIComponent(cred.accessToken) : ''}`
  await signOut(auth).catch(() => {})   // 브라우저에는 로그인 상태를 남기지 않음
  return link
}
export async function logout() { if (isNative) { try { await FirebaseAuthentication.signOut() } catch {} } await signOut(auth) }
export function watchAuth(cb: (u: User | null) => void) { return onAuthStateChanged(auth, cb) }
export type { User }
