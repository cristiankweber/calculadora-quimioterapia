import type { PatientData, Protocol, Drug, CalculatedValues } from '@/types/calculator';
import type { AntiemeticProphylaxis } from '@/types/calculator';

interface PrescriptionData {
  patient: PatientData;
  calculatedValues: CalculatedValues;
  protocol: Protocol;
  cycle: number;
  drugs: Drug[];
  antiemetics: AntiemeticProphylaxis;
}

export async function generatePrescriptionPDF(data: PrescriptionData): Promise<void> {
  const { patient, calculatedValues, protocol, cycle, drugs, antiemetics } = data;

  // Criar conteúdo HTML para o PDF
  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 20pt;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      background-color: #2563eb;
      color: white;
      padding: 8px 12px;
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 10px;
    }
    .info-item {
      padding: 5px;
    }
    .info-label {
      font-weight: bold;
      color: #2563eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    th {
      background-color: #f1f5f9;
      padding: 8px;
      text-align: left;
      border: 1px solid #cbd5e1;
      font-weight: bold;
    }
    td {
      padding: 8px;
      border: 1px solid #cbd5e1;
    }
    .alert-box {
      background-color: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 10px;
      margin-bottom: 10px;
    }
    .alert-title {
      font-weight: bold;
      color: #dc2626;
      margin-bottom: 5px;
    }
    .prophylaxis-list {
      margin-left: 20px;
    }
    .prophylaxis-list li {
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    .calculated-badge {
      background-color: #dbeafe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: bold;
    }
    .status-green {
      color: #16a34a;
      font-weight: bold;
    }
    .status-yellow {
      color: #ca8a04;
      font-weight: bold;
    }
    .status-red {
      color: #dc2626;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PRESCRIÇÃO DE QUIMIOTERAPIA</h1>
    <p>Hematologia e Oncologia</p>
    <p>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
  </div>

  <!-- Dados do Paciente -->
  <div class="section">
    <div class="section-title">DADOS DO PACIENTE</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome/Identificador:</span> ${patient.name || 'Não informado'}
      </div>
      <div class="info-item">
        <span class="info-label">Idade:</span> ${patient.age} anos
      </div>
      <div class="info-item">
        <span class="info-label">Sexo:</span> ${patient.sex === 'M' ? 'Masculino' : 'Feminino'}
      </div>
      <div class="info-item">
        <span class="info-label">ECOG:</span> ${patient.ecog}
      </div>
      <div class="info-item">
        <span class="info-label">Peso:</span> ${patient.weight} kg
      </div>
      <div class="info-item">
        <span class="info-label">Altura:</span> ${patient.height} cm
      </div>
      <div class="info-item">
        <span class="info-label">Creatinina:</span> ${patient.creatinine} mg/dL
      </div>
      <div class="info-item">
        <span class="info-label">Bilirrubina:</span> ${patient.bilirubin} mg/dL
      </div>
    </div>
    ${patient.comorbidities ? `<div class="info-item"><span class="info-label">Comorbidades:</span> ${patient.comorbidities}</div>` : ''}
  </div>

  <!-- Valores Calculados -->
  <div class="section">
    <div class="section-title">VALORES CALCULADOS</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Superfície Corporal (SC):</span> 
        <span class="calculated-badge">${calculatedValues.bsa.toFixed(2)} m²</span>
      </div>
      <div class="info-item">
        <span class="info-label">eGFR (CKD-EPI 2021):</span> 
        <span class="calculated-badge">${calculatedValues.egfr.toFixed(1)} mL/min</span>
      </div>
      <div class="info-item">
        <span class="info-label">Função Renal:</span> 
        <span class="${calculatedValues.renalStatus === 'green' ? 'status-green' : calculatedValues.renalStatus === 'yellow' ? 'status-yellow' : 'status-red'}">
          ${calculatedValues.renalStatusLabel}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">Fator de Ajuste Global:</span> 
        <span class="calculated-badge">${(calculatedValues.globalAdjustmentFactor * 100).toFixed(0)}%</span>
      </div>
    </div>
  </div>

  <!-- Protocolo -->
  <div class="section">
    <div class="section-title">PROTOCOLO QUIMIOTERÁPICO</div>
    <div class="info-item">
      <span class="info-label">Protocolo:</span> ${protocol.name} - Ciclo ${cycle}/${protocol.cycles}
    </div>
    <div class="info-item">
      <span class="info-label">Indicação:</span> ${protocol.indication}
    </div>
    <div class="info-item">
      <span class="info-label">Duração do Ciclo:</span> ${protocol.cycleLength} dias
    </div>
  </div>

  <!-- Drogas -->
  <div class="section">
    <div class="section-title">DROGAS PRESCRITAS</div>
    <table>
      <thead>
        <tr>
          <th>Droga</th>
          <th>Dose Base</th>
          <th>Dose Calculada</th>
          <th>Via</th>
          <th>Dias</th>
          <th>Observações</th>
        </tr>
      </thead>
      <tbody>
        ${drugs.map(drug => `
          <tr>
            <td><strong>${drug.name}</strong></td>
            <td>${drug.dose} ${drug.doseUnit}</td>
            <td><strong>${(drug.calculatedDose || 0).toFixed(1)} mg</strong></td>
            <td>${drug.route}</td>
            <td>${drug.days}</td>
            <td>${drug.observations || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Alertas Especiais -->
  ${protocol.specialAlerts.length > 0 ? `
  <div class="section">
    <div class="section-title">⚠️ ALERTAS ESPECIAIS</div>
    ${protocol.specialAlerts.map(alert => `
      <div class="alert-box">
        <div class="alert-title">ATENÇÃO</div>
        <div>${alert}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Profilaxias -->
  <div class="section">
    <div class="section-title">PROFILAXIAS OBRIGATÓRIAS/RECOMENDADAS</div>
    <ul class="prophylaxis-list">
      ${protocol.prophylaxis.map(p => `<li>${p}</li>`).join('')}
    </ul>
  </div>

  <!-- Antiemético -->
  <div class="section">
    <div class="section-title">PROFILAXIA ANTIEMÉTICA (Risco ${antiemetics.risk === 'high' ? 'Alto' : antiemetics.risk === 'moderate' ? 'Moderado' : 'Baixo'})</div>
    <div style="margin-bottom: 15px;">
      <strong>Dia 1 (Pré-QT):</strong>
      <ul class="prophylaxis-list">
        ${antiemetics.day1.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
    <div style="margin-bottom: 15px;">
      <strong>Dias 2-4:</strong>
      <ul class="prophylaxis-list">
        ${antiemetics.days2to4.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
    <div>
      <strong>Medicações de Resgate:</strong>
      <ul class="prophylaxis-list">
        ${antiemetics.rescue.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- Cuidados de Enfermagem -->
  <div class="section">
    <div class="section-title">CUIDADOS DE ENFERMAGEM</div>
    <ul class="prophylaxis-list">
      ${protocol.nursingCare.map(c => `<li>${c}</li>`).join('')}
    </ul>
  </div>

  <!-- Ajustes -->
  ${protocol.renalAdjustments.length > 0 || protocol.hepaticAdjustments.length > 0 || protocol.hematologicAdjustments.length > 0 ? `
  <div class="section">
    <div class="section-title">AJUSTES DE DOSE</div>
    ${protocol.renalAdjustments.length > 0 ? `
      <div style="margin-bottom: 10px;">
        <strong>Ajustes Renais:</strong>
        <ul class="prophylaxis-list">
          ${protocol.renalAdjustments.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${protocol.hepaticAdjustments.length > 0 ? `
      <div style="margin-bottom: 10px;">
        <strong>Ajustes Hepáticos:</strong>
        <ul class="prophylaxis-list">
          ${protocol.hepaticAdjustments.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${protocol.hematologicAdjustments.length > 0 ? `
      <div>
        <strong>Ajustes Hematológicos:</strong>
        <ul class="prophylaxis-list">
          ${protocol.hematologicAdjustments.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p><strong>Calculadora de Prescrição Quimioterápica</strong></p>
    <p>Sistema de apoio à decisão clínica - Hematologia e Oncologia</p>
    <p>Este documento foi gerado automaticamente. Sempre revisar e validar clinicamente antes de administrar.</p>
  </div>
</body>
</html>
  `;

  // Criar um blob com o HTML
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Abrir em nova janela para impressão/salvamento como PDF
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
    const link = document.createElement('a');
    link.href = url;
    link.download = `prescricao_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
