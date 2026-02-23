import type { PatientData, Protocol, Drug, CalculatedValues } from '@/types/calculator';
import type { AntiemeticProphylaxis } from '@/types/calculator';
import type { HydrationResult, ElectrolyteReplacement, TransfusionRecommendation } from '@/lib/hydrationSupport';
import type { PdfSections } from '@/components/PdfPreviewModal';

interface PrescriptionData {
  patient: PatientData;
  calculatedValues: CalculatedValues;
  protocol: Protocol;
  cycle: number;
  drugs: Drug[];
  antiemetics: AntiemeticProphylaxis;
  hydration?: HydrationResult | null;
  electrolytes?: ElectrolyteReplacement[];
  transfusion?: TransfusionRecommendation[];
  sections?: PdfSections;
}

// ── Sanitização HTML para evitar XSS ──────────────────────────────────────
function escapeHtml(text: string | number | undefined | null): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderList(items: string[]): string {
  if (!items || items.length === 0) return '<li>Nenhum</li>';
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function renalStatusClass(status: string): string {
  switch (status) {
    case 'green': return 'status-green';
    case 'yellow': return 'status-yellow';
    case 'red': return 'status-red';
    default: return '';
  }
}

// ── Template CSS (extraído para manutenção) ───────────────────────────────
const PDF_STYLES = `
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }
  .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { color: #2563eb; margin: 0; font-size: 20pt; }
  .header p { margin: 5px 0; color: #666; }
  .section { margin-bottom: 20px; }
  .section-title { background-color: #2563eb; color: white; padding: 8px 12px; font-weight: bold; font-size: 12pt; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px; }
  .info-item { padding: 5px; }
  .info-label { font-weight: bold; color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th { background-color: #f1f5f9; padding: 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; }
  td { padding: 8px; border: 1px solid #cbd5e1; }
  .alert-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 10px; margin-bottom: 10px; }
  .alert-title { font-weight: bold; color: #dc2626; margin-bottom: 5px; }
  .prophylaxis-list { margin-left: 20px; }
  .prophylaxis-list li { margin-bottom: 5px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #e5e7eb; font-size: 9pt; color: #666; text-align: center; }
  .calculated-badge { background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
  .status-green { color: #16a34a; font-weight: bold; }
  .status-yellow { color: #ca8a04; font-weight: bold; }
  .status-red { color: #dc2626; font-weight: bold; }
  .hydration-scheme { border-left: 4px solid #2563eb; padding: 8px 12px; margin-bottom: 10px; background: #f8fafc; }
  .hydration-scheme.pre { border-left-color: #3b82f6; }
  .hydration-scheme.concurrent { border-left-color: #8b5cf6; }
  .hydration-scheme.post { border-left-color: #22c55e; }
  .hydration-scheme h4 { margin: 0 0 5px 0; font-size: 11pt; }
  .hydration-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: bold; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-info { background: #dbeafe; color: #1e40af; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-low { background: #fef3c7; color: #92400e; }
  .badge-normal { background: #dcfce7; color: #166534; }
  .badge-high { background: #fef3c7; color: #92400e; }
  .badge-critical_high { background: #fee2e2; color: #991b1b; }
  .elec-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
  .transfusion-card { border-left: 4px solid #e2e8f0; padding: 8px 12px; margin-bottom: 10px; background: #f8fafc; }
  .transfusion-card.immediate { border-left-color: #dc2626; }
  .transfusion-card.routine { border-left-color: #f59e0b; }
  .transfusion-card.not_indicated { border-left-color: #22c55e; }
  .monitoring-list { margin-left: 15px; font-size: 10pt; color: #475569; }
  .monitoring-list li { margin-bottom: 3px; }
`;

// ── Seção de Hidratação para PDF ──────────────────────────────────────────
function buildHydrationSection(hydration?: HydrationResult | null): string {
  if (!hydration || hydration.protocolType === 'none' || hydration.schemes.length === 0) return '';

  const alertsHtml = hydration.alerts.length > 0 ? hydration.alerts.map(a => `
    <div class="alert-box" style="border-left-color: ${a.type === 'danger' ? '#dc2626' : a.type === 'warning' ? '#f59e0b' : '#3b82f6'};">
      <div class="alert-title" style="color: ${a.type === 'danger' ? '#dc2626' : a.type === 'warning' ? '#92400e' : '#1e40af'};">
        ${a.type === 'danger' ? 'PERIGO' : a.type === 'warning' ? 'ATENÇÃO' : 'INFO'}
      </div>
      <div>${escapeHtml(a.message)}</div>
    </div>
  `).join('') : '';

  const schemesHtml = hydration.schemes.map(s => `
    <div class="hydration-scheme ${s.phase}">
      <h4>${escapeHtml(s.phaseLabel)}</h4>
      <table style="margin-bottom: 5px;">
        <tr>
          <td style="width: 35%;"><strong>Solução:</strong> ${escapeHtml(s.solution)}</td>
          <td style="width: 20%;"><strong>Volume:</strong> ${s.volume} mL</td>
          <td style="width: 20%;"><strong>Velocidade:</strong> ${s.rate} mL/h</td>
          <td style="width: 25%;"><strong>Duração:</strong> ${s.duration}h</td>
        </tr>
      </table>
      ${s.additives && s.additives.length > 0 ? `<div style="font-size: 10pt;"><strong>Aditivos:</strong> ${s.additives.map(a => escapeHtml(a)).join(', ')}</div>` : ''}
      ${s.notes && s.notes.length > 0 ? `<div style="font-size: 10pt; color: #475569;"><strong>Notas:</strong> ${s.notes.map(n => escapeHtml(n)).join('; ')}</div>` : ''}
    </div>
  `).join('');

  const monitoringHtml = hydration.monitoring.length > 0 ? `
    <div style="margin-top: 10px;">
      <strong>Monitorização:</strong>
      <ul class="monitoring-list">${hydration.monitoring.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
    </div>
  ` : '';

  return `
    <div class="section">
      <div class="section-title">💧 ESQUEMA DE HIDRATAÇÃO — ${escapeHtml(hydration.protocolLabel)}</div>
      <div class="info-item" style="margin-bottom: 10px;"><span class="info-label">Volume Total:</span> <span class="calculated-badge">${hydration.totalVolume} mL</span></div>
      ${alertsHtml}
      ${schemesHtml}
      ${monitoringHtml}
    </div>
  `;
}

// ── Seção de Eletrólitos para PDF ────────────────────────────────────────
function buildElectrolytesSection(electrolytes?: ElectrolyteReplacement[]): string {
  if (!electrolytes || electrolytes.length === 0) return '';

  // Filtrar apenas eletrólitos que precisam de reposição (não normais)
  const abnormal = electrolytes.filter(e => e.status !== 'normal');
  if (abnormal.length === 0) return '';

  const cardsHtml = abnormal.map(e => {
    const replacementsHtml = e.replacements.length > 0 ? `
      <table style="margin-top: 8px;">
        <thead>
          <tr>
            <th>Solução</th>
            <th>Dose</th>
            <th>Via</th>
            <th>Velocidade</th>
            <th>Duração</th>
            <th>Frequência</th>
          </tr>
        </thead>
        <tbody>
          ${e.replacements.map(r => `
            <tr>
              <td>${escapeHtml(r.solution)}</td>
              <td><strong>${escapeHtml(r.dose)}</strong></td>
              <td>${escapeHtml(r.route)}</td>
              <td>${escapeHtml(r.rate)}</td>
              <td>${escapeHtml(r.duration)}</td>
              <td>${escapeHtml(r.frequency)}</td>
            </tr>
            ${r.notes ? `<tr><td colspan="6" style="font-size: 9pt; color: #475569; border-top: none;">📋 ${escapeHtml(r.notes)}</td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
    ` : '';

    const alertsHtml = e.alerts.length > 0 ? e.alerts.map(a => `
      <div class="alert-box" style="margin-top: 8px;">
        <div>${escapeHtml(a)}</div>
      </div>
    `).join('') : '';

    const monitoringHtml = e.monitoring.length > 0 ? `
      <div style="margin-top: 5px;">
        <strong style="font-size: 10pt;">Monitorização:</strong>
        <ul class="monitoring-list">${e.monitoring.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
      </div>
    ` : '';

    return `
      <div class="elec-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <strong style="font-size: 12pt;">${escapeHtml(e.electrolyte)}</strong>
          <span class="hydration-badge badge-${e.status}">${escapeHtml(e.statusLabel)}</span>
        </div>
        <div class="info-grid" style="margin-bottom: 5px;">
          <div class="info-item"><span class="info-label">Valor Atual:</span> ${e.currentValue} ${escapeHtml(e.unit)}</div>
          <div class="info-item"><span class="info-label">Faixa Normal:</span> ${escapeHtml(e.normalRange)}</div>
        </div>
        ${alertsHtml}
        ${replacementsHtml}
        ${monitoringHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <div class="section-title">⚡ REPOSIÇÃO DE ELETRÓLITOS</div>
      ${cardsHtml}
    </div>
  `;
}

// ── Seção de Transfusão para PDF ─────────────────────────────────────────
function buildTransfusionSection(transfusion?: TransfusionRecommendation[]): string {
  if (!transfusion || transfusion.length === 0) return '';

  // Filtrar apenas produtos indicados
  const indicated = transfusion.filter(t => t.indicated);
  if (indicated.length === 0) return '';

  const cardsHtml = indicated.map(t => {
    const reqsHtml = t.specialRequirements.length > 0 ? `
      <div style="margin-top: 5px;">
        <strong>Requisitos Especiais:</strong>
        <ul class="prophylaxis-list">${t.specialRequirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>
    ` : '';

    const premedHtml = t.premedication.length > 0 ? `
      <div style="margin-top: 5px;">
        <strong>Pré-Medicação:</strong>
        <ul class="prophylaxis-list">${t.premedication.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      </div>
    ` : '';

    const alertsHtml = t.alerts.length > 0 ? t.alerts.map(a => `
      <div class="alert-box" style="margin-top: 5px;">
        <div>${escapeHtml(a)}</div>
      </div>
    `).join('') : '';

    const monitoringHtml = t.monitoring.length > 0 ? `
      <div style="margin-top: 5px;">
        <strong style="font-size: 10pt;">Monitorização:</strong>
        <ul class="monitoring-list">${t.monitoring.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
      </div>
    ` : '';

    return `
      <div class="transfusion-card ${t.urgency}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <strong style="font-size: 12pt;">${escapeHtml(t.productLabel)}</strong>
          <span class="hydration-badge ${t.urgency === 'immediate' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(t.urgencyLabel)}</span>
        </div>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">Valor Atual:</span> ${t.currentValue} ${escapeHtml(t.unit)}</div>
          <div class="info-item"><span class="info-label">Threshold:</span> ${t.threshold} ${escapeHtml(t.unit)}</div>
          <div class="info-item"><span class="info-label">Volume:</span> ${escapeHtml(t.volume)}</div>
          <div class="info-item"><span class="info-label">Incremento Esperado:</span> ${escapeHtml(t.expectedIncrement)}</div>
        </div>
        ${reqsHtml}
        ${premedHtml}
        ${alertsHtml}
        ${monitoringHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <div class="section-title">🩸 SUPORTE TRANSFUSIONAL</div>
      ${cardsHtml}
    </div>
  `;
}

export async function generatePrescriptionPDF(data: PrescriptionData): Promise<void> {
  const { patient, calculatedValues, protocol, cycle, drugs, antiemetics, sections } = data;

  // Se sections não for fornecido, incluir tudo (comportamento padrão)
  const s = sections ?? {
    patientData: true, calculatedValues: true, protocol: true, drugs: true,
    specialAlerts: true, prophylaxis: true, antiemetics: true, nursingCare: true,
    doseAdjustments: true, hydration: true, electrolytes: true, transfusion: true,
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');

  const drugsRows = drugs.map(drug => `
    <tr>
      <td><strong>${escapeHtml(drug.name)}</strong></td>
      <td>${escapeHtml(drug.dose)} ${escapeHtml(drug.doseUnit)}</td>
      <td><strong>${(drug.calculatedDose || 0).toFixed(1)} mg</strong></td>
      <td>${escapeHtml(drug.route)}</td>
      <td>${escapeHtml(drug.days)}</td>
      <td>${escapeHtml(drug.observations) || '-'}</td>
    </tr>
  `).join('');

  const specialAlertsSection = protocol.specialAlerts.length > 0 ? `
    <div class="section">
      <div class="section-title">⚠️ ALERTAS ESPECIAIS</div>
      ${protocol.specialAlerts.map(alert => `
        <div class="alert-box">
          <div class="alert-title">ATENÇÃO</div>
          <div>${escapeHtml(alert)}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const adjustmentsSection = (
    protocol.renalAdjustments.length > 0 ||
    protocol.hepaticAdjustments.length > 0 ||
    protocol.hematologicAdjustments.length > 0
  ) ? `
    <div class="section">
      <div class="section-title">AJUSTES DE DOSE</div>
      ${protocol.renalAdjustments.length > 0 ? `
        <div style="margin-bottom: 10px;">
          <strong>Ajustes Renais:</strong>
          <ul class="prophylaxis-list">${renderList(protocol.renalAdjustments)}</ul>
        </div>
      ` : ''}
      ${protocol.hepaticAdjustments.length > 0 ? `
        <div style="margin-bottom: 10px;">
          <strong>Ajustes Hepáticos:</strong>
          <ul class="prophylaxis-list">${renderList(protocol.hepaticAdjustments)}</ul>
        </div>
      ` : ''}
      ${protocol.hematologicAdjustments.length > 0 ? `
        <div>
          <strong>Ajustes Hematológicos:</strong>
          <ul class="prophylaxis-list">${renderList(protocol.hematologicAdjustments)}</ul>
        </div>
      ` : ''}
    </div>
  ` : '';

  const antiemeticRiskLabel = antiemetics.risk === 'high' ? 'Alto'
    : antiemetics.risk === 'moderate' ? 'Moderado'
    : antiemetics.risk === 'low' ? 'Baixo' : 'Mínimo';

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>${PDF_STYLES}</style>
</head>
<body>
  <div class="header">
    <h1>PRESCRIÇÃO DE QUIMIOTERAPIA</h1>
    <p>Hematologia e Oncologia</p>
    <p>Data de Emissão: ${dateStr} às ${timeStr}</p>
  </div>

  ${s.patientData ? `<div class="section">
    <div class="section-title">DADOS DO PACIENTE</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nome/Identificador:</span> ${escapeHtml(patient.name) || 'Não informado'}</div>
      <div class="info-item"><span class="info-label">Idade:</span> ${escapeHtml(patient.age)} anos</div>
      <div class="info-item"><span class="info-label">Sexo:</span> ${patient.sex === 'M' ? 'Masculino' : 'Feminino'}</div>
      <div class="info-item"><span class="info-label">ECOG:</span> ${escapeHtml(patient.ecog)}</div>
      <div class="info-item"><span class="info-label">Peso:</span> ${escapeHtml(patient.weight)} kg</div>
      <div class="info-item"><span class="info-label">Altura:</span> ${escapeHtml(patient.height)} cm</div>
      <div class="info-item"><span class="info-label">Creatinina:</span> ${escapeHtml(patient.creatinine)} mg/dL</div>
      <div class="info-item"><span class="info-label">Bilirrubina:</span> ${escapeHtml(patient.bilirubin)} mg/dL</div>
    </div>
    ${patient.comorbidities ? `<div class="info-item"><span class="info-label">Comorbidades:</span> ${escapeHtml(patient.comorbidities)}</div>` : ''}
  </div>` : ''}

  ${s.calculatedValues ? `<div class="section">
    <div class="section-title">VALORES CALCULADOS</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Superfície Corporal (SC):</span> <span class="calculated-badge">${calculatedValues.bsa.toFixed(2)} m²</span></div>
      <div class="info-item"><span class="info-label">eGFR (CKD-EPI 2021):</span> <span class="calculated-badge">${calculatedValues.egfr.toFixed(1)} mL/min</span></div>
      <div class="info-item"><span class="info-label">Função Renal:</span> <span class="${renalStatusClass(calculatedValues.renalStatus)}">${escapeHtml(calculatedValues.renalStatusLabel)}</span></div>
      <div class="info-item"><span class="info-label">Fator de Ajuste Global:</span> <span class="calculated-badge">${(calculatedValues.globalAdjustmentFactor * 100).toFixed(0)}%</span></div>
    </div>
  </div>` : ''}

  ${s.protocol ? `<div class="section">
    <div class="section-title">PROTOCOLO QUIMIOTERÁPICO</div>
    <div class="info-item"><span class="info-label">Protocolo:</span> ${escapeHtml(protocol.name)} - Ciclo ${escapeHtml(cycle)}/${escapeHtml(protocol.cycles)}</div>
    <div class="info-item"><span class="info-label">Indicação:</span> ${escapeHtml(protocol.indication)}</div>
    <div class="info-item"><span class="info-label">Duração do Ciclo:</span> ${escapeHtml(protocol.cycleLength)} dias</div>
  </div>` : ''}

  ${s.drugs ? `<div class="section">
    <div class="section-title">DROGAS PRESCRITAS</div>
    <table>
      <thead>
        <tr><th>Droga</th><th>Dose Base</th><th>Dose Calculada</th><th>Via</th><th>Dias</th><th>Observações</th></tr>
      </thead>
      <tbody>${drugsRows}</tbody>
    </table>
  </div>` : ''}

  ${s.specialAlerts ? specialAlertsSection : ''}

  ${s.prophylaxis ? `<div class="section">
    <div class="section-title">PROFILAXIAS OBRIGATÓRIAS/RECOMENDADAS</div>
    <ul class="prophylaxis-list">${renderList(protocol.prophylaxis)}</ul>
  </div>` : ''}

  ${s.antiemetics ? `<div class="section">
    <div class="section-title">PROFILAXIA ANTIEMÉTICA (Risco ${antiemeticRiskLabel})</div>
    <div style="margin-bottom: 15px;">
      <strong>Dia 1 (Pré-QT):</strong>
      <ul class="prophylaxis-list">${renderList(antiemetics.day1)}</ul>
    </div>
    <div style="margin-bottom: 15px;">
      <strong>Dias 2-4:</strong>
      <ul class="prophylaxis-list">${renderList(antiemetics.days2to4)}</ul>
    </div>
    <div>
      <strong>Medicações de Resgate:</strong>
      <ul class="prophylaxis-list">${renderList(antiemetics.rescue)}</ul>
    </div>
  </div>` : ''}

  ${s.nursingCare ? `<div class="section">
    <div class="section-title">CUIDADOS DE ENFERMAGEM</div>
    <ul class="prophylaxis-list">${renderList(protocol.nursingCare)}</ul>
  </div>` : ''}

  ${s.doseAdjustments ? adjustmentsSection : ''}

  ${s.hydration ? buildHydrationSection(data.hydration) : ''}

  ${s.electrolytes ? buildElectrolytesSection(data.electrolytes) : ''}

  ${s.transfusion ? buildTransfusionSection(data.transfusion) : ''}

  <div class="footer">
    <p><strong>Calculadora de Prescrição Quimioterápica</strong></p>
    <p>Sistema de apoio à decisão clínica - Hematologia e Oncologia</p>
    <p>Este documento foi gerado automaticamente. Sempre revisar e validar clinicamente antes de administrar.</p>
  </div>
</body>
</html>`;

  // Criar blob e abrir para impressão
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  try {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          URL.revokeObjectURL(url);
        }, 250);
      };
    } else {
      // Fallback: download como HTML se popup bloqueado
      const safeName = (patient.name || 'paciente').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescricao_${safeName}_${new Date().toISOString().split('T')[0]}.html`;
      link.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
