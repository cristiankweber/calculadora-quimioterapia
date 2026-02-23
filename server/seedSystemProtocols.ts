/**
 * Módulo para popular o banco com os protocolos do sistema.
 * Converte os protocolos do data/protocols.ts para o formato custom_protocols.
 * Pode ser chamado via endpoint tRPC (admin) ou diretamente.
 */

import type { InsertCustomProtocol } from "../drizzle/schema";

// Interface que espelha o Protocol do frontend
interface SourceDrug {
  name: string;
  dose: number;
  doseUnit: string;
  maxDose?: number;
  calculatedDose?: number;
  route: string;
  days: string;
  observations?: string;
  emetogenicRisk?: string;
  renalAdjustment?: string;
  hepaticAdjustment?: string;
}

interface SourceProtocol {
  id: string;
  name: string;
  indication: string;
  cycles: number;
  cycleLength: number;
  drugs: SourceDrug[];
  renalAdjustments: string[];
  hepaticAdjustments: string[];
  hematologicAdjustments: string[];
  prophylaxis: string[];
  nursingCare: string[];
  specialAlerts: string[];
  emetogenicRisk: string;
}

/**
 * Converte um protocolo fonte (frontend) para o formato InsertCustomProtocol.
 */
export function convertProtocolToDbRecord(
  protocol: SourceProtocol,
  userId: number
): InsertCustomProtocol {
  // Limpar drogas removendo calculatedDose e campos vazios
  const drugs = protocol.drugs.map((d) => ({
    name: d.name,
    dose: d.dose,
    doseUnit: d.doseUnit as any,
    ...(d.maxDose ? { maxDose: d.maxDose } : {}),
    route: d.route,
    days: d.days,
    ...(d.observations ? { observations: d.observations } : {}),
    ...(d.emetogenicRisk ? { emetogenicRisk: d.emetogenicRisk } : {}),
    ...(d.renalAdjustment ? { renalAdjustment: d.renalAdjustment } : {}),
    ...(d.hepaticAdjustment ? { hepaticAdjustment: d.hepaticAdjustment } : {}),
  }));

  return {
    userId,
    protocolId: `system-${protocol.id}`,
    name: protocol.name,
    indication: protocol.indication,
    cycles: protocol.cycles,
    cycleLength: protocol.cycleLength,
    emetogenicRisk: protocol.emetogenicRisk as any,
    drugs: drugs as any,
    specialAlerts: protocol.specialAlerts || [],
    prophylaxis: protocol.prophylaxis || [],
    nursingCare: protocol.nursingCare || [],
    renalAdjustments: protocol.renalAdjustments || [],
    hepaticAdjustments: protocol.hepaticAdjustments || [],
    hematologicAdjustments: protocol.hematologicAdjustments || [],
    dilutionInfo: [],
    isActive: 1,
    isSystem: 1,
  };
}

/**
 * Converte todos os protocolos fonte para registros de banco.
 */
export function convertAllProtocols(
  protocols: SourceProtocol[],
  userId: number
): InsertCustomProtocol[] {
  return protocols.map((p) => convertProtocolToDbRecord(p, userId));
}

/**
 * Formato de exportação JSON para compartilhamento de protocolos.
 */
export interface ProtocolExportFormat {
  version: "1.0";
  exportedAt: string;
  exportedBy?: string;
  protocols: Array<{
    name: string;
    indication: string;
    cycles: number;
    cycleLength: number;
    emetogenicRisk: string;
    drugs: Array<{
      name: string;
      dose: number;
      doseUnit: string;
      maxDose?: number;
      route: string;
      days: string;
      observations?: string;
      emetogenicRisk?: string;
      renalAdjustment?: string;
      hepaticAdjustment?: string;
    }>;
    specialAlerts?: string[];
    prophylaxis?: string[];
    nursingCare?: string[];
    renalAdjustments?: string[];
    hepaticAdjustments?: string[];
    hematologicAdjustments?: string[];
    dilutionInfo?: Array<{
      drugName: string;
      diluent: string;
      volume: string;
      infusionTime: string;
      stability: string;
      specialInstructions: string;
    }>;
  }>;
}

/**
 * Valida o formato de importação JSON.
 * Retorna erros encontrados ou array vazio se válido.
 */
export function validateImportFormat(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    errors.push("Formato inválido: esperado um objeto JSON.");
    return errors;
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== "1.0") {
    errors.push(`Versão não suportada: ${obj.version}. Esperado: 1.0`);
  }

  if (!Array.isArray(obj.protocols)) {
    errors.push("Campo 'protocols' deve ser um array.");
    return errors;
  }

  const protocols = obj.protocols as any[];
  if (protocols.length === 0) {
    errors.push("Nenhum protocolo encontrado no arquivo.");
    return errors;
  }

  const validDoseUnits = ["mg/m²", "mg/kg", "mg", "AUC", "mcg/kg", "cGy"];
  const validRisks = ["high", "moderate", "low", "minimal"];

  protocols.forEach((p, i) => {
    const prefix = `Protocolo ${i + 1}`;
    if (!p.name || typeof p.name !== "string") {
      errors.push(`${prefix}: nome é obrigatório.`);
    }
    if (!p.indication || typeof p.indication !== "string") {
      errors.push(`${prefix}: indicação é obrigatória.`);
    }
    if (!Array.isArray(p.drugs) || p.drugs.length === 0) {
      errors.push(`${prefix}: pelo menos uma droga é obrigatória.`);
    } else {
      p.drugs.forEach((d: any, j: number) => {
        if (!d.name) errors.push(`${prefix}, Droga ${j + 1}: nome é obrigatório.`);
        if (typeof d.dose !== "number" || d.dose < 0) {
          errors.push(`${prefix}, Droga ${j + 1}: dose deve ser um número >= 0.`);
        }
        if (!validDoseUnits.includes(d.doseUnit)) {
          errors.push(`${prefix}, Droga ${j + 1}: unidade de dose inválida: ${d.doseUnit}`);
        }
        if (!d.route) errors.push(`${prefix}, Droga ${j + 1}: via é obrigatória.`);
        if (!d.days) errors.push(`${prefix}, Droga ${j + 1}: dias é obrigatório.`);
      });
    }
    if (p.emetogenicRisk && !validRisks.includes(p.emetogenicRisk)) {
      errors.push(`${prefix}: risco emetogênico inválido: ${p.emetogenicRisk}`);
    }
  });

  return errors;
}

/**
 * Converte dados de importação JSON para registros de banco.
 */
export function convertImportToDbRecords(
  data: ProtocolExportFormat,
  userId: number
): InsertCustomProtocol[] {
  return data.protocols.map((p) => {
    const slug = p.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const protocolId = `imported-${slug}-${Date.now().toString(36)}`;

    return {
      userId,
      protocolId,
      name: p.name,
      indication: p.indication,
      cycles: p.cycles || 1,
      cycleLength: p.cycleLength || 21,
      emetogenicRisk: (p.emetogenicRisk || "moderate") as any,
      drugs: p.drugs as any,
      specialAlerts: p.specialAlerts || [],
      prophylaxis: p.prophylaxis || [],
      nursingCare: p.nursingCare || [],
      renalAdjustments: p.renalAdjustments || [],
      hepaticAdjustments: p.hepaticAdjustments || [],
      hematologicAdjustments: p.hematologicAdjustments || [],
      dilutionInfo: p.dilutionInfo || [],
      isActive: 1,
      isSystem: 0,
    };
  });
}
