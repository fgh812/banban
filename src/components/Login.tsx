import { useState } from 'react'
import { useEffect, useState as useS } from 'react'
import { loginWithGoogle, loginViaBrowser, isNativeApp, lastNativeError, IS_APP_LOGIN_PAGE, loginForApp, initDeepLinkLogin } from '../firebase'

export default function Login() {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { initDeepLinkLogin(setErr) }, [])
  if (IS_APP_LOGIN_PAGE) return <AppLoginBridge />
  return (
    <div className="center">
      <div className="authbox">
        <h1>반반</h1>
        <p className="tag">둘이 쓰는 가계부 — 월급부터 남는 돈까지, 두 사람 열로 나란히.</p>
        <button className="gbtn" disabled={busy} onClick={async () => {
          setBusy(true); setErr('')
          try { await loginWithGoogle(); if (lastNativeError) setErr('앱 로그인 실패 → 브라우저로 로그인해요. (' + lastNativeError + ')') } catch (e: any) { setErr('로그인에 실패했어요. 잠시 후 다시 시도해 주세요. (' + (e?.code || e?.message || '') + ')') }
          setBusy(false)
        }}>
          <GoogleIcon /> Google 계정으로 시작하기
        </button>
        {isNativeApp && <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => { setErr(''); loginViaBrowser().catch((e: any) => setErr('브라우저를 열지 못했어요 (' + (e?.message || '') + ')')) }}>브라우저로 로그인</button>}
        {err && <div className="err-msg">{err}</div>}
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 28 }}>가계부 데이터는 초대한 사람끼리만 볼 수 있어요.<br /><span style={{ opacity: .6 }}>반반 {(import.meta as any).env?.VITE_BUILD || 'web'}</span></p>
      </div>
    </div>
  )
}

// 앱에서 브라우저로 넘어온 로그인 페이지: 로그인 → 앱으로 돌아가는 링크 표시
function AppLoginBridge() {
  const [link, setLink] = useS('')
  const [err, setErr] = useS('')
  const [busy, setBusy] = useS(false)
  useEffect(() => { if (link) { try { location.href = link } catch {} } }, [link])
  return (
    <div className="center">
      <div className="authbox">
        <h1>반반</h1>
        <p className="tag">앱 로그인 — 구글 계정을 고르면 앱으로 돌아가요.</p>
        {!link ? (
          <button className="gbtn" disabled={busy} onClick={async () => {
            setBusy(true); setErr('')
            try { setLink(await loginForApp()) } catch (e: any) { setErr('로그인에 실패했어요 (' + (e?.code || e?.message || '') + ')') }
            setBusy(false)
          }}><GoogleIcon /> Google 계정으로 로그인</button>
        ) : (
          <a className="gbtn" href={link} style={{ textDecoration: 'none' }}>반반 앱으로 돌아가기 →</a>
        )}
        {err && <div className="err-msg">{err}</div>}
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 28 }}>{link ? '자동으로 안 돌아가면 위 버튼을 눌러 주세요.' : '이 창은 앱 로그인용이에요.'}</p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/>
      <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  )
}
