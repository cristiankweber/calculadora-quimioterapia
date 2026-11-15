import json
from pathlib import Path
from urllib.parse import urlparse,unquote
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
project=Path(__file__).resolve().parents[2]
out=Path('/home/ubuntu/prophylaxis-fix/evidencias/browser');out.mkdir(parents=True,exist_ok=True)
keys=['specialAlerts','prophylaxis','nursingCare','renalAdjustments','hepaticAdjustments','hematologicAdjustments']
base={'id':'fixture','name':'Protocolo fictício','indication':'Teste','cycles':1,'cycleLength':21,'drugs':[],'emetogenicRisk':'minimal'}
metrics=json.loads(urlopen('http://127.0.0.1:3000/api/trpc/toxicity.metrics').read())['result']['data']['json']
fixtures={'auth.me':{'id':1,'name':'Fixture','openId':'test-only','role':'user'},'settings.get':None,'customProtocols.listActive':[],'toxicity.metrics':metrics}
checks=[];errors=[];writes=[]
def check(label,ok):
 checks.append({'label':label,'passed':bool(ok)});assert ok,label;print('OK:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1280,'height':1000},service_workers='block')
 def api(route):
  req=route.request
  if req.method!='GET':writes.append(req.url);route.abort();return
  names=unquote(urlparse(req.url).path.split('/api/trpc/')[1]).split(',')
  replies=[{'result':{'data':{'json':fixtures.get(n,[])}}} for n in names]
  route.fulfill(status=200,content_type='application/json',body=json.dumps(replies if 'batch=' in req.url else replies[0]))
 context.route('**/api/trpc/**',api)
 page=context.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3000/?from_webdev=1',wait_until='networkidle')
 page.evaluate("async (path)=>{window.__showProphylaxisFixture=(await import(path)).showFixture}",'/@fs'+str(project/'tests/browser/prophylaxis-harness.tsx'))
 cases=[('mínimo',base,{'risk':'low'}),('nulo',{**base,**{k:None for k in keys}},None),('inválido',{**base,**{k:[] for k in keys},'specialAlerts':[None,3,{'unknown':True},'Alerta textual válido'],'prophylaxis':'formato inválido'},{'risk':'low','day1':None,'days2to4':None,'rescue':None,'alerts':None}),('completo',{**base,**{k:[k+' explícito'] for k in keys}},{'risk':'low','day1':['Dia1 explícito'],'days2to4':['Dia2 explícito'],'rescue':['Resgate explícito'],'alerts':['Antiemese explícita']})]
 for label,proto,anti in cases:
  page.evaluate('(args)=>window.__showProphylaxisFixture(...args)',[proto,anti])
  panel=page.locator('#prophylaxis-test-root');panel.wait_for(state='visible');page.wait_for_timeout(150)
  for tab in ['Profilaxias','Antieméticos','Enfermagem']:
   panel.get_by_role('tab',name=tab,exact=True).click()
   check(label+' / '+tab+' sem exceção ou error boundary',not errors and 'An unexpected error' not in page.locator('body').inner_text())
  if label=='mínimo':check('ausência indicada, sem recomendações presumidas','não cadastradas' in panel.inner_text() and 'ausentes' in panel.inner_text())
  if label=='inválido':check('texto válido preservado em lista mista','Alerta textual válido' in panel.inner_text() and '[object Object]' not in panel.inner_text())
  if label=='completo':
   check('enfermagem e ajustes válidos preservados','nursingCare explícito' in panel.inner_text() and 'renalAdjustments explícito' in panel.inner_text())
   panel.get_by_role('tab',name='Antieméticos',exact=True).click()
   check('antiemese completa preservada',all(x in panel.inner_text() for x in ['Dia1 explícito','Dia2 explícito','Resgate explícito','Antiemese explícita']))
 page.screenshot(path=str(out/'complete-desktop.png'))
 page.set_viewport_size({'width':375,'height':900});page.screenshot(path=str(out/'complete-mobile.png'))
 check('sem overflow horizontal externo',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 check('zero gravações externas',not writes)
 browser.close()
(out/'result.json').write_text(json.dumps({'checks':checks,'errors':errors,'externalWrites':len(writes)},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'externalWrites':len(writes)}),flush=True)
