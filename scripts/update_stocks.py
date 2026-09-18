"""모든 가계부의 주식 종목 종가와 원/달러 환율을 갱신한다.
- 국내(KR): 네이버 금융 종목 페이지에서 현재가
- 미국(US): stooq CSV 종가
- 환율: stooq usdkrw
못 찾은 종목은 값을 바꾸지 않는다."""
import json, os, re, sys, datetime, requests
import firebase_admin
from firebase_admin import credentials, firestore

sa = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
firebase_admin.initialize_app(credentials.Certificate(sa))
db = firestore.client()
today = datetime.date.today().isoformat()
UA = {"User-Agent": "Mozilla/5.0 (banban stock updater)"}
cache = {}

def stooq(sym):
    if sym in cache: return cache[sym]
    try:
        r = requests.get(f"https://stooq.com/q/l/?s={sym}&f=sd2t2ohlcv&h&e=csv", headers=UA, timeout=15)
        rows = r.text.strip().splitlines()
        if len(rows) >= 2:
            cols = rows[1].split(",")
            close = cols[6]
            if close and close != "N/D":
                cache[sym] = (float(close), cols[1]); return cache[sym]
    except Exception as e:
        print("stooq fail", sym, e)
    cache[sym] = None; return None

def naver(code):
    key = "kr:" + code
    if key in cache: return cache[key]
    try:
        r = requests.get(f"https://finance.naver.com/item/main.naver?code={code}", headers=UA, timeout=15)
        r.encoding = "euc-kr"
        m = re.search(r'<p class="no_today">.*?<span class="blind">([\d,]+)</span>', r.text, re.S)
        name = re.search(r'<div class="wrap_company">\s*<h2>\s*<a[^>]*>([^<]+)</a>', r.text, re.S)
        if m:
            cache[key] = (float(m.group(1).replace(",", "")), name.group(1).strip() if name else None); return cache[key]
    except Exception as e:
        print("naver fail", code, e)
    cache[key] = None; return None

fx = stooq("usdkrw")
print("USDKRW", fx)
updated = 0
for hh in db.collection("households").stream():
    ref = hh.reference.collection("meta").document("stocks")
    snap = ref.get()
    if not snap.exists: continue
    data = snap.to_dict() or {}
    holdings = data.get("holdings") or []
    changed = False
    for h in holdings:
        t = (h.get("ticker") or "").strip()
        if not t: continue
        if h.get("market") == "US":
            res = stooq(t.lower().replace(".", "-") + ".us")
            if res:
                h["price"], h["updatedAt"] = res[0], res[1] or today; changed = True
        else:
            res = naver(t)
            if res:
                h["price"], h["updatedAt"] = res[0], today; changed = True
                if not h.get("name") and res[1]: h["name"] = res[1]
    if fx:
        data["fx"] = {"USDKRW": fx[0], "updatedAt": fx[1] or today}; changed = True
    if changed:
        data["holdings"] = holdings
        ref.set(data); updated += 1
print("updated households:", updated)
