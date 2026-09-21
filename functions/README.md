# 반반 AI 분석 함수

1. Firebase 프로젝트를 Blaze(종량제)로 전환
2. `npm i -g firebase-tools && firebase login`
3. 프로젝트 루트에서 `firebase init functions` 대신, 이 폴더를 그대로 두고 `firebase.json` 에 `{"functions":{"source":"functions"}}` 추가
4. Gemini API 키 발급 (https://aistudio.google.com/apikey) → `firebase functions:secrets:set GEMINI_API_KEY`
5. `cd functions && npm i && cd .. && firebase deploy --only functions`
6. 배포 후 나오는 URL(예: https://asia-northeast3-banban-e9eaf.cloudfunctions.net/ai)을
   GitHub 저장소 Settings → Secrets → Actions 에 `VITE_AI_URL` 로 등록하고, deploy.yml/android.yml 의 build 단계 env 에 `VITE_AI_URL: ${{ secrets.VITE_AI_URL }}` 추가
