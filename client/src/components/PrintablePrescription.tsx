import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type {
  PatientData,
  Protocol,
  Drug,
  CalculatedValues,
  AntiemeticProphylaxis,
} from "@/types/calculator";
import type {
  HydrationResult,
  ElectrolyteReplacement,
  TransfusionRecommendation,
} from "@/lib/hydrationSupport";
import type { PdfSections } from "./PdfPreviewModal";
import {
  antiemeticPrescriptionOutput,
  drugPrescriptionOutput,
  templatePrescriptionMetadata,
} from "@/lib/pdfGenerator";

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
  hydration?: HydrationResult | null;
  electrolytes?: ElectrolyteReplacement[];
  transfusion?: TransfusionRecommendation[];
  /** Same selection passed by PdfPreviewModal; omitted keeps the legacy print layout. */
  sections?: PdfSections;
}

export default function PrintablePrescription({
  patient,
  calculatedValues,
  protocol,
  cycle,
  drugs,
  antiemetics,
  prescriptionId: savedPrescriptionId,
  institutionName = "Hospital / Clínica",
  institutionLogo,
  prescriberId = "SYSTEM",
  prescriberName = "Médico Responsável",
  prescriberCRM = "CRM XXXXX",
  hydration,
  electrolytes,
  transfusion,
  sections,
}: PrintablePrescriptionProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  // Usar ID do banco se disponível, caso contrário gerar temporário
  const prescriptionId = savedPrescriptionId || `RX-TEMP-${Date.now()}`;
  const metadata = templatePrescriptionMetadata(protocol);
  const selectedCycle = protocol.templateContext?.cycle ?? cycle;
  const anti = antiemeticPrescriptionOutput(
    antiemetics,
    protocol.emetogenicRisk
  );

  useEffect(() => {
    // Gerar QR code com ID da prescrição para rastreabilidade
    const data = JSON.stringify({
      id: prescriptionId,
      patient: patient.name,
      protocol: protocol.name,
      cycle: selectedCycle,
      ...(protocol.templateContext
        ? { templateContext: protocol.templateContext }
        : {}),
      date: new Date().toISOString(),
      saved: !!savedPrescriptionId, // Indica se foi salvo no banco
    });

    QRCode.toDataURL(data, { width: 150, margin: 1 })
      .then(setQrCodeUrl)
      .catch(err => console.error("Erro ao gerar QR code:", err));
  }, [
    prescriptionId,
    patient.name,
    protocol.name,
    selectedCycle,
    protocol.templateContext,
    savedPrescriptionId,
  ]);

  const formatDate = () => {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
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
          <h1 className="text-2xl font-bold text-gray-900">
            {institutionName}
          </h1>
          <p className="text-sm text-gray-600">Prescrição de Quimioterapia</p>
        </div>
        {qrCodeUrl && (
          <div className="text-center">
            <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
            <p className="text-xs text-gray-600 mt-1">
              ID: {prescriptionId.slice(-8)}
            </p>
          </div>
        )}
      </div>

      {metadata.length > 0 && (
        <div className="mb-6 rounded border border-amber-300 p-3 text-sm">
          {metadata.map((line, index) => (
            <p key={index} className={index === 0 ? "font-bold" : ""}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Dados do Paciente */}
      {sections?.patientData !== false && (
        <div className="mb-6 bg-gray-50 p-4 rounded">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">
            Dados do Paciente
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="font-medium">Nome:</span>{" "}
              {patient.name || "Não informado"}
            </div>
            <div>
              <span className="font-medium">Idade:</span> {patient.age} anos
            </div>
            <div>
              <span className="font-medium">Sexo:</span>{" "}
              {patient.sex === "M" ? "Masculino" : "Feminino"}
            </div>
            <div>
              <span className="font-medium">Peso:</span> {patient.weight} kg
            </div>
            <div>
              <span className="font-medium">Altura:</span> {patient.height} cm
            </div>
            {sections?.calculatedValues !== false && (
              <>
                <div>
                  <span className="font-medium">SC:</span>{" "}
                  {calculatedValues.bsa.toFixed(2)} m²
                </div>
                <div>
                  <span className="font-medium">eGFR:</span>{" "}
                  {calculatedValues.egfr.toFixed(0)} mL/min/1.73m²
                </div>
                <div>
                  <span className="font-medium">Status Renal:</span>{" "}
                  <span
                    className={`font-semibold ${
                      calculatedValues.renalStatus === "green"
                        ? "text-green-700"
                        : calculatedValues.renalStatus === "yellow"
                          ? "text-yellow-700"
                          : "text-red-700"
                    }`}
                  >
                    {metadata.length
                      ? "Estimativa renal indexada — não determina ajuste automático"
                      : calculatedValues.renalStatusLabel}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Protocolo */}
      {sections?.protocol !== false && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">
            Protocolo Quimioterápico
          </h2>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Protocolo:</span> {protocol.name}
            </div>
            <div>
              <span className="font-medium">Indicação:</span>{" "}
              {protocol.indication}
            </div>
            <div>
              <span className="font-medium">Ciclo:</span> {selectedCycle} de{" "}
              {protocol.cycles}
            </div>
          </div>
        </div>
      )}

      {/* Drogas */}
      {sections?.drugs !== false && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">
            Medicações Antineoplásicas
          </h2>
          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-2 text-left">Droga</th>
                <th className="border border-gray-300 p-2 text-left">
                  Dose Prescrita
                </th>
                <th className="border border-gray-300 p-2 text-left">Via</th>
                <th className="border border-gray-300 p-2 text-left">Dias</th>
              </tr>
            </thead>
            <tbody>
              {drugs.map((drug, index) => {
                const output = drugPrescriptionOutput(drug, protocol);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-2">
                      {drug.name}
                      {drug.observations && (
                        <p className="mt-1 text-xs">{drug.observations}</p>
                      )}
                      {output.pharmaceutical.map((line, n) => (
                        <p key={n} className="mt-1 text-xs">
                          {line}
                        </p>
                      ))}
                    </td>
                    <td className="border border-gray-300 p-2 font-medium">
                      {output.calculated}
                      {output.details.map((line, n) => (
                        <p key={n} className="mt-1 text-xs font-normal">
                          {line}
                        </p>
                      ))}
                    </td>
                    <td className="border border-gray-300 p-2">{drug.route}</td>
                    <td className="border border-gray-300 p-2">{drug.days}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {[
        {
          key: "specialAlerts" as const,
          title: "Alertas Especiais",
          items: protocol.specialAlerts,
        },
        {
          key: "prophylaxis" as const,
          title: "Profilaxias",
          items: protocol.prophylaxis,
        },
        {
          key: "nursingCare" as const,
          title: "Cuidados de Enfermagem",
          items: protocol.nursingCare,
        },
        {
          key: "doseAdjustments" as const,
          title: "Ajustes de Dose",
          items: [
            ...protocol.renalAdjustments.map(item => `Renal: ${item}`),
            ...protocol.hepaticAdjustments.map(item => `Hepático: ${item}`),
            ...protocol.hematologicAdjustments.map(
              item => `Hematológico: ${item}`
            ),
          ],
        },
      ].map(section =>
        (sections ? sections[section.key] : metadata.length > 0) &&
        section.items.length > 0 ? (
          <div key={section.key} className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">
              {section.title}
            </h2>
            <ul className="list-disc list-inside text-sm space-y-1">
              {section.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}

      {/* Profilaxia Antiemética */}
      {sections?.antiemetics !== false && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">
            Profilaxia Antiemética (Risco {anti.riskLabel})
          </h2>
          <div className="text-sm space-y-3">
            <p>{anti.timeReferenceLine}</p>
            {anti.sections.map(section => (
              <div key={section.key}>
                <p className="font-medium mb-1">{section.label}:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  {section.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {sections?.antiemetics !== false && anti.alerts.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-300 p-4 rounded">
          <h3 className="text-sm font-semibold mb-2 text-yellow-900">
            Alertas antieméticos:
          </h3>
          <ul className="text-sm space-y-1">
            {anti.alerts.map((alert, index) => (
              <li key={index} className="text-yellow-800">
                • {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hidratação */}
      {sections?.hydration !== false &&
        hydration &&
        hydration.protocolType !== "none" &&
        hydration.schemes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">
              💧 Esquema de Hidratação — {hydration.protocolLabel}
            </h2>
            <p className="text-sm mb-2">
              <span className="font-medium">Volume Total:</span>{" "}
              {hydration.totalVolume} mL
            </p>
            {hydration.alerts.length > 0 && (
              <div className="mb-3">
                {hydration.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 mb-1 rounded border-l-4 ${
                      a.type === "danger"
                        ? "bg-red-50 border-red-500 text-red-800"
                        : a.type === "warning"
                          ? "bg-yellow-50 border-yellow-500 text-yellow-800"
                          : "bg-blue-50 border-blue-500 text-blue-800"
                    }`}
                  >
                    <strong>
                      {a.type === "danger"
                        ? "PERIGO"
                        : a.type === "warning"
                          ? "ATENÇÃO"
                          : "INFO"}
                      :
                    </strong>{" "}
                    {a.message}
                  </div>
                ))}
              </div>
            )}
            {hydration.schemes.map((s, i) => (
              <div
                key={i}
                className={`mb-2 p-3 rounded border-l-4 bg-gray-50 ${
                  s.phase === "pre"
                    ? "border-blue-500"
                    : s.phase === "concurrent"
                      ? "border-purple-500"
                      : "border-green-500"
                }`}
              >
                <p className="font-medium text-sm mb-1">{s.phaseLabel}</p>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Solução:</span> {s.solution}
                  </div>
                  <div>
                    <span className="font-medium">Volume:</span> {s.volume} mL
                  </div>
                  <div>
                    <span className="font-medium">Velocidade:</span> {s.rate}{" "}
                    mL/h
                  </div>
                  <div>
                    <span className="font-medium">Duração:</span> {s.duration}h
                  </div>
                </div>
                {s.additives && s.additives.length > 0 && (
                  <p className="text-xs mt-1">
                    <span className="font-medium">Aditivos:</span>{" "}
                    {s.additives.join(", ")}
                  </p>
                )}
                {s.notes && s.notes.length > 0 && (
                  <p className="text-xs mt-1 text-gray-600">
                    <span className="font-medium">Notas:</span>{" "}
                    {s.notes.join("; ")}
                  </p>
                )}
              </div>
            ))}
            {hydration.monitoring.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Monitorização:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
                  {hydration.monitoring.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      {/* Eletrólitos */}
      {sections?.electrolytes !== false &&
        electrolytes &&
        electrolytes.filter(e => e.status !== "normal").length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">
              ⚡ Reposição de Eletrólitos
            </h2>
            {electrolytes
              .filter(e => e.status !== "normal")
              .map((e, idx) => (
                <div key={idx} className="mb-3 p-3 border rounded bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{e.electrolyte}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        e.status === "critical"
                          ? "bg-red-100 text-red-800"
                          : e.status === "low"
                            ? "bg-yellow-100 text-yellow-800"
                            : e.status === "high"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {e.statusLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <span className="font-medium">Valor Atual:</span>{" "}
                      {e.currentValue} {e.unit}
                    </div>
                    <div>
                      <span className="font-medium">Faixa Normal:</span>{" "}
                      {e.normalRange}
                    </div>
                  </div>
                  {e.alerts.length > 0 &&
                    e.alerts.map((a, ai) => (
                      <div
                        key={ai}
                        className="text-xs p-1.5 mb-1 bg-red-50 border-l-2 border-red-400 text-red-700"
                      >
                        {a}
                      </div>
                    ))}
                  {e.replacements.length > 0 && (
                    <table className="w-full text-xs border-collapse border border-gray-200 mt-2">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-200 p-1 text-left">
                            Solução
                          </th>
                          <th className="border border-gray-200 p-1 text-left">
                            Dose
                          </th>
                          <th className="border border-gray-200 p-1 text-left">
                            Via
                          </th>
                          <th className="border border-gray-200 p-1 text-left">
                            Velocidade
                          </th>
                          <th className="border border-gray-200 p-1 text-left">
                            Duração
                          </th>
                          <th className="border border-gray-200 p-1 text-left">
                            Frequência
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.replacements.map((r, ri) => (
                          <tr key={ri}>
                            <td className="border border-gray-200 p-1">
                              {r.solution}
                            </td>
                            <td className="border border-gray-200 p-1 font-medium">
                              {r.dose}
                            </td>
                            <td className="border border-gray-200 p-1">
                              {r.route}
                            </td>
                            <td className="border border-gray-200 p-1">
                              {r.rate}
                            </td>
                            <td className="border border-gray-200 p-1">
                              {r.duration}
                            </td>
                            <td className="border border-gray-200 p-1">
                              {r.frequency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {e.monitoring.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-medium">Monitorização:</p>
                      <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
                        {e.monitoring.map((m, mi) => (
                          <li key={mi}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

      {/* Transfusão */}
      {sections?.transfusion !== false &&
        transfusion &&
        transfusion.filter(t => t.indicated).length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">
              🩸 Suporte Transfusional
            </h2>
            {transfusion
              .filter(t => t.indicated)
              .map((t, idx) => (
                <div
                  key={idx}
                  className={`mb-3 p-3 rounded border-l-4 bg-gray-50 ${
                    t.urgency === "immediate"
                      ? "border-red-500"
                      : "border-yellow-500"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{t.productLabel}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        t.urgency === "immediate"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {t.urgencyLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <span className="font-medium">Valor Atual:</span>{" "}
                      {t.currentValue} {t.unit}
                    </div>
                    <div>
                      <span className="font-medium">Threshold:</span>{" "}
                      {t.threshold} {t.unit}
                    </div>
                    <div>
                      <span className="font-medium">Volume:</span> {t.volume}
                    </div>
                    <div>
                      <span className="font-medium">Incremento Esperado:</span>{" "}
                      {t.expectedIncrement}
                    </div>
                  </div>
                  {t.specialRequirements.length > 0 && (
                    <div className="mb-1">
                      <p className="text-xs font-medium">
                        Requisitos Especiais:
                      </p>
                      <ul className="list-disc list-inside text-xs ml-2">
                        {t.specialRequirements.map((r, ri) => (
                          <li key={ri}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {t.premedication.length > 0 && (
                    <div className="mb-1">
                      <p className="text-xs font-medium">Pré-Medicação:</p>
                      <ul className="list-disc list-inside text-xs ml-2">
                        {t.premedication.map((p, pi) => (
                          <li key={pi}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {t.alerts.length > 0 &&
                    t.alerts.map((a, ai) => (
                      <div
                        key={ai}
                        className="text-xs p-1.5 mb-1 bg-red-50 border-l-2 border-red-400 text-red-700"
                      >
                        {a}
                      </div>
                    ))}
                  {t.monitoring.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-medium">Monitorização:</p>
                      <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
                        {t.monitoring.map((m, mi) => (
                          <li key={mi}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
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
              <strong>Sistema:</strong> Calculadora de Prescrição Quimioterápica
              v4.1
            </p>
          </div>
          <div className="text-right">
            <p className="mb-8">_________________________________</p>
            <p>Assinatura do Prescritor</p>
          </div>
        </div>
        <p className="mt-4 text-center text-gray-500">
          Este documento foi gerado eletronicamente e possui validade com
          assinatura digital ou física.
        </p>
      </div>
    </div>
  );
}
