// Executar no navegador da prévia: import('/@fs/home/ubuntu/calculadora-quimioterapia/tests/browser/ui-review.mjs').
// Somente dados fictícios; nenhuma gravação, exportação ou alteração de doses.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(get, description) {
  for (let i = 0; i < 100; i++) {
    const value = get();
    if (value) return value;
    await delay(100);
  }
  throw new Error(`Tempo esgotado: ${description}`);
}
function rect(el) {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
}
function accessibleName(el, doc) {
  return (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map(id => doc.getElementById(id)?.textContent || '').join(' ') || Array.from(el.labels || []).map(l => l.textContent).join(' ') || el.textContent || '').trim();
}
export async function mount(width = 375, path = '/') {
  document.querySelector('#ui-review-host')?.remove();
  if ('serviceWorker' in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister()));
  if ('caches' in window) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
  const host = document.createElement('div');
  host.id = 'ui-review-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#e2e8f0;overflow:auto;display:flex;align-items:flex-start;justify-content:center;';
  const frame = document.createElement('iframe');
  frame.title = 'Teste de interface com dados fictícios';
  frame.style.cssText = `width:${width}px;height:812px;flex:none;border:0;background:white;`;
  host.append(frame);
  document.body.append(host);
  frame.src = '/@fs/home/ubuntu/calculadora-quimioterapia/tests/browser/ui-review.html?path=' + encodeURIComponent(path) + '&ui-review=' + Date.now();
  await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  await waitFor(() => frame.contentDocument.querySelector('main'), 'carregar página');
  await delay(300);
  window.uiReviewFrame = frame;
  return frame;
}
export async function settingsLogo(frame) {
  const win = frame.contentWindow;
  const transfer = new win.DataTransfer();
  transfer.items.add(new win.File(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#dbeafe"/><text x="15" y="45">LOGO DE TESTE</text></svg>'], 'logo-ficticio.svg', { type: 'image/svg+xml' }));
  const input = frame.contentDocument.getElementById('logo');
  input.files = transfer.files;
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  await waitFor(() => frame.contentDocument.querySelector('main img'), 'logo fictício');
  await delay(300);
}
async function fill(frame, id, value) {
  const win = frame.contentWindow;
  const input = frame.contentDocument.getElementById(id) || frame.contentDocument.querySelector(id);
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  await delay(120);
}
export async function populate(frame) {
  for (const [id, value] of Object.entries({ name: 'PACIENTE FICTÍCIO — TESTE DE INTERFACE', age: '60', weight: '70', height: '170', creatinine: '1', bilirubin: '0.8' })) {
    await fill(frame, id, value);
  }
  await fill(frame, 'search', 'R-DHAP');
  const option = await waitFor(() => Array.from(frame.contentDocument.querySelectorAll('[role=option]')).find(el => el.textContent.includes('R-DHAP')), 'sugestão de protocolo');
  option.click();
  await waitFor(() => frame.contentDocument.querySelector('table tbody')?.textContent.includes('Rituximabe'), 'drogas calculadas');
  frame.contentDocument.getElementById('search').blur();
  await delay(300);
}
export async function support(frame, tab) {
  const doc = frame.contentDocument;
  const trigger = Array.from(doc.querySelectorAll('[role=tab]')).find(el => el.textContent.trim() === tab);
  trigger.dispatchEvent(new frame.contentWindow.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  trigger.click();
  const fields = tab === 'Eletrólitos'
    ? { '135-145': '140', '3.5-5.5': '3.1', '1.8-2.4': '1.5', '1.15-1.35': '1.2', '2.5-4.5': '3' }
    : { 'Ex: 7.5': '6.5', 'Ex: 15000': '9000' };
  for (const [placeholder, value] of Object.entries(fields)) {
    await waitFor(() => doc.querySelector(`input[placeholder="${placeholder}"]`), 'exame fictício');
    await fill(frame, `input[placeholder="${placeholder}"]`, value);
  }
  await delay(300);
}
export async function preview(frame) {
  const doc = frame.contentDocument;
  Array.from(doc.querySelectorAll('header button')).find(el => /Preview|Prévia/.test(el.textContent))?.click();
  await waitFor(() => doc.querySelector('[data-slot=dialog-content]'), 'abrir prévia');
  Array.from(doc.querySelectorAll('[data-slot=dialog-content] button')).find(el => el.textContent.trim() === 'Seções')?.click();
  await waitFor(() => doc.querySelectorAll('[data-slot=dialog-content] [role=switch]').length === 12, 'painel de seções');
  await delay(300);
}
export function inspect(frame) {
  const doc = frame.contentDocument;
  const width = frame.contentWindow.innerWidth;
  const dialog = doc.querySelector('[data-slot=dialog-content]');
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
  check('Página sem rolagem horizontal externa', doc.documentElement.scrollWidth <= width + 1, { viewport: width, scrollWidth: doc.documentElement.scrollWidth });
  const heading = doc.querySelector('header h1');
  if (heading) check('Título integralmente dentro da viewport', rect(heading).left >= 0 && rect(heading).right <= width, rect(heading));
  if (!dialog) {
    const inputs = Array.from(doc.querySelectorAll('main input:not([type=hidden])'));
    check('Campos com rótulos programaticamente associados', inputs.every(el => accessibleName(el, doc)), inputs.filter(el => !accessibleName(el, doc)).map(el => ({ id: el.id, placeholder: el.placeholder })));
  }
  if (!dialog && width <= 640) {
    if (frame.contentWindow.location.pathname === '/settings') {
      const back = doc.querySelector('header button');
      const hr = rect(heading);
      const br = rect(back);
      check('Voltar não sobrepõe o título', hr.right <= br.left || hr.bottom <= br.top || br.bottom <= hr.top, { heading: hr, back: br });
      const logo = doc.querySelector('#logo');
      check('Seletor de arquivo tem largura utilizável', logo && rect(logo).width >= 160, logo && rect(logo));
    }
    const fields = Array.from(doc.querySelectorAll('main input:not([type=hidden]),main [role=combobox]'));
    check('Campos móveis com altura mínima de 44 px', fields.every(el => rect(el).height >= 44), fields.filter(el => rect(el).height < 44).map(el => ({ id: el.id, ...rect(el) })));
    check('Texto dos campos móveis com pelo menos 16 px', fields.every(el => parseFloat(frame.contentWindow.getComputedStyle(el).fontSize) >= 16), fields.filter(el => parseFloat(frame.contentWindow.getComputedStyle(el).fontSize) < 16).map(el => ({ id: el.id, placeholder: el.placeholder })));
    const actions = Array.from(doc.querySelectorAll('header button'));
    check('Ações do cabeçalho dentro da viewport', actions.every(el => rect(el).left >= 0 && rect(el).right <= width), actions.map(el => ({ text: el.textContent.trim(), ...rect(el) })));
  }
  if (dialog) {
    const dr = rect(dialog);
    check('Modal inteiro dentro da viewport', dr.left >= 0 && dr.right <= width && dr.top >= 0 && dr.bottom <= 812, dr);
    const switches = Array.from(dialog.querySelectorAll('[role=switch]'));
    check('12 controles de seção com nome acessível', switches.length === 12 && switches.every(el => accessibleName(el, doc)), switches.map(el => ({ name: accessibleName(el, doc), ...rect(el) })));
    const actions = Array.from(dialog.querySelectorAll('button')).filter(el => /Cancelar|Imprimir|Gerar PDF/.test(el.textContent));
    check('Ações do PDF visíveis e dentro do modal', actions.length === 3 && actions.every(el => { const r = rect(el); return r.left >= dr.left && r.right <= dr.right && r.top >= dr.top && r.bottom <= dr.bottom; }), actions.map(el => ({ text: el.textContent.trim(), ...rect(el) })));
    const sheet = dialog.querySelector('[data-testid=pdf-preview-document]') || dialog.querySelector('.bg-white.text-black');
    if (sheet) {
      const viewport = sheet.closest('[data-testid=pdf-preview-scroll]') || sheet.closest('[data-radix-scroll-area-viewport]');
      check('Área de prévia contida no modal', viewport && rect(viewport).left >= dr.left && rect(viewport).right <= dr.right && rect(viewport).width > 100, viewport && rect(viewport));
      check('Documento navegável horizontalmente sem conteúdo perdido', viewport && (sheet.scrollWidth <= viewport.clientWidth + 1 || /auto|scroll/.test(frame.contentWindow.getComputedStyle(viewport).overflowX)), { sheetScrollWidth: sheet.scrollWidth, viewportWidth: viewport?.clientWidth, overflowX: viewport && frame.contentWindow.getComputedStyle(viewport).overflowX });
    }
  }
  return { width, checks, failed: checks.filter(c => !c.pass).length };
}
export async function run(widths = [375, 768, 1280, 1920]) {
  const results = [];
  for (const width of widths) {
    const frame = await mount(width);
    results.push({ state: 'initial', ...inspect(frame) });
    await populate(frame);
    results.push({ state: 'populated', ...inspect(frame) });
    await support(frame, 'Eletrólitos');
    results.push({ state: 'electrolytes', ...inspect(frame) });
    await support(frame, 'Transfusão');
    results.push({ state: 'transfusion', ...inspect(frame) });
    await preview(frame);
    results.push({ state: 'pdf-sections', ...inspect(frame) });
  }
  window.uiReviewResults = results;
  return { results, failures: results.reduce((n, r) => n + r.failed, 0) };
}
