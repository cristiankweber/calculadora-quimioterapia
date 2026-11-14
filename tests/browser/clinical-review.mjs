// Componentes reais da calculadora. Sem pacientes ou prescrições persistidos.
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,pass,detail)=>({name,pass:!!pass,detail});
async function waitFor(get,label){for(let i=0;i<60;i++){const value=get();if(value)return value;await delay(100);}throw new Error('Tempo esgotado: '+label);}
async function fill(id,value){const input=document.getElementById(id)||document.querySelector(id);if(!input)throw new Error('Campo ausente: '+id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));await delay(140);}
async function select(name){await fill('search',name);const option=await waitFor(()=>[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.includes(name)),'protocolo '+name);option.click();await delay(500);document.getElementById('search')?.blur();await waitFor(()=>document.querySelector('section[aria-label="Contexto da simulação"]'),'painel clínico');}
function panel(){return document.querySelector('section[aria-label="Contexto da simulação"]').closest('[data-slot=card]');}
export async function run(){
 const results=[];
 for(const [id,value] of Object.entries({name:'PACIENTE FICTÍCIO — INTEGRAÇÃO',age:60,weight:70,height:170,creatinine:1,bilirubin:.8}))await fill(id,value);
 results.push(check('Biblioteca revisada é a padrão',document.getElementById('protocol-library').textContent.includes('Revisados')));
 await select('R-DHAP');
 const dhap=panel();
 results.push(check('R-DHAP tem doses de referência e frequência explícita',dhap.innerText.includes('Citarabina')&&dhap.innerText.includes('2 administrações/24h')&&dhap.innerText.includes('mg')));
 const headerButtons=[...document.querySelectorAll('header button')].filter(e=>/^(Salvar|Prévia \/ PDF|Copiar)$/.test(e.textContent.trim()));
 results.push(check('Salvar/PDF/Copiar permanecem desabilitados',headerButtons.length===3&&headerButtons.every(e=>e.disabled),headerButtons.map(e=>({text:e.textContent.trim(),disabled:e.disabled}))));
 const day=document.querySelector('section[aria-label="Contexto da simulação"] input[title="Dia na origem temporal declarada"]')||[...document.querySelectorAll('section[aria-label="Contexto da simulação"] input')].find(e=>e.id.endsWith('-day'));
 results.push(check('Campo de dia acessível está disponível',day&&!day.disabled,day?.id));
 if(day){await fill('#'+CSS.escape(day.id),2);results.push(check('Dia 2 não usa dose principal da cisplatina',panel().innerText.includes('Não programada')));}
 await select('BuEM');
 const buem=panel();results.push(check('BuEM preserva Bussulfano e frequência 12/12h',buem.innerText.includes('Bussulfano')&&buem.innerText.includes('2 administrações/24h')&&buem.innerText.includes('Intervalo: 12 h')&&buem.innerText.includes('112')));
 await select('R-ICE');
 const support=[...document.querySelectorAll('[data-slot=card]')].find(e=>e.innerText.includes('Calculadora de Hidratação e Suporte'));
 results.push(check('R-ICE nunca é identificado como cisplatina pelo nome',support&&!support.innerText.includes('Cisplatina'),support?.innerText.slice(0,850)));
 await select('FLAG-Ida');
 const support2=[...document.querySelectorAll('[data-slot=card]')].find(e=>e.innerText.includes('Calculadora de Hidratação e Suporte'));
 results.push(check('FLAG-Ida não aciona ifosfamida pelo nome',support2&&!support2.innerText.includes('Ifosfamida')));
 await select('GRAALL');
 const phase=document.querySelector('section[aria-label="Contexto da simulação"] [role=combobox]');
 results.push(check('GRAALL exige fase sem concatenar drogas',phase&&phase.getAttribute('aria-invalid')==='true'&&!panel().querySelector('table')));
 results.push(check('Não há documento de prescrição para rascunho',!document.querySelector('[data-slot=dialog-content]')&&!document.querySelector('.print-only')));
 window.clinicalReviewResults={results,passed:results.filter(r=>r.pass).length,total:results.length};return window.clinicalReviewResults;
}
