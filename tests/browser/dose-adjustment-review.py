import json, os, re, subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

project=Path(__file__).resolve().parents[2]
out=Path('/home/ubuntu/ajustes-dose/evidencias/browser');out.mkdir(parents=True,exist_ok=True)
data=json.loads(subprocess.run([str(project/'node_modules/.bin/tsx'),str(project/'tests/browser/dose-adjustment-fixtures.ts')],cwd=project,env={**os.environ,'DATABASE_URL':''},check=True,capture_output=True,text=True).stdout)
record=data['record'];prepare=data['prepare'];records=[record]
metrics=json.loads(urlopen('http://127.0.0.1:3000/api/trpc/toxicity.metrics').read())['result']['data']['json']
fixtures={'auth.me':{'id':7,'name':'Usuário fictício','openId':'test-only','role':'user'},'customProtocols.listActive':records,'customProtocols.list':records,'settings.get':None,'patients.list':[],'prescriptions.list':[],'prescriptions.getByPatient':[],'stats.dashboard':{'totalPatients':0,'totalPrescriptions':0,'totalProtocolsUsed':0,'patientsByRenalStatus':[],'topProtocols':[],'prescriptionsByMonth':[]},'toxicity.metrics':metrics}
checks=[];errors=[];mutations=[];external=[]
def check(label,ok):
 checks.append({'check':label,'passed':bool(ok)});assert ok,label;print('OK:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1100},service_workers='block')
 def route_api(route):
  req=route.request;parsed=urlparse(req.url);names=unquote(parsed.path.split('/api/trpc/')[1]).split(',')
  if req.method=='GET':payload=json.loads(parse_qs(parsed.query).get('input',['{}'])[0])
  elif req.method=='POST':payload=json.loads(req.post_data or '{}')
  else:external.append(req.url);route.abort();return
  replies=[]
  for i,name in enumerate(names):
   args=payload.get(str(i),payload).get('json',{})
   if req.method!='GET':
    mutations.append({'name':name,'input':args})
    if name!='templateDoseRevision.update':
     external.append(name);route.abort();return
    # Only a controlled I/O response, never real persistence; service transactions are tested separately.
    value={'id':702,'protocolId':'template-fictitious-new-version','revision':{'parentProtocolId':record['protocolId'],'reason':args.get('reason')}}
   elif name=='templateDoseRevision.prepare':value=prepare
   else:value=fixtures.get(name,[])
   replies.append({'result':{'data':{'json':value}}})
  route.fulfill(status=200,content_type='application/json',body=json.dumps(replies if 'batch=' in req.url else replies[0]))
 context.route('**/api/trpc/**',route_api)
 context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.__copiedPrescription=t},configurable:true});")
 page=context.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3000/?from_webdev=1',wait_until='networkidle')
 for selector,value in {'#name':'PACIENTE FICTÍCIO','#age':'40','#weight':'70','#height':'170','#creatinine':'1'}.items():page.locator(selector).fill(value)
 page.locator('#protocol').click();page.get_by_role('option',name=record['name'],exact=True).click()
 page.get_by_label(re.compile('Dia do ciclo.*opcional')).fill('1');page.wait_for_timeout(400)
 toolbar=page.get_by_role('group',name='Ações da calculadora')
 adjust=page.get_by_role('button',name=re.compile('Ajustar dose')).first
 check('template ativo oferece ajuste individual',adjust.is_enabled())
 adjust.click();editor=page.get_by_role('region',name='Ajuste individual de MEDICAMENTO FICTÍCIO')
 editor.get_by_label('Forma do ajuste',exact=True).select_option('percentage')
 editor.get_by_label('Percentual da dose calculada',exact=True).fill('50')
 check('sem motivo não confirma ajuste',not editor.get_by_role('button',name='Confirmar ajuste',exact=True).is_enabled())
 editor.get_by_label('Motivo do ajuste (obrigatório)',exact=True).fill('MOTIVO FICTÍCIO INDIVIDUAL')
 editor.get_by_role('button',name='Confirmar ajuste',exact=True).click();page.wait_for_timeout(200)
 check('restaurar fica disponível após ajuste',page.get_by_role('button',name=re.compile('Restaurar dose')).first.is_visible())
 toolbar.get_by_role('button',name='Copiar',exact=True).click();copied=page.evaluate('window.__copiedPrescription')
 check('cópia usa 5 mg prescritos e identifica baseline/motivo',copied and 'MOTIVO FICTÍCIO INDIVIDUAL' in copied and re.search(r'5(?:[.,]0)?\s*mg',copied) and re.search(r'10(?:[.,]0)?\s*mg',copied))
 check('cópia preserva total diário prescrito de 10 mg',re.search(r'10(?:[.,]0)?\s*mg/24h',copied) or re.search(r'(?:24h|24 h|24 horas).*10(?:[.,]0)?\s*mg',copied,re.I))
 toolbar.get_by_role('button',name='Prévia / PDF',exact=True).click();dialog=page.get_by_role('dialog');dialog.wait_for(state='visible');page.wait_for_timeout(300)
 check('prévia preserva motivo e dose prescrita', 'MOTIVO FICTÍCIO INDIVIDUAL' in dialog.inner_text() and re.search(r'5(?:[.,]0)?\s*mg',dialog.inner_text()))
 page.screenshot(path=str(out/'individual-preview.png'));page.keyboard.press('Escape')
 page.get_by_role('button',name=re.compile('Restaurar dose')).first.click()
 toolbar.get_by_role('button',name='Copiar',exact=True).click();copied=page.evaluate('window.__copiedPrescription')
 check('restaurar remove motivo/override e mantém baseline', 'MOTIVO FICTÍCIO INDIVIDUAL' not in copied and re.search(r'10(?:[.,]0)?\s*mg',copied))
 adjust.click();editor=page.get_by_role('region',name='Ajuste individual de MEDICAMENTO FICTÍCIO')
 editor.get_by_label('Dose absoluta por aplicação',exact=True).fill('26')
 editor.get_by_label('Motivo do ajuste (obrigatório)',exact=True).fill('Teste do teto')
 check('UI bloqueia dose acima do máximo armazenado de 25',not editor.get_by_role('button',name='Confirmar ajuste',exact=True).is_enabled())
 editor.get_by_label('Dose absoluta por aplicação',exact=True).fill('8');editor.get_by_role('button',name='Confirmar ajuste',exact=True).click()
 page.get_by_label(re.compile('Dia do ciclo.*opcional')).fill('2');page.wait_for_timeout(200)
 check('mudança de dia invalida ajuste da outra etapa',page.get_by_role('button',name=re.compile('Restaurar dose')).count()==0)
 toolbar.get_by_role('button',name='Copiar',exact=True).click();copied=page.evaluate('window.__copiedPrescription')
 check('dia2 usa baseline20 sem override do dia1','Teste do teto' not in copied and re.search(r'20(?:[.,]0)?\s*mg',copied))
 page.set_viewport_size({'width':375,'height':900});page.screenshot(path=str(out/'individual-mobile.png'))
 check('calculadora não transborda em375px',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 page.set_viewport_size({'width':1440,'height':1100});page.goto('http://127.0.0.1:3000/dashboard',wait_until='networkidle')
 page.get_by_role('button',name='Protocolos Personalizados',exact=True).click()
 page.get_by_role('button',name='Editar doses-padrão',exact=True).first.click();dialog=page.get_by_role('dialog');dialog.wait_for(state='visible')
 dialog.locator('#template-dose-1').wait_for(state='visible')
 check('editor expõe principal e duas agendas separadas',dialog.locator('input[id^="template-dose-"]').count()==3)
 dialog.locator('#template-dose-1').fill('12')
 check('sem motivo não cria revisão de dose-padrão',not dialog.get_by_role('button',name='Criar nova versão',exact=True).is_enabled())
 dialog.locator('#template-revision-reason').fill('MOTIVO FICTÍCIO DE REVISÃO')
 page.screenshot(path=str(out/'revision-editor.png'))
 page.set_viewport_size({'width':375,'height':900});page.wait_for_timeout(100)
 check('editor de cadastro cabe em375px',dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1'))
 dialog.get_by_role('button',name='Criar nova versão',exact=True).click();page.wait_for_timeout(400)
 request=next((m['input'] for m in mutations if m['name']=='templateDoseRevision.update'),None)
 check('revisão envia hash, path da agenda e motivo, não uma projeção parcial do protocolo',request and request.get('id')==701 and request.get('expectedHash')==prepare['expectedHash'] and request.get('changes')==[{'path':['drugs','0','schedule','0','dose'],'dose':12}] and request.get('reason')=='MOTIVO FICTÍCIO DE REVISÃO')
 check('confirmação do cadastro fecha o editor',page.get_by_role('dialog').count()==0)
 check('zero exceções JavaScript',not errors);check('zero gravações externas',not external)
 browser.close()
(out/'result.json').write_text(json.dumps({'checks':checks,'errors':errors,'interceptedMutations':mutations,'externalWrites':len(external)},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'allPassed':all(c['passed'] for c in checks),'externalWrites':len(external)},ensure_ascii=False),flush=True)
