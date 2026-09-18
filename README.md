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
