import json
import os,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote,parse_qs
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

out=Path('/home/ubuntu/p1-correcoes/evidencias/browser');out.mkdir(parents=True,exist_ok=True)
project=Path(__file__).resolve().parents[2]
raw=subprocess.run([str(project/'node_modules/.bin/tsx'),str(project/'tests/browser/p1-fixtures.ts')],cwd=project,env={**os.environ,'DATABASE_URL':''},check=True,capture_output=True,text=True)
records=json.loads(raw.stdout)

def custom(identifier,name,drugs):
 return {'id':100+len(records),'protocolId':identifier,'name':name,'indication':'Fixture — sem validade clínica','cycles':6,'cycleLength':21,'isActive':1,'isSystem':0,'userId':7,'drugs':drugs,'renalAdjustments':[],'hepaticAdjustments':[],'hematologicAdjustments':[],'prophylaxis':[],'nursingCare':[],'specialAlerts':[],'emetogenicRisk':'minimal'}
regular=custom('p1-simple','Fixture simples',[{'name':'Fixture mg','dose':10,'doseUnit':'mg/m²','route':'IV','days':'D1'}])
auc=custom('p1-auc','Fixture AUC',[{'name':'Fixture AUC','dose':5,'doseUnit':'AUC','route':'IV','days':'D1'}])
records += [regular,auc]
patient_a={'id':701,'userId':7,'name':'FICTÍCIO A','age':50,'sex':'M','weight':70,'height':170,'creatinine':1,'bilirubin':1,'ecog':0,'comorbidities':''}
patient_b={**patient_a,'id':702,'name':'FICTÍCIO B','weight':90}
historical={
 'patient':{key:value for key,value in patient_b.items() if key not in ('id','userId')},
 'protocol':{'id':'p1-simple','name':'Fixture simples','cycle':2,'totalCycles':6,'templateContext':{'cycle':2,'phaseId':'FASE-SNAPSHOT','day':0,'gfrForCalvert':82}},
 'calculatedValues':{'bsa':2.1,'egfr':90,'renalStatus':'green'},
 'drugs':[{'name':'Fixture mg','baseDose':10,'doseUnit':'mg/m²','calculatedDose':7,'finalDose':7,'resultUnit':'mg','route':'IV','days':[0,1],'frequency':1,'dailyDose':7}],
}
metrics=json.loads(urlopen('http://127.0.0.1:3000/api/trpc/toxicity.metrics').read())['result']['data']['json']
fixtures={'auth.me':{'id':7,'name':'Fictício','openId':'p1-browser-ficticio','role':'user'},'settings.get':None,'customProtocols.listActive':records,'customProtocols.list':records,'patients.list':[patient_a,patient_b],'prescriptions.list':[],'toxicity.metrics':metrics}
fixtures['toxicity.predict']={'neutropenia':{'probability':0,'risk':'low','grade':'G3-4'},'mucositis':{'probability':0,'risk':'low','grade':'G3-4'},'overallRisk':'low','recommendations':[],'featureImportance':[]}
checks=[];errors=[];writes=[]
def check(label,passed):
 checks.append({'check':label,'passed':bool(passed)})
 assert passed,label
 print('OK:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1100},service_workers='block')
 def route_api(route):
  req=route.request
  if req.method!='GET':
   writes.append(req.url);route.abort();raise RuntimeError('Gravação externa bloqueada')
  parsed=urlparse(req.url);names=unquote(parsed.path.split('/api/trpc/')[1]).split(',')
  query=parse_qs(parsed.query)
  payload=json.loads(query.get('input',['{}'])[0])
  replies=[]
  for i,name in enumerate(names):
   value=fixtures.get(name,[])
   if name=='prescriptions.getByPatient':
    args=payload.get(str(i),payload).get('json',{})
    value=[{'id':71,'prescriptionId':'RX-FICTÍCIO','patientId':702,'userId':7,'protocolName':'Fixture simples','cycle':5,'createdAt':'2026-11-14T00:00:00Z','prescriptionData':historical}] if args.get('patientId')==702 else []
   replies.append({'result':{'data':{'json':value}}})
  route.fulfill(status=200,content_type='application/json',body=json.dumps(replies if 'batch=' in req.url else replies[0]))
 context.route('**/api/trpc/**',route_api)
 context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async(t)=>{window.__copiedPrescription=t}},configurable:true});")
 page=context.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
 page.screenshot(path=str(out/'initial.png'))
 check('biblioteca de templates permanece disponível', 'Templates ativos' in page.locator('#protocol-library').inner_text())
 toolbar=page.get_by_role('group',name='Ações da calculadora')
 def library(name):
  page.locator('#protocol-library').click();page.get_by_role('option',name=name,exact=False).click()
 def protocol(name):
  page.locator('#protocol').click();page.get_by_role('option',name=name,exact=True).click();page.wait_for_timeout(350)
 def patient(name):
  toolbar.get_by_role('button',name='Histórico de Pacientes',exact=True).click()
  page.get_by_text(name,exact=True).wait_for(state='visible')
  button=page.get_by_text(name,exact=True).locator('xpath=../..').get_by_role('button',name='Carregar',exact=True)
  button.click();page.wait_for_timeout(500)
 library('Personalizados');protocol('Fixture simples')
 patient('FICTÍCIO A')
 (out/'patient-a-dom.txt').write_text(page.locator('body').inner_text())
 page.screenshot(path=str(out/'patient-a.png'))
 print('Erros até paciente A:',errors,flush=True)
 dose_button=page.get_by_title('Clique para ajustar manualmente').first
 dose_button.click();editor=page.locator('input:focus');editor.fill('7');editor.press('Enter')
 check('override manual de A aparece como 7 mg', '7.0 mg' in dose_button.inner_text())
 page.get_by_role('tab',name='Eletrólitos',exact=False).click();page.locator('#support-potassium').fill('2.0')
 patient('FICTÍCIO B')
 check('troca A→B usa identidade B',page.locator('#name').input_value()=='FICTÍCIO B')
 page.get_by_text('Snapshot histórico — consulta, sem recálculo',exact=True).click()
 check('histórico v2 preserva snapshot e contexto de ciclo', 'Ciclo 2' in page.locator('body').inner_text() or 'Ciclo: 2' in page.locator('body').inner_text())
 check('nova execução não reaproveita override histórico de 7 mg','7.0 mg' not in page.get_by_title('Clique para ajustar manualmente').first.inner_text())
 page.get_by_role('tab',name='Eletrólitos',exact=False).click()
 check('potássio do paciente anterior foi limpo',page.locator('#support-potassium').input_value()=='')
 protocol('Fixture AUC')
 page.evaluate('window.__copiedPrescription=null');toolbar.get_by_role('button',name='Copiar',exact=True).click()
 check('sem GFR absoluto não é emitida cópia AUC',page.evaluate('window.__copiedPrescription') is None)
 check('AUC ausente não aparece como referência AUC em mg','Não calculada' in page.get_by_title('Clique para ajustar manualmente').inner_text())
 page.locator('#calvert-gfr-absolute').fill('113.6');page.wait_for_timeout(400)
 check('GFR absoluto explícito gera 693 mg, sem aplicar SC novamente','693.0 mg' in page.get_by_title('Clique para ajustar manualmente').inner_text())
 toolbar.get_by_role('button',name='Copiar',exact=True).click()
 check('cópia contém GFR absoluto e dose precisos','113.6 mL/min' in page.evaluate('window.__copiedPrescription') and '693.0 mg' in page.evaluate('window.__copiedPrescription'))
 toolbar.get_by_role('button',name='Prévia / PDF',exact=True).click();dialog=page.get_by_role('dialog');dialog.wait_for(state='visible');page.wait_for_timeout(250)
 check('prévia inclui grandeza renal absoluta usada em Calvert','113.6 mL/min' in dialog.inner_text())
 page.screenshot(path=str(out/'legacy-calvert-preview.png'));page.keyboard.press('Escape')
 toolbar.get_by_role('button',name='Novo paciente / limpar sessão',exact=True).click();page.wait_for_timeout(400)
 check('nova sessão limpa identidade e GFR absoluto',page.locator('#name').input_value()=='' and page.locator('#calvert-gfr-absolute').input_value()=='')
 page.set_viewport_size({'width':375,'height':900});page.screenshot(path=str(out/'new-session-mobile.png'))
 check('sem overflow horizontal externo',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 check('navegação sem exceções JavaScript',not errors)
 check('zero gravações externas',not writes)
 browser.close()
(out/'result.json').write_text(json.dumps({'checks':checks,'errors':errors,'externalWrites':len(writes)},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'allPassed':all(x['passed'] for x in checks),'externalWrites':len(writes)},ensure_ascii=False),flush=True)
