// GitHub Actions 에서 `npx cap add android` 직후 실행: 서명·앱 이름·버전·google-services.json 을 채운다.
import fs from 'node:fs'
import path from 'node:path'

const root = 'android'
const app = path.join(root, 'app')
const env = process.env

// 1) google-services.json (Firebase 콘솔의 Android 앱 설정 파일)
// 구글 로그인(idToken)에 쓰는 웹 클라이언트 ID. google-services.json 에 client_type 3 항목이 없으면
// default_web_client_id 리소스가 생성되지 않아 로그인이 DEVELOPER_ERROR(10) 로 실패하므로 여기서 보정한다.
const WEB_CLIENT_ID = '920872071338-pdkou95ini1k7opng7fvoik2nomk8af2.apps.googleusercontent.com'
if (env.GOOGLE_SERVICES_JSON) {
  let gs = env.GOOGLE_SERVICES_JSON
  try {
    const j = JSON.parse(gs)
    for (const c of j.client || []) {
      const pkg = c.client_info?.android_client_info?.package_name
      c.oauth_client = c.oauth_client || []
      console.log('google-services.json client', pkg, 'oauth_client:', c.oauth_client.map(o => `${o.client_type}:${(o.client_id || '').slice(0, 24)}… ${o.android_info?.certificate_hash?.slice(0, 8) || ''}`).join(' | '))
      if (pkg === 'kr.banban.app' && !c.oauth_client.some(o => o.client_type === 3)) {
        c.oauth_client.push({ client_id: WEB_CLIENT_ID, client_type: 3 })
        console.log('web client (type 3) was missing — injected', WEB_CLIENT_ID)
      }
      const svc = c.services = c.services || {}
      const other = svc.appinvite_service = svc.appinvite_service || { other_platform_oauth_client: [] }
      other.other_platform_oauth_client = other.other_platform_oauth_client || []
      if (!other.other_platform_oauth_client.some(o => o.client_type === 3)) other.other_platform_oauth_client.push({ client_id: WEB_CLIENT_ID, client_type: 3 })
    }
    gs = JSON.stringify(j, null, 2)
  } catch (e) { console.warn('google-services.json parse failed, writing as-is:', e.message) }
  fs.writeFileSync(path.join(app, 'google-services.json'), gs)
  console.log('google-services.json written')
} else console.warn('GOOGLE_SERVICES_JSON 이 없어요 — 구글 로그인이 앱에서 동작하지 않습니다')

// 2) 앱 이름
const strings = path.join(app, 'src/main/res/values/strings.xml')
let sx = fs.readFileSync(strings, 'utf8')
sx = sx.replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">반반</string>')
       .replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">반반</string>')
fs.writeFileSync(strings, sx)

// 3) 버전·서명
const gradlePath = path.join(app, 'build.gradle')
let g = fs.readFileSync(gradlePath, 'utf8')
const versionCode = parseInt(env.VERSION_CODE || '1', 10)
const versionName = env.VERSION_NAME || '1.0.0'
g = g.replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]*"/, `versionName "${versionName}"`)
if (env.KEYSTORE_BASE64) {
  fs.writeFileSync(path.join(app, 'upload.jks'), Buffer.from(env.KEYSTORE_BASE64, 'base64'))
  g = g.replace(/android \{/, `android {
    signingConfigs {
        release {
            storeFile file('upload.jks')
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }
    }`)
  g = g.replace(/buildTypes \{\s*release \{/, `buildTypes {
        release {
            signingConfig signingConfigs.release`)
  console.log('signing config added')
}
fs.writeFileSync(gradlePath, g)

// 4) 다크 모드에서 웹뷰 배경이 흰색으로 번쩍이지 않게
const styles = path.join(app, 'src/main/res/values/styles.xml')
if (fs.existsSync(styles)) {
  let st = fs.readFileSync(styles, 'utf8')
  if (!st.includes('android:windowBackground')) st = st.replace('</style>', '    <item name="android:windowBackground">#EFF1F0</item>\n    </style>')
  fs.writeFileSync(styles, st)
}
console.log('android setup done: versionCode', versionCode, 'versionName', versionName)

// 5) 딥링크 kr.banban.app://auth (브라우저 로그인 → 앱 복귀)
const manifest = path.join(app, 'src/main/AndroidManifest.xml')
let m = fs.readFileSync(manifest, 'utf8')
if (!m.includes('android:scheme="kr.banban.app"')) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="kr.banban.app" android:host="auth" />
            </intent-filter>`
  m = m.replace(/(<\/intent-filter>)/, `$1${filter}`)
  fs.writeFileSync(manifest, m)
  console.log('deep link intent-filter added')
}
