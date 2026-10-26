"""無頭 Chrome 測試：臨時起一個 http 伺服器 → 開頁面 → 依序執行 steps → 截圖 / 印出 console。
用法：python tools/cdp_shot.py steps.json out_dir（從 Sprout 專案沿用，加上 emulate／goto）
環境變數：ROOT=要服務的資料夾、PAGE=要開的頁面（預設 index.html）
steps: [{"wait": 秒}, {"eval": "js 運算式"}, {"shot": "a.png"}, {"emulate": [寬, 高, 倍率]}, {"goto": "?查詢字串"}]
只用標準函式庫（本機沒有 websocket 套件）。
"""
import base64, functools, http.server, json, os, pathlib, socket, struct, subprocess, sys, tempfile, threading, time, urllib.request

# 伺服器根目錄：環境變數 ROOT（預設 = 本工具上一層，也就是專案資料夾）
ROOT = pathlib.Path(os.environ.get('ROOT') or pathlib.Path(__file__).resolve().parent.parent)
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
steps = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{srv.server_address[1]}/' + os.environ.get('PAGE', 'index.html')

prof = tempfile.mkdtemp(prefix='cdp_')
# a free port each run: a fixed one (9344) collided with other sessions' headless Chrome
with socket.socket() as _s:
    _s.bind(('127.0.0.1', 0))
    port = _s.getsockname()[1]
chrome = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={port}', f'--user-data-dir={prof}',
                           '--window-size=' + os.environ.get('SIZE', '1720,1080'), '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu',
                           '--no-first-run', '--mute-audio', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try:
        tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json')); break
    except Exception:
        time.sleep(0.2)
ws_url = next(t for t in tabs if t['type'] == 'page')['webSocketDebuggerUrl']


class WS:
    def __init__(self, u):
        host, rest = u[5:].split('/', 1)
        h, p = host.split(':')
        self.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{rest} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf: buf += self.s.recv(1)
        self.n = 0; self.events = []

    def send(self, method, params=None):
        self.n += 1
        data = json.dumps({'id': self.n, 'method': method, 'params': params or {}}).encode()
        mask = os.urandom(4)
        hdr = bytes([0x81])
        L = len(data)
        hdr += bytes([0x80 | L]) if L < 126 else (bytes([0x80 | 126]) + struct.pack('>H', L) if L < 65536 else bytes([0x80 | 127]) + struct.pack('>Q', L))
        self.s.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
        while True:
            msg = self.recv()
            if msg.get('id') == self.n: return msg
            self.events.append(msg)

    def _read(self, n):
        b = b''
        while len(b) < n: b += self.s.recv(n - len(b))
        return b

    def recv(self):
        payload = b''
        while True:
            b0, b1 = self._read(2)
            L = b1 & 0x7f
            if L == 126: L = struct.unpack('>H', self._read(2))[0]
            elif L == 127: L = struct.unpack('>Q', self._read(8))[0]
            payload += self._read(L)
            if b0 & 0x80: return json.loads(payload)


ws = WS(ws_url)
ws.send('Runtime.enable'); ws.send('Log.enable'); ws.send('Page.enable')
ws.send('Page.navigate', {'url': url})
try:
    for st in steps:
        if 'wait' in st: time.sleep(st['wait'])
        if 'emulate' in st:  # [width, height, deviceScaleFactor] — phone screen for store screenshots
            w, h, dpr = st['emulate']
            ws.send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': dpr, 'mobile': True})
            ws.send('Emulation.setTouchEmulationEnabled', {'enabled': True, 'maxTouchPoints': 5})
        if 'goto' in st:  # reload the page (e.g. after seeding localStorage)
            ws.send('Page.navigate', {'url': url + st['goto']})
        if 'eval' in st:
            r = ws.send('Runtime.evaluate', {'expression': st['eval'], 'returnByValue': True, 'awaitPromise': True})
            res = r.get('result', {})
            print('EVAL', st['eval'][:60].replace('\n', ' '), '=>', json.dumps(res.get('result', {}).get('value', res.get('exceptionDetails')), ensure_ascii=False)[:1500])
        if 'shot' in st:
            r = ws.send('Page.captureScreenshot', {'format': 'png'})
            (out / st['shot']).write_bytes(base64.b64decode(r['result']['data']))
            print('SHOT', out / st['shot'])
    for e in ws.events:
        m = e.get('method')
        if m == 'Runtime.consoleAPICalled':
            print('CONSOLE', e['params']['type'], ' '.join(str(a.get('value', a.get('description', ''))) for a in e['params']['args'])[:400])
        elif m == 'Runtime.exceptionThrown':
            d = e['params']['exceptionDetails']; print('EXCEPTION', d.get('text'), d.get('exception', {}).get('description', '')[:600])
        elif m == 'Log.entryAdded':
            print('LOG', e['params']['entry']['level'], e['params']['entry']['text'][:300])
finally:
    chrome.kill(); srv.shutdown()
