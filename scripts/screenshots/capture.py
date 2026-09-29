import os, asyncio
from playwright.async_api import async_playwright
OUT='shots'; os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width':360,'height':640}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='ko-KR')
        p = await ctx.new_page()
        await p.goto('http://localhost:4173/?mock&file=sample.json&p1=지호&p2=수아', wait_until='networkidle')
        await p.wait_for_selector('[data-sec="ledger"]'); await p.wait_for_timeout(800)
        async def shot(name):
            await p.wait_for_timeout(400); await p.screenshot(path=f'{OUT}/{name}.png'); print('shot', name)
        async def go(sec, dy=0):
            await p.evaluate("""([id,dy])=>{const el=document.querySelector(`[data-sec="${id}"]`);window.scrollTo(0, el.getBoundingClientRect().top+window.scrollY-46+dy)}""", [sec, dy]); await p.wait_for_timeout(500)
        await p.evaluate('()=>window.scrollTo(0,0)'); await shot('01-ledger')
        await p.evaluate("()=>{const el=document.querySelector('[data-sec=\"ledger\"] table')||document.querySelector('[data-sec=\"ledger\"]'); window.scrollTo(0, el.getBoundingClientRect().top+window.scrollY-46)}"); await shot('02-ledger-table')
        await go('insights'); await shot('03-insights')
        await go('goals'); await shot('04-goals')
        await go('flow'); await shot('05-flow')
        await go('loans'); await shot('06-loans')
        await p.evaluate("()=>{const el=document.querySelector('table.stocks'); window.scrollTo(0, el.getBoundingClientRect().top+window.scrollY-46-60)}"); await shot('07-stocks')
        await p.click('text=여러 달 나란히'); await p.wait_for_timeout(600); await go('ledger'); await shot('08-multi')
        btns = await p.evaluate("()=>Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(Boolean).slice(0,40)")
        print(btns)
        await b.close()
asyncio.run(main())
