"""App Store 截圖：無頭 Chrome 以 iPhone 6.9 吋（440×956、3 倍）拍 App 畫面，再合成標語。
用法：python store/make_shots.py [語言 ...]   → store/screenshots/raw/<lang>/*.png 與 store/screenshots/iphone-6.9/<lang>/*.png
拍攝時用 localStorage 假的完整版序號解鎖全部場景（只在本機），跟練習紀錄的示範資料。
"""
import json, os, pathlib, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'store' / 'screenshots' / 'raw'
OUT = ROOT / 'store' / 'screenshots' / 'iphone-6.9'
W, H = 1320, 2868

# (file, scene, time, season, action, headline per language)
SHOTS = [
    ('1-breathe', 'tree', 'day', 0, 'session', {
        'zh': ('跟著畫面，慢慢呼吸', '樹會隨著你的吸氣與吐氣輕輕起伏'),
        'en': ('Breathe with the scene', 'The tree rises and settles with every breath'),
        'ja': ('画面に合わせて、ゆっくり呼吸', '木があなたの呼吸に合わせて揺れる'),
        'ko': ('화면을 따라 천천히 호흡', '나무가 숨결에 맞춰 부드럽게 움직여요')}),
    ('2-aurora', 'aurora', 'night', 0, 'session', {
        'zh': ('13 個會呼吸的場景', '極光、海、雨窗、雪夜、營火…'),
        'en': ('13 scenes that breathe', 'Aurora, sea, rainy window, campfire…'),
        'ja': ('呼吸する 13 のシーン', 'オーロラ、海、雨の窓、たき火…'),
        'ko': ('숨 쉬는 13가지 장면', '오로라, 바다, 비 오는 창가, 모닥불…')}),
    ('3-sounds', 'sea', 'day', 0, 'sound', {
        'zh': ('18 種環境音，自由混音', '全部在手機上即時合成，不用網路'),
        'en': ('Mix 18 ambient sounds', 'Synthesised live on your phone, no internet needed'),
        'ja': ('18 の環境音を自由にミックス', 'すべて端末でリアルタイム合成、通信不要'),
        'ko': ('18가지 환경음을 자유롭게', '모두 휴대폰에서 실시간 합성, 인터넷 불필요')}),
    ('4-sleep', 'rain', 'night', 0, 'sleep', {
        'zh': ('關掉螢幕，聽著入睡', '設定時間，聲音會慢慢淡出'),
        'en': ('Fall asleep, screen off', 'Set a timer and the sound fades away'),
        'ja': ('画面を消して、おやすみ', 'タイマーで音がゆっくり消えていく'),
        'ko': ('화면을 끄고 잠들기', '타이머를 맞추면 소리가 천천히 사라져요')}),
    ('5-deer', 'deer', 'night', 0, 'home', {
        'zh': ('森林裡的銀色靈鹿', '每個場景都有專屬的聲音與呼吸方式'),
        'en': ('A silver spirit deer', 'Every scene has its own sounds and breath'),
        'ja': ('森にたたずむ銀色の鹿', 'シーンごとに音と呼吸のかたちがある'),
        'ko': ('숲속의 은빛 사슴', '장면마다 고유한 소리와 호흡이 있어요')}),
    ('6-stats', 'lighthouse', 'night', 0, 'stats', {
        'zh': ('每天幾分鐘，留下紀錄', '連續天數、總時數與每日提醒'),
        'en': ('A few minutes a day', 'Streaks, total time and a daily reminder'),
        'ja': ('毎日数分、記録に残す', '連続日数、合計時間、毎日のリマインダー'),
        'ko': ('하루 몇 분, 기록으로', '연속 일수, 총 시간, 매일 알림')}),
]
FONTS = {'zh': 'msjhbd.ttc', 'ja': 'YuGothB.ttc', 'ko': 'malgunbd.ttf', 'en': 'segoeuib.ttf'}
FONTS_SUB = {'zh': 'msjh.ttc', 'ja': 'YuGothM.ttc', 'ko': 'malgun.ttf', 'en': 'segoeui.ttf'}


def demo_stats():
    """two weeks of practice ending today, for the stats screenshot"""
    import datetime
    today = datetime.date.today()
    days = {}
    for i, m in enumerate([5, 10, 5, 8, 12, 5, 10, 15, 5, 10, 8, 5]):
        days[(today - datetime.timedelta(days=i)).isoformat()] = m * 60
    return {'days': days, 'sessions': 14}


def steps_for(lang, shot):
    name, scene, time, season, action, _ = shot
    settings = {'lang': lang, 'scene': scene, 'time': time, 'season': season, 'minutes': 5, 'sleepMinutes': 30}
    seed = (f"localStorage.clear();"
            f"localStorage.setItem('seasontree.settings', JSON.stringify({json.dumps(settings)}));"
            f"localStorage.setItem('seasontree.stats', JSON.stringify({json.dumps(demo_stats())}));"
            "localStorage.setItem('seasontree.pass', JSON.stringify({ok:true,key:'SHOT',instance:'x',since:'2026-10-27',checked:Date.now()})); 1")
    act = {'session': "__app.startSession(); 1", 'sound': "__app.openSheet('sound'); 1", 'sleep': "__app.openSheet('sleep'); 1",
           'stats': "__app.openSheet('stats'); 1", 'home': "1"}[action]
    return [
        {'emulate': [440, 956, 3]}, {'wait': 1}, {'eval': seed}, {'goto': '?shot'},
        {'eval': "new Promise(r => { const t0 = Date.now(); (function poll() { if (window.__app && document.getElementById('introStart')) r(1); else if (Date.now() - t0 > 30000) r('timeout'); else setTimeout(poll, 200); })(); })"},
        {'wait': 2}, {'eval': "document.getElementById('introStart').click(); 1"}, {'wait': 4},
        {'eval': act}, {'wait': 9 if action == 'session' else 3},
    ] + ([x for i in range(8) for x in ({'shot': f'{name}_b{i}.png'}, {'wait': 1.3})] if scene == 'deer' else [{'shot': f'{name}.png'}])


def pick_deer(out, name):
    """the deer runs a loop and is only on a phone-width screen part of the time: keep the burst frame
    with the most bright (glowing) pixels in the middle of the picture"""
    best, best_n = None, -1
    for f in sorted(out.glob(f'{name}_b*.png')):
        im = Image.open(f).convert('L')
        w, h = im.size
        n = sum(1 for v in im.crop((int(w * .12), int(h * .3), int(w * .88), int(h * .62))).resize((200, 200)).getdata() if v > 150)
        if n > best_n:
            best, best_n = f, n
    best.replace(out / f'{name}.png')
    for f in out.glob(f'{name}_b*.png'):
        f.unlink()


def shoot(lang):
    out = RAW / lang
    out.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / 'store' / 'screenshots' / '_steps.json'
    for shot in SHOTS:
        tmp.write_text(json.dumps(steps_for(lang, shot)), encoding='utf-8')
        r = subprocess.run([sys.executable, str(ROOT / 'tools' / 'cdp_shot.py'), str(tmp), str(out)],
                           env={**os.environ, 'ROOT': str(ROOT), 'SIZE': '440,956'}, capture_output=True, text=True, encoding='utf-8')
        if shot[1] == 'deer':
            pick_deer(out, shot[0])
        bad = [l for l in r.stdout.splitlines() if 'EXCEPTION' in l or 'timeout' in l]
        print(lang, shot[0], 'ok' if (out / f'{shot[0]}.png').exists() and not bad else f'PROBLEM {bad} {r.stderr[-300:]}')
    tmp.unlink(missing_ok=True)


def fit_font(path, text, size, max_w):
    while True:
        f = ImageFont.truetype(path, size)
        if f.getlength(text) <= max_w or size < 40:
            return f
        size -= 4


def compose(lang):
    out = OUT / lang
    out.mkdir(parents=True, exist_ok=True)
    fdir = 'C:/Windows/Fonts/'
    for name, *_, heads in SHOTS:
        raw = Image.open(RAW / lang / f'{name}.png').convert('RGB')
        img = Image.new('RGB', (W, H))
        d = ImageDraw.Draw(img)
        top, bot = (255, 238, 244), (228, 236, 252)
        for y in range(H):
            k = y / (H - 1)
            d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * k) for i in range(3)))
        head, sub = heads[lang]
        f1 = fit_font(fdir + FONTS[lang], head, 112, W - 160)
        f2 = fit_font(fdir + FONTS_SUB[lang], sub, 56, W - 160)
        ink = (62, 52, 78)
        d.text((W / 2, 250), head, font=f1, fill=ink, anchor='mm')
        d.text((W / 2, 390), sub, font=f2, fill=(118, 106, 130), anchor='mm')
        # the phone screen, scaled down with rounded corners and a soft shadow
        sw = int(W * 0.78)
        sh = int(raw.height * sw / raw.width)
        scr = raw.resize((sw, sh), Image.LANCZOS)
        r = 72
        mask = Image.new('L', (sw, sh), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), r, fill=255)
        x, y = (W - sw) // 2, 500
        shadow = Image.new('L', (W, H), 0)
        ImageDraw.Draw(shadow).rounded_rectangle((x, y + 24, x + sw, y + sh + 24), r, fill=90)
        shadow = shadow.filter(ImageFilter.GaussianBlur(40))
        img.paste((120, 100, 150), (0, 0), shadow)  # the blurred mask blends a soft shadow over the gradient
        img.paste(scr, (x, y), mask)
        img.save(out / f'{name}.png', optimize=True)
    print('composed', lang)


if __name__ == '__main__':
    langs = sys.argv[1:] or ['zh', 'en', 'ja', 'ko']
    for lang in langs:
        if os.environ.get('SKIP_SHOOT') != '1':
            shoot(lang)
        compose(lang)
