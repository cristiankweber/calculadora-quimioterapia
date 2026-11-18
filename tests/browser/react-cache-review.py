import json, os, subprocess, threading, urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

project = Path(__file__).resolve().parents[2]
out = Path('/home/ubuntu/react-hook-fix/evidencias/browser')
out.mkdir(parents=True, exist_ok=True)
# A real prior worker, not a mocked serviceWorker API. Only installed in this ephemeral test origin.
legacy = (project / 'tests/fixtures/legacy-service-worker-v1.js').read_bytes()
legacy_html = b'<!doctype html><html><body>Seed do cache legado (somente teste)</body></html>'
class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/seed-cache':
            content, mime = legacy_html, 'text/html'
        elif parsed.path == '/sw.js' and parsed.query == 'legacy-test':
            content, mime = legacy, 'application/javascript'
        else:
            try:
                response = urllib.request.urlopen('http://127.0.0.1:3000' + self.path, timeout=20)
                content, mime = response.read(), response.headers.get('Content-Type', 'text/plain')
            except Exception as error:
                self.send_error(502, str(error)); return
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Service-Worker-Allowed', '/')
        self.end_headers(); self.wfile.write(content)
server = ThreadingHTTPServer(('127.0.0.1', 0), Proxy)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
metrics = json.loads(urllib.request.urlopen('http://127.0.0.1:3000/api/trpc/toxicity.metrics').read())['result']['data']['json']
checks, errors, writes, requests = [], [], [], []
def check(label, value):
    checks.append({'check': label, 'passed': bool(value)})
    assert value, label
    print('OK:', label, flush=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(service_workers='allow')
    def api(route):
        req = route.request
        if req.method != 'GET': writes.append(req.url); route.abort(); return
        names = unquote(urlparse(req.url).path.split('/api/trpc/')[1]).split(',')
        data = {'auth.me': None, 'settings.get': None, 'customProtocols.listActive': [], 'patients.list': [], 'toxicity.metrics': metrics}
        replies = [{'result': {'data': {'json': data.get(name, [])}}} for name in names]
        route.fulfill(status=200, content_type='application/json', body=json.dumps(replies if 'batch=' in req.url else replies[0]))
    context.route('**/api/trpc/**', api)
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda req: requests.append(req.url))
    try:
        page.goto(origin + '/seed-cache', wait_until='networkidle')
        seeded = page.evaluate('''async () => {
          await navigator.serviceWorker.register('/sw.js?legacy-test', {scope:'/'});
          await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
          const stale = await caches.open('calculadora-quimio-v1');
          const response = new Response('throw new Error("STALE_REACT_CACHE_SHOULD_NOT_EXECUTE")', {headers:{'Content-Type':'application/javascript'}});
          await stale.put('/src/main.tsx', response.clone());
          await stale.put('/node_modules/.vite/deps/react.js?v=obsolete', response.clone());
          const untouched = await caches.open('unrelated-test-cache'); await untouched.put('/other-static', new Response('keep'));
          localStorage.setItem('clinical-test-preserve', 'keep'); document.cookie = 'test-preserve=yes; path=/';
          return {worker:!!navigator.serviceWorker.controller, caches:await caches.keys()};
        }''')
        check('controlador legado real instalado e cache contaminado', seeded['worker'] and 'calculadora-quimio-v1' in seeded['caches'])
        requests.clear()
        page.goto(origin + '/?from_webdev=1', wait_until='networkidle')
        page.locator('#name').wait_for(state='visible')
        page.wait_for_timeout(500)
        status = page.evaluate('''async () => ({controller:!!navigator.serviceWorker.controller, registrations:(await navigator.serviceWorker.getRegistrations()).length,caches:await caches.keys(),cookie:document.cookie,storage:localStorage.getItem('clinical-test-preserve'),error:document.body.innerText.includes('An unexpected error occurred.')})''')
        check('cache antigo removido automaticamente antes da aplicação', not any(name.startswith('calculadora-quimio-') for name in status['caches']))
        check('SW não controla nem se registra novamente na prévia', not status['controller'] and status['registrations'] == 0)
        check('cache de terceiro preservado', 'unrelated-test-cache' in status['caches'])
        check('cookie e localStorage preservados', 'test-preserve=yes' in status['cookie'] and status['storage'] == 'keep')
        check('aplicação anônima abre sem erro de hooks', not status['error'] and not errors)
        bootstrap_requests = [url for url in requests if '/src/bootstrap.ts' in url]
        main_requests = [url for url in requests if '/src/main.tsx' in url]
        check('migração recarrega antes de importar o grafo React', len(bootstrap_requests) >= 2 and len(main_requests) == 1)
        page.get_by_role('button', name='EMERGÊNCIA', exact=True).click()
        dialog = page.get_by_role('dialog'); dialog.wait_for(state='visible')
        check('Dialog de emergência abre sem invalid hook call', dialog.is_visible() and not errors)
        page.keyboard.press('Escape'); dialog.wait_for(state='hidden')
        page.get_by_role('button', name='Histórico de Pacientes', exact=True).click()
        dialog = page.get_by_role('dialog'); dialog.wait_for(state='visible')
        check('Dialog de histórico anônimo abre sem useRef null', dialog.is_visible() and not errors)
        page.screenshot(path=str(out/'dialogs-after-migration.png'))
        page.keyboard.press('Escape')
        page.reload(wait_until='networkidle')
        page.locator('#name').wait_for(state='visible')
        page.wait_for_timeout(400)
        check('segundo carregamento permanece estável e sem SW novo', page.evaluate('navigator.serviceWorker.controller === null') and not errors)
        check('nenhuma escrita externa de dados clínicos', len(writes) == 0)
    except Exception:
        (out/'failure-dom.txt').write_text(page.locator('body').inner_text())
        page.screenshot(path=str(out/'failure.png')); raise
    finally:
        (out/'result.json').write_text(json.dumps({'checks':checks,'errors':errors,'externalWrites':len(writes),'requests':requests},ensure_ascii=False,indent=2)+'\n')
        browser.close(); server.shutdown()
print(json.dumps({'checks':len(checks),'allPassed':all(c['passed'] for c in checks),'externalWrites':len(writes)}),flush=True)
