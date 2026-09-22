"""모든 가계부의 주식 종목 종가와 원/달러 환율을 갱신한다.
소스를 여러 개 두고 앞에서부터 시도한다 (GitHub 러너 IP 가 차단/제한되는 경우가 있어서).
- 국내(KR): 네이버 모바일 증권 API → 네이버 금융 종목 페이지
- 미국(US): Yahoo Finance chart API → stooq CSV
- 환율:     open.er-api.com → frankfurter(ECB) → Yahoo KRW=X → stooq
못 찾은 종목은 값을 바꾸지 않는다."""
import json, os, re, datetime, requests
import firebase_admin
from firebase_admin import credentials, firestore

sa = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
firebase_admin.initialize_app(credentials.Certificate(sa))
db = firestore.client()
today = datetime.date.today().isoformat()
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "*/*", "Accept-Language": "ko,en;q=0.8"}
cache = {}

def get(url, **kw):
    r = requests.get(url, headers=UA, timeout=15, **kw)
    r.raise_for_status()
    return r

def try_all(label, fns):
    """fns: [(이름, 함수)] — 처음 성공하는 값 반환, 전부 실패하면 None (실패 이유는 로그)"""
    for name, fn in fns:
        try:
            v = fn()
            if v: print(f"  {label}: {name} OK -> {v}"); return v
            print(f"  {label}: {name} empty")
        except Exception as e:
            print(f"  {label}: {name} fail: {type(e).__name__} {str(e)[:120]}")
    return None

# ---------- 환율 ----------
def fx_erapi():
    j = get("https://open.er-api.com/v6/latest/USD").json()
    v = (j.get("rates") or {}).get("KRW")
    d = (j.get("time_last_update_utc") or "")[:16]
    return (float(v), today) if v else None

def fx_frankfurter():
    j = get("https://api.frankfurter.app/latest?from=USD&to=KRW").json()
    v = (j.get("rates") or {}).get("KRW")
    return (float(v), j.get("date") or today) if v else None

def yahoo_close(sym):
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d").json()
    res = (j.get("chart") or {}).get("result") or []
    if not res: return None
    r0 = res[0]
    meta = r0.get("meta") or {}
    closes = ((r0.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    stamps = r0.get("timestamp") or []
    price, ts = None, None
    for c, t in zip(reversed(closes), reversed(stamps)):
        if c is not None: price, ts = c, t; break
    if price is None and meta.get("regularMarketPrice"): price, ts = meta["regularMarketPrice"], meta.get("regularMarketTime")
    if price is None: return None
    d = datetime.datetime.utcfromtimestamp(ts).date().isoformat() if ts else today
    return (float(price), d, meta.get("longName") or meta.get("shortName"))

def stooq(sym):
    r = get(f"https://stooq.com/q/l/?s={sym}&f=sd2t2ohlcv&h&e=csv")
    rows = r.text.strip().splitlines()
    if len(rows) >= 2:
        cols = rows[1].split(",")
        if len(cols) > 6 and cols[6] and cols[6] != "N/D":
            return (float(cols[6]), cols[1] or today)
    return None

def get_fx():
    if "fx" not in cache:
        cache["fx"] = try_all("USDKRW", [
            ("er-api", fx_erapi),
            ("frankfurter", fx_frankfurter),
            ("yahoo", lambda: (lambda y: (y[0], y[1]) if y else None)(yahoo_close("KRW=X"))),
            ("stooq", lambda: stooq("usdkrw")),
        ])
    return cache["fx"]

# ---------- 미국 주식 ----------
def get_us(ticker):
    key = "us:" + ticker
    if key not in cache:
        y = ticker.upper().replace(".", "-")
        cache[key] = try_all(ticker, [
            ("yahoo", lambda: yahoo_close(y)),
            ("stooq", lambda: (lambda s: (s[0], s[1], None) if s else None)(stooq(y.lower() + ".us"))),
        ])
    return cache[key]

# ---------- 국내 주식 ----------
def naver_mobile(code):
    j = get(f"https://m.stock.naver.com/api/stock/{code}/basic").json()
    v = j.get("closePrice") or j.get("currentPrice")
    if not v: return None
    return (float(str(v).replace(",", "")), today, j.get("stockName"))

def naver_page(code):
    r = get(f"https://finance.naver.com/item/main.naver?code={code}")
    r.encoding = "euc-kr"
    m = re.search(r'<p class="no_today">.*?<span class="blind">([\d,]+)</span>', r.text, re.S)
    name = re.search(r'<div class="wrap_company">\s*<h2>\s*<a[^>]*>([^<]+)</a>', r.text, re.S)
    if not m: return None
    return (float(m.group(1).replace(",", "")), today, name.group(1).strip() if name else None)

def get_kr(code):
    key = "kr:" + code
    if key not in cache:
        cache[key] = try_all(code, [
            ("naver-mobile", lambda: naver_mobile(code)),
            ("naver-page", lambda: naver_page(code)),
            ("yahoo", lambda: yahoo_close(code + ".KS") or yahoo_close(code + ".KQ")),
        ])
    return cache[key]

# ---------- 갱신 ----------
print("date", today)
fx = get_fx()
updated = skipped = 0
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
        res = get_us(t) if h.get("market") == "US" else get_kr(t)
        if res:
            h["price"], h["updatedAt"] = res[0], res[1] or today; changed = True
            if not h.get("name") and len(res) > 2 and res[2]: h["name"] = res[2]
        else:
            skipped += 1
    if fx:
        data["fx"] = {"USDKRW": fx[0], "updatedAt": fx[1] or today}; changed = True
    if changed:
        data["holdings"] = holdings
        ref.set(data); updated += 1
print(f"updated households: {updated}, tickers not found: {skipped}")
if not fx: print("::warning::환율을 어느 소스에서도 못 받았어요")
