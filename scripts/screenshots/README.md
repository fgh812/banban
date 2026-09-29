# 스토어 스크린샷 만들기
1. `npm run build && cd dist && python3 -m http.server 4173`
2. `pip install playwright pillow && playwright install chromium`
3. `python3 scripts/screenshots/capture.py` → `shots/*.png` (360×640 @3x = 1080×1920, `public/sample.json` 익명 데이터 사용)
4. `python3 scripts/screenshots/frame.py` → `play-screenshots/01..08.png`
