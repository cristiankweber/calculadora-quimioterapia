import {describe, it, expect} from 'vitest';
import {resolveClinicalProtocol} from '../shared/clinicalProtocols/resolver';
import {mapResolvedTemplateDrugs,getTemplatePrescriptionIssues} from '../shared/clinicalProtocols/templates';
import {convertToUserTemplatePackage,validateImportFormat} from './seedSystemProtocols';
import {validateActiveTemplatePrescription} from './activeTemplatePrescription';
import {createPrescriptionInputSchema,validateDoseSafety} from './prescriptionSchema';

const drug = (extra:any={})=>({id:'d',name:'Fármaco sintético',dose:10,doseUnit:'mg',route:'IV',days:'1',administrationFrequency:{administrationsPerDay:1,doseRepresents:'per_administration'},schedule:[{dose:10,days:[1]}],...extra});
const raw = (drugs=[drug()],extra:any={})=>({version:'2.18',protocols:[{id:'synthetic',name:'Teste de software',indication:'Sem uso clínico',cycles:2,cycleLength:21,drugs,...extra}]});
const make=(drugs=[drug()],extra:any={})=>(convertToUserTemplatePackage(raw(drugs,extra)) as any).protocols[0];
const context={cycle:1,day:1,bsa:2,weight:70};
function request(document:any,selected:any={cycle:1,day:1}) {
 const resolution=resolveClinicalProtocol(document,{...context,...selected});
 const drugs=mapResolvedTemplateDrugs(resolution);
 return {patientId:1,patientName:'Fictício',protocolName:document.name,cycle:selected.cycle,bsa:1.81,egfr:97.6,renalStatus:'green',prescriptionData:{patient:{name:'Fictício',age:40,sex:'M',weight:70,height:170,creatinine:1,ecog:0},protocol:{id:'template-test',name:document.name,templateContext:selected},calculatedValues:{bsa:1.81,egfr:97.6,renalStatus:'green'},drugs:drugs.map(d=>({name:d.name,baseDose:d.dose,doseUnit:d.doseUnit,resultUnit:d.resultUnit,calculatedDose:d.calculatedDose,finalDose:d.calculatedDose,route:d.route,days:d.days,frequency:d.frequency,dailyDose:d.dailyDose,timeOrigin:d.timeOrigin,doseRepresents:d.doseRepresents}))}};
}
const stored=(doc:any)=>({userId:7,protocolId:'template-test',name:doc.name,isActive:1,clinicalDocument:doc,clinicalPackage:{version:'user-protocol-template-1.0'}});

describe('Contratos de segurança ainda não cobertos — fixtures sem uso clínico',()=>{
 it('R1: ageTable/doseDecision na fase precisa bloquear mesmo com phaseId selecionado',()=>{
  const d=make([drug()],{phaseLibrary:[{id:'p',name:'P',drugs:[drug()],extensions:{ageTable:[{maxAge:10,dose:2},{minAge:11,dose:10}],doseDecision:'Selecionar dose por idade antes de usar'}}]});
  const ctx={...context,phaseId:'p'};
  const r=resolveClinicalProtocol(d,ctx);
  expect(getTemplatePrescriptionIssues(d,ctx,r).length).toBeGreaterThan(0);
 });
 it('R2: converter BrECADD deve preservar schedule e frequência explícitos, não recriá-los por days',()=>{
  const original=drug({days:'1',administrationFrequency:{administrationsPerDay:2,doseRepresents:'per_24_hours'},schedule:[{dose:4,doseUnit:'mg',days:[2],administrationsPerDay:2,doseRepresents:'per_administration'}]});
  const source={version:'1.0',protocols:[{name:'BrECADD sintético',indication:'Software',cycles:4,cycleLength:21,drugs:[original]}]};
  const converted:any=convertToUserTemplatePackage(source);
  expect(converted.protocols[0].drugs[0].schedule).toEqual(original.schedule);
 });
 it('R3: aliases cycle_start e cycle_day_one devem detectar sobreposição da mesma droga/dia',()=>{
  const d=make([drug({schedule:[{dose:10,days:[1],timeOrigin:'cycle_day_one'},{dose:20,days:[1],timeOrigin:'cycle_start'}]})]);
  const selected={cycle:2,day:1};
  const r=resolveClinicalProtocol(d,{...context,...selected});
  const input=request(make(),selected);
  const first=input.prescriptionData.drugs[0];
  input.prescriptionData.drugs.push({...first,baseDose:20,calculatedDose:20,finalDose:20,dailyDose:20,timeOrigin:'cycle_start'});
  const payload=createPrescriptionInputSchema.parse(input);
  // Explicit malicious orders must be rejected even if the mapper already emits nothing.
  expect(()=>validateActiveTemplatePrescription(payload,stored(d),7)).toThrow(/não resolvida/);
  expect(r.prescriptionBlocked).toBe(true);
  expect(mapResolvedTemplateDrugs(r)).toEqual([]);
 });
 it('R4: tolerância da revalidação não pode aceitar dose final zero para etapa positiva',()=>{
  const d=make([drug({dose:0.005,schedule:[{dose:0.005,days:[1]}]})]);
  const input=request(d);
  Object.assign(input.prescriptionData.drugs[0],{calculatedDose:0,finalDose:0,dailyDose:0});
  const parsed=createPrescriptionInputSchema.parse(input);
  expect(validateDoseSafety(parsed.prescriptionData.drugs)).toEqual([]);
  expect(()=>validateActiveTemplatePrescription(parsed,stored(d),7)).toThrow();
 });
 it('R5: doseRepresents per_24_hours explícito da calculationPolicy não pode virar per_administration',()=>{
  const d=make([drug({administrationFrequency:{administrationsPerDay:2},schedule:[{dose:10,days:[1]}]})],{calculationPolicy:{doseRepresents:'per_24_hours'}});
  expect(validateImportFormat(convertToUserTemplatePackage(raw(d.drugs,{calculationPolicy:{doseRepresents:'per_24_hours'}})))).toEqual([]);
  const r=resolveClinicalProtocol(d,context);
  // Ou interpreta o escopo do documento, ou bloqueia; nunca duplica a dose diária.
  expect(r.prescriptionBlocked || (r.rows[0].calculatedDose===5 && r.rows[0].dailyDose===10)).toBe(true);
 });
});
