# 반반 – 둘이 쓰는 가계부

React + Vite + Firebase(Google 로그인, Firestore) + PWA.

## 개발
```
npm install
npm run dev
```
## 배포
`main` 에 푸시하면 GitHub Actions 가 GitHub Pages 로 배포합니다.
## 주가 갱신
`.github/workflows/stocks.yml` 이 평일 아침마다 `scripts/update_stocks.py` 를 실행합니다.
저장소 Secrets 에 `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 JSON 전체)가 필요합니다.
## Firestore 규칙
`firestore.rules` 를 Firebase 콘솔 → Firestore → 규칙 에 붙여넣으세요.

## Android 구글 로그인이 안 될 때 (기록)

Play 스토어로 설치한 앱에서만 `[10] DEVELOPER_ERROR` / `[16] Account reauth failed` 가 나고 apk 직접 설치는 되는 경우:
Play 앱 서명이 **양자 컴퓨팅 대비(베타)** 키로도 서명하는데, Google 로그인 서버는 이걸 SHA-1 이 아니라 **SHA-256** 으로 대조한다.

해결: Play Console → 테스트 및 출시 → 앱 무결성 → 앱 서명 → "기존 키" 와 "양자 내성 암호화 키" 의 **SHA-256** 두 개를
Firebase 콘솔 → 프로젝트 설정 → Android 앱 → 디지털 지문 추가에 등록. (빌드 다시 안 해도 됨, 반영까지 몇 분.)
SHA-1 만 넣으면 안 된다. 업로드 키 SHA-1 은 apk 직접 설치용으로 그대로 둔다.
