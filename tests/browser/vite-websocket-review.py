import json,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
from urllib.request import urlopen
from playwright.sync_api import sync_playwright,TimeoutError
project=Path(__file__).resolve().parents[2]
out=Path('/home/ubuntu/vite-websocket-fix/evidencias');out.mkdir(parents=True,exist_ok=True)
urls=sys.argv[1:] or ['http://127.0.0.1:3000/','https://3000-igkzfy3kovuijttff7ur8-cd817394.us5.manus.computer/']
metrics=json.loads(urlopen('http://127.0.0.1:3000/api/trpc/toxicity.metrics').read())['result']['data']['json']
fixtures={'auth.me':None,'settings.get':None,'customProtocols.listActive':[],'patients.list':[],'toxicity.metrics':metrics}
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for url in urls:
  context=browser.new_context(service_workers='block',viewport={'width':1280,'height':960});writes=[];errors=[];messages=[];sockets=[];frames=[]
  def api(route):
   req=route.request
   if req.method!='GET':writes.append(req.url);route.abort();return
   names=unquote(urlparse(req.url).path.split('/api/trpc/')[1]).split(',')
   replies=[{'result':{'data':{'json':fixtures.get(n,[])}}} for n in names]
   route.fulfill(status=200,content_type='application/json',body=json.dumps(replies if 'batch=' in req.url else replies[0]))
  context.route('**/api/trpc/**',api)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:messages.append(m.text))
  def websocket(ws):
   parsed=urlparse(ws.url);sockets.append({'scheme':parsed.scheme,'hostname':parsed.hostname,'port':parsed.port,'path':parsed.path})
   ws.on('framereceived',lambda frame:frames.append(frame))
  page.on('websocket',websocket)
  connected=False
  try:
   with page.expect_event('console',predicate=lambda m:m.text=='[vite] connected.',timeout=9000):
    page.goto(url+'?from_webdev=1&ws-review=1',wait_until='networkidle',timeout=20000)
   connected=True
  except TimeoutError:pass
  body=page.locator('body').inner_text()
  failures=[m for m in messages if '[vite] failed to connect to websocket' in m]
  endpoint=urlparse(url)
  same_origin=bool(sockets) and all(s['hostname']==endpoint.hostname and (s['port'] or (443 if s['scheme']=='wss' else 80))==(endpoint.port or (443 if endpoint.scheme=='https' else 80)) for s in sockets)
  has_frame=any(isinstance(f,str) and '"type":"connected"' in f for f in frames)
  result={'origin':url,'connectedLog':connected,'connectedFrame':has_frame,'sameOrigin':same_origin,'sockets':sockets,'webSocketFailures':len(failures),'pageErrors':len(errors),'externalWrites':len(writes),'appRendered':'Calculadora de Prescrição Quimioterápica' in body and 'An unexpected error occurred' not in body}
  result['passed']=connected and has_frame and same_origin and not failures and not errors and not writes and result['appRendered']
  results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
  page.screenshot(path=str(out/('https.png' if endpoint.scheme=='https' else 'local.png')));context.close()
 browser.close()
(out/'browser-result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
sys.exit(0 if all(r['passed'] for r in results) else 1)
