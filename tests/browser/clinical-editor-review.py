import json, os, re, subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

project = Path(__file__).resolve().parents[2]
out = Path('/home/ubuntu/editor-clinico/evidencias/browser')
out.mkdir(parents=True, exist_ok=True)
fixture_script = project / 'tests/browser/clinical-editor-fixtures.ts'
env = {**os.environ, 'DATABASE_URL': ''}
data = json.loads(subprocess.run([str(project / 'node_modules/.bin/tsx'), str(fixture_script)], cwd=project, env=env, check=True, capture_output=True, text=True).stdout)
record, prepare = data['record'], data['prepare']
records = [record]
metrics = json.loads(urlopen('http://127.0.0.1:3000/api/trpc/toxicity.metrics').read())['result']['data']['json']
fixtures = {'auth.me': {'id': 7, 'name': 'Usuário fictício', 'openId': 'software-test', 'role': 'user'}, 'settings.get': None, 'patients.list': [], 'prescriptions.list': [], 'prescriptions.getByPatient': [], 'stats.dashboard': {'totalPatients': 0, 'totalPrescriptions': 0, 'totalProtocolsUsed': 0, 'patientsByRenalStatus': [], 'topProtocols': [], 'prescriptionsByMonth': []}, 'toxicity.metrics': metrics}
checks, errors, mutations, external = [], [], [], []
def check(label, result):
    checks.append({'check': label, 'passed': bool(result)})
    assert result, label
    print('OK:', label, flush=True)
def field_index(path=None, section=None, tail=None):
    candidates = [(i, f) for i, f in enumerate(prepare['fields']) if (path is None or f['path'] == path) and (section is None or f['section'] == section) and (tail is None or f['path'][-1] == tail)]
    assert candidates, f'Campo editável não fornecido: {path or (section, tail)}'
    return candidates[0]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, service_workers='block')
    def route_api(route):
        global records
        req = route.request
        parsed = urlparse(req.url)
        names = unquote(parsed.path.split('/api/trpc/')[1]).split(',')
        payload = json.loads(parse_qs(parsed.query).get('input', ['{}'])[0]) if req.method == 'GET' else json.loads(req.post_data or '{}')
        replies = []
        for i, name in enumerate(names):
            args = payload.get(str(i), payload).get('json', {})
            if req.method != 'GET':
                mutations.append({'name': name, 'input': args})
                if name != 'templateClinicalRevision.update':
                    external.append(name)
                    route.abort()
                    return
                # Apply the REAL pure whitelist/normalizer. All database writes remain intercepted.
                revised = json.loads(subprocess.run([str(project / 'node_modules/.bin/tsx'), str(fixture_script), '--apply'], input=json.dumps(args), cwd=project, env=env, check=True, capture_output=True, text=True).stdout)
                new_record = {**record, 'id': 702, 'protocolId': 'template-software-clinical-revision', 'clinicalDocument': revised, 'isActive': 1}
                for key in ['prophylaxis', 'nursingCare', 'specialAlerts', 'renalAdjustments', 'hepaticAdjustments', 'hematologicAdjustments', 'dilutionInfo', 'emetogenicRisk']:
                    if key in revised: new_record[key] = revised[key]
                records = [new_record]
                value = {'id': 702, 'protocolId': new_record['protocolId'], 'revision': {'reason': args.get('reason')}}
            elif name == 'templateClinicalRevision.prepare': value = prepare
            elif name in ['customProtocols.listActive', 'customProtocols.list']: value = records
            elif name == 'customProtocols.get': value = next((r for r in records if r['id'] == args.get('id')), None)
            else: value = fixtures.get(name, [])
            replies.append({'result': {'data': {'json': value}}})
        route.fulfill(status=200, content_type='application/json', body=json.dumps(replies if 'batch=' in req.url else replies[0]))
    context.route('**/api/trpc/**', route_api)
    context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.__clinicalCopied=t},configurable:true});")
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    try:
        page.goto('http://127.0.0.1:3000/?from_webdev=1', wait_until='networkidle')
        for selector, value in {'#name': 'PACIENTE FICTÍCIO', '#age': '40', '#weight': '70', '#height': '170', '#creatinine': '1'}.items(): page.locator(selector).fill(value)
        page.locator('#protocol').click()
        page.get_by_role('option', name=record['name'], exact=True).click()
        page.wait_for_timeout(400)
        toolbar = page.get_by_role('group', name='Ações da calculadora')
        check('BuEM sem antiemese mostra não informado, sem medicação presumida', 'Não informado' in page.get_by_role('region', name='Antieméticos cadastrados').inner_text())
        page.get_by_role('button', name='Editar protocolo', exact=True).click()
        dialog = page.get_by_role('dialog')
        dialog.wait_for(state='visible')
        dialog.get_by_label('Motivo da revisão', exact=True).wait_for(state='visible')
        check('editor clínico acessível na calculadora', 'Editar protocolo completo' in dialog.inner_text())
        i, f = field_index(path=['drugs', '0', 'observations'])
        dialog.locator(f'#clinical-field-{i}').fill('OBSERVAÇÃO REVISADA PARA TESTE')
        for key, value in {'diluent': 'DILUENTE REVISADO PARA TESTE', 'volume': 'VOLUME REVISADO PARA TESTE', 'infusionTime': 'TEMPO REVISADO PARA TESTE', 'stability': 'ESTABILIDADE REVISADA PARA TESTE', 'specialInstructions': 'INSTRUÇÃO REVISADA PARA TESTE'}.items():
            i, f = field_index(section='administration', tail=key)
            dialog.locator(f'#clinical-field-{i}').fill(value)
        i, f = field_index(section='administration', tail='validationStatus')
        dialog.locator(f'#clinical-field-{i}').fill('STATUS INFORMADO PELA EQUIPE — TESTE')
        def add_item(section, tail, value):
            i, f = field_index(section=section, tail=tail)
            dialog.get_by_role('button', name='Adicionar item em ' + f['label'], exact=True).click()
            label = f['label'] + ' · item ' + str(len(f.get('value') or []) + 1)
            dialog.get_by_label(label, exact=True).fill(value)
        add_item('prophylaxis', 'prophylaxis', 'PROFILAXIA REVISADA PARA TESTE')
        add_item('nursing', 'nursingCare', 'ENFERMAGEM REVISADA PARA TESTE')
        for key, value in {'day1': 'PRÉ-QT CADASTRADO PARA TESTE', 'days2to4': 'SEGUIMENTO CADASTRADO PARA TESTE', 'rescue': 'RESGATE CADASTRADO PARA TESTE', 'alerts': 'NOTA DE ANTIEMESE PARA TESTE'}.items(): add_item('antiemetics', key, value)
        dialog.get_by_label('Motivo da revisão', exact=True).fill('REVISÃO FICTÍCIA DO CONTEÚDO')
        check('antiemese exige referência temporal, não infere D0', not dialog.get_by_role('button', name='Criar nova versão', exact=True).is_enabled())
        i, f = field_index(section='antiemetics', tail='timeReference')
        dialog.locator(f'#clinical-field-{i}').fill('RELATIVO À ADMINISTRAÇÃO SELECIONADA, NÃO AO D0')
        check('motivo e campos clínicos preenchidos permitem nova versão', dialog.get_by_role('button', name='Criar nova versão', exact=True).is_enabled())
        check('prévia das alterações distingue antes/depois', 'Depois:' in dialog.get_by_role('region', name='Prévia das alterações').inner_text())
        page.screenshot(path=str(out/'editor-desktop.png'))
        page.set_viewport_size({'width': 375, 'height': 900})
        check('editor não transborda em 375px', dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1'))
        page.screenshot(path=str(out/'editor-mobile.png'))
        page.set_viewport_size({'width': 1440, 'height': 1100})
        dialog.get_by_role('button', name='Criar nova versão', exact=True).click()
        dialog.wait_for(state='hidden')
        check('revisão usa somente paths autorizados, hash e motivo', len(mutations) == 1 and mutations[0]['input']['expectedHash'] == prepare['expectedHash'] and mutations[0]['input']['reason'] == 'REVISÃO FICTÍCIA DO CONTEÚDO')
        check('original não foi reescrito após revisão', records[0]['clinicalDocument']['sourceDocument'] == record['clinicalDocument']['sourceDocument'])
        check('calculadora seleciona a nova versão ativa após salvar', page.get_by_role('region', name='Informações farmacêuticas fornecidas').inner_text().find('DILUENTE REVISADO PARA TESTE') >= 0)
        check('ordens antieméticas explicitamente cadastradas aparecem na tela', 'RESGATE CADASTRADO PARA TESTE' in page.get_by_role('region', name='Antieméticos cadastrados').inner_text())
        toolbar.get_by_role('button', name='Copiar', exact=True).click()
        copied = page.evaluate('window.__clinicalCopied')
        for sentinel in ['DILUENTE REVISADO PARA TESTE', 'OBSERVAÇÃO REVISADA PARA TESTE', 'PROFILAXIA REVISADA PARA TESTE', 'ENFERMAGEM REVISADA PARA TESTE', 'RESGATE CADASTRADO PARA TESTE', 'RELATIVO À ADMINISTRAÇÃO SELECIONADA, NÃO AO D0']:
            check('cópia preserva ' + sentinel, bool(copied) and sentinel in copied)
        toolbar.get_by_role('button', name='Prévia / PDF', exact=True).click()
        preview = page.get_by_role('dialog')
        preview.wait_for(state='visible')
        check('prévia usa antiemese e farmacotécnica revisadas', all(s in preview.inner_text() for s in ['RESGATE CADASTRADO PARA TESTE', 'DILUENTE REVISADO PARA TESTE', 'NOTA DE ANTIEMESE PARA TESTE']))
        page.wait_for_timeout(400)
        page.screenshot(path=str(out/'previa-revisada.png'))
        page.keyboard.press('Escape')
        page.goto('http://127.0.0.1:3000/dashboard', wait_until='networkidle')
        page.get_by_role('button', name='Protocolos Personalizados', exact=True).click()
        check('gerenciador mantém acesso à edição completa', page.get_by_role('button', name='Editar protocolo completo', exact=True).first.is_enabled())
        check('zero exceções JavaScript', not errors)
        check('zero gravações clínicas externas', not external)
    except Exception:
        (out/'failure-dom.txt').write_text(page.locator('body').inner_text())
        page.screenshot(path=str(out/'failure.png'))
        raise
    finally:
        (out/'result.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'mutations': mutations, 'externalWrites': len(external)}, ensure_ascii=False, indent=2) + '\n')
        browser.close()
print(json.dumps({'checks': len(checks), 'allPassed': all(c['passed'] for c in checks), 'externalWrites': len(external)}, ensure_ascii=False), flush=True)
