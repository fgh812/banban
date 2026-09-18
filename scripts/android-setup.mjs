// GitHub Actions 에서 `npx cap add android` 직후 실행: 서명·앱 이름·버전·google-services.json 을 채운다.
import fs from 'node:fs'
import path from 'node:path'

const root = 'android'
const app = path.join(root, 'app')
const env = process.env

// 1) google-services.json (Firebase 콘솔의 Android 앱 설정 파일)
if (env.GOOGLE_SERVICES_JSON) {
  fs.writeFileSync(path.join(app, 'google-services.json'), env.GOOGLE_SERVICES_JSON)
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
