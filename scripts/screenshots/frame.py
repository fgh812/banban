from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
SRC='shots'; OUT='play-screenshots'; os.makedirs(OUT, exist_ok=True)
W,H=1080,1920
BG=(14,79,69); INK=(255,255,255); SUB=(200,225,219)
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; FR='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
if not os.path.exists(FB): FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
fT=ImageFont.truetype(FB,64); fS=ImageFont.truetype(FR,36)
items=[
 ('01-ledger.png','월급부터 남는 돈까지','두 사람 수입·지출을 한눈에'),
 ('02-ledger-table.png','두 사람 열로 나란히','고정 지출·생활비를 항목별로 기록'),
 ('08-multi.png','여러 달을 한 번에','최근 6개월을 나란히 비교'),
 ('03-insights.png','이번 달 분석','규칙 기반 인사이트 + AI 코멘트'),
 ('04-goals.png','목표를 정하면 계산해 줘요','매달 얼마 모아야 하는지, 투자 시뮬레이션까지'),
 ('05-flow.png','월별 흐름 그래프','수입·지출·남는 돈의 추세'),
 ('06-loans.png','대출과 자산 관리','잔액과 이자, 매달 갚는 금액'),
 ('07-stocks.png','주식도 자동 갱신','평일 아침 종가·환율 반영'),
]
def rounded(im, r):
    m=Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0,0,im.width-1,im.height-1], r, fill=255)
    out=im.copy(); out.putalpha(m); return out
for i,(f,t,s) in enumerate(items,1):
    canvas=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(canvas)
    # subtle top glow
    glow=Image.new('RGB',(W,H),BG); gd=ImageDraw.Draw(glow); gd.ellipse([-300,-500,W+300,500],fill=(24,104,92)); glow=glow.filter(ImageFilter.GaussianBlur(120))
    canvas=Image.blend(canvas,glow,0.6); d=ImageDraw.Draw(canvas)
    tw=d.textlength(t,font=fT); d.text(((W-tw)/2,150),t,font=fT,fill=INK)
    sw=d.textlength(s,font=fS); d.text(((W-sw)/2,245),s,font=fS,fill=SUB)
    shot=Image.open(f'{SRC}/{f}').convert('RGB')
    sw_,sh_=880,int(880*1920/1080)  # 1564
    shot=shot.resize((sw_,sh_),Image.LANCZOS)
    # device-ish frame
    fx,fy=(W-sw_)//2, 360
    frame=Image.new('RGBA',(sw_+28,sh_+28),(0,0,0,0)); ImageDraw.Draw(frame).rounded_rectangle([0,0,sw_+27,sh_+27],56,fill=(20,20,22,255))
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([fx-14,fy-14+30,fx+sw_+14,fy+sh_+14+30],60,fill=(0,0,0,110)); sh=sh.filter(ImageFilter.GaussianBlur(30))
    canvas=Image.alpha_composite(canvas.convert('RGBA'),sh)
    canvas.alpha_composite(frame,(fx-14,fy-14))
    canvas.alpha_composite(rounded(shot,44),(fx,fy))
    canvas.convert('RGB').save(f'{OUT}/{i:02d}.png',optimize=True)
    print('ok',i)
