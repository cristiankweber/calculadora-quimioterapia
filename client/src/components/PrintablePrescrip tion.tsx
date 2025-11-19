import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { PatientData, Protocol, Drug, CalculatedValues, AntiemeticProphylaxis } from '@/types/calculator';

interface PrintablePrescriptionProps {
  patient: PatientData;
  calculatedValues: CalculatedValues;
  protocol: Protocol;
  cycle: number;
  drugs: Drug[];
  antiemetics: AntiemeticProphylaxis;
  prescriptionId?: string; // ID do banco de dados para rastreabilidade
  institutionName?: string;
  institutionLogo?: string;
  prescriberId?: string;
  prescriberName?: string;
  prescriberCRM?: string;
}

export default function PrintablePrescription({
  patient,
  calculatedValues,
  protocol,
  cycle,
  drugs,
  antiemetics,
  prescriptionId: savedPrescriptionId,
  institutionName = 'Hospital / Clínica',
  institutionLogo,
  prescriberId = 'SYSTEM',
  prescriberName = 'Médico Responsável',
  prescriberCRM = 'CRM XXXXX',
}: PrintablePrescriptionProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  // Usar ID do banco se disponível, caso contrário gerar temporário
  const prescriptionId = savedPrescriptionId || `RX-TEMP-${Date.now()}`;

  useEffect(() => {
    // Gerar QR code com ID da prescrição para rastreabilidade
    const data = JSON.stringify({
      id: prescriptionId,
      patient: patient.name,
      protocol: protocol.name,
      cycle,
      date: new Date().toISOString(),
      saved: !!savedPrescriptionId, // Indica se foi salvo no banco
    });

    QRCode.toDataURL(data, { width: 150, margin: 1 })
      .then(setQrCodeUrl)
      .catch((err) => console.error('Erro ao gerar QR code:', err));
  }, [prescriptionId, patient.name, protocol.name, cycle, savedPrescriptionId]);

  const formatDate = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());
  };

  return (
    <div className="hidden print:block bg-white text-black p-8 max-w-[210mm] mx-auto">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* Cabeçalho Institucional */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6 flex items-start justify-between">
        <div className="flex-1">
          {institutionLogo && (
            <img src={institutionLogo} alt="Logo" className="h-16 mb-2" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{institutionName}</h1>
          <p className="text-sm text-gray-600">Prescrição de Quimioterapia</p>
        </div>
        {qrCodeUrl && (
          <div className="text-center">
            <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
            <p className="text-xs text-gray-600 mt-1">ID: {prescriptionId.slice(-8)}</p>
          </div>
        )}
      </div>

      {/* Dados do Paciente */}
      <div className="mb-6 bg-gray-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Dados do Paciente</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="font-medium">Nome:</span> {patient.name || 'Não informado'}
          </div>
          <div>
            <span className="font-medium">Idade:</span> {patient.age} anos
          </div>
          <div>
            <span className="font-medium">Sexo:</span> {patient.sex === 'M' ? 'Masculino' : 'Feminino'}
          </div>
          <div>
            <span className="font-medium">Peso:</span> {patient.weight} kg
          </div>
          <div>
            <span className="font-medium">Altura:</span> {patient.height} cm
          </div>
          <div>
            <span className="font-medium">SC:</span> {calculatedValues.bsa.toFixed(2)} m²
          </div>
          <div>
            <span className="font-medium">eGFR:</span> {calculatedValues.egfr.toFixed(0)} mL/min/1.73m²
          </div>
          <div>
            <span className="font-medium">Status Renal:</span>{' '}
            <span
              className={`font-semibold ${
                calculatedValues.renalStatus === 'green'
                  ? 'text-green-700'
                  : calculatedValues.renalStatus === 'yellow'
                  ? 'text-yellow-700'
                  : 'text-red-700'
              }`}
            >
              {calculatedValues.renalStatusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Protocolo */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Protocolo Quimioterápico</h2>
        <div className="text-sm space-y-1">
          <div>
            <span className="font-medium">Protocolo:</span> {protocol.name}
          </div>
          <div>
            <span className="font-medium">Indicação:</span> {protocol.indication}
          </div>
          <div>
            <span className="font-medium">Ciclo:</span> {cycle} de {protocol.cycles}
          </div>
        </div>
      </div>

      {/* Drogas */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Medicações Antineoplásicas</h2>
        <table className="w-full text-sm border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 p-2 text-left">Droga</th>
              <th className="border border-gray-300 p-2 text-left">Dose</th>
              <th className="border border-gray-300 p-2 text-left">Via</th>
              <th className="border border-gray-300 p-2 text-left">Dias</th>
            </tr>
          </thead>
          <tbody>
            {drugs.map((drug, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2">{drug.name}</td>
                <td className="border border-gray-300 p-2 font-medium">
                  {drug.calculatedDose !== undefined
                    ? `${drug.calculatedDose.toFixed(1)} ${drug.doseUnit}`
                    : `${drug.dose} ${drug.doseUnit}`}
                </td>
                <td className="border border-gray-300 p-2">{drug.route}</td>
                <td className="border border-gray-300 p-2">{drug.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Profilaxia Antiemética */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">
          Profilaxia Antiemética (Risco: {antiemetics.risk.toUpperCase()})
        </h2>
        <div className="text-sm space-y-3">
          <div>
            <p className="font-medium mb-1">D1 (Dia da Quimioterapia):</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {antiemetics.day1.map((med, index) => (
                <li key={index}>{med}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">D2-D4:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {antiemetics.days2to4.map((med, index) => (
                <li key={index}>{med}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Resgate (se necessário):</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {antiemetics.rescue.map((med, index) => (
                <li key={index}>{med}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {antiemetics.alerts && antiemetics.alerts.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-300 p-4 rounded">
          <h3 className="text-sm font-semibold mb-2 text-yellow-900">Alertas Importantes:</h3>
          <ul className="text-sm space-y-1">
            {antiemetics.alerts.map((alert, index) => (
              <li key={index} className="text-yellow-800">
                • {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rodapé */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
        <div className="flex justify-between items-end">
          <div>
            <p>
              <strong>Data/Hora:</strong> {formatDate()}
            </p>
            <p>
              <strong>Prescritor:</strong> {prescriberName} - {prescriberCRM}
            </p>
            <p>
              <strong>Sistema:</strong> Calculadora de Prescrição Quimioterápica v4.1
            </p>
          </div>
          <div className="text-right">
            <p className="mb-8">_________________________________</p>
            <p>Assinatura do Prescritor</p>
          </div>
        </div>
        <p className="mt-4 text-center text-gray-500">
          Este documento foi gerado eletronicamente e possui validade com assinatura digital ou física.
        </p>
      </div>
    </div>
  );
}
