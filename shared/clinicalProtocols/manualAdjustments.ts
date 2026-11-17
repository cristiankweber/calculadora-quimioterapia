import type { ResolvedClinicalProtocol } from "./types";
import { clinicalRowKey } from "./resolver";
import { mapResolvedTemplateDrugs } from "./templates";

export interface TemplateDoseOverride {
  rowKey: string;
  finalDose: number;
  reason: string;
}

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** All-or-nothing adjustments to an already complete, executable selection, not a release gate. */
export function applyTemplateManualAdjustments(
  resolution: ResolvedClinicalProtocol,
  overrides: TemplateDoseOverride[]
): { drugs: ReturnType<typeof mapResolvedTemplateDrugs>; issues: string[] } {
  const baseline = mapResolvedTemplateDrugs(resolution);
  const issues: string[] = [];
  if (!baseline.length)
    issues.push("Seleção completa não está pronta para ajuste manual.");
  const keys = new Set<string>();
  for (const row of resolution.rows) {
    if (
      typeof row.rowKey !== "string" ||
      !row.rowKey.trim() ||
      keys.has(row.rowKey) ||
      (row.rowIdentity && clinicalRowKey(row.rowIdentity) !== row.rowKey)
    )
      issues.push("Identidade de etapa ausente, adulterada ou duplicada.");
    else keys.add(row.rowKey);
  }
  if (!Array.isArray(overrides))
    return { drugs: [], issues: [...issues, "Lista de ajustes inválida."] };
  const readyKeys = new Set(baseline.map(drug => drug.rowKey));
  const byKey = new Map<string, TemplateDoseOverride>();
  for (const override of overrides) {
    if (
      !override ||
      typeof override.rowKey !== "string" ||
      !readyKeys.has(override.rowKey)
    ) {
      issues.push(
        "Ajuste órfão: rowKey não corresponde a uma etapa pronta da seleção."
      );
      continue;
    }
    if (byKey.has(override.rowKey))
      issues.push("Ajustes duplicados para a mesma etapa.");
    if (!positive(override.finalDose))
      issues.push("Dose final manual deve ser finita e positiva.");
    if (
      typeof override.reason !== "string" ||
      !override.reason.trim() ||
      override.reason.trim().length > 1000
    )
      issues.push(
        "Motivo do ajuste obrigatório, com no máximo 1000 caracteres."
      );
    const expected = baseline.find(drug => drug.rowKey === override.rowKey)!;
    if (expected.maxDose !== undefined && override.finalDose > expected.maxDose)
      issues.push("Dose final manual excede o máximo armazenado no documento.");
    byKey.set(override.rowKey, override);
  }
  if (issues.length) return { drugs: [], issues: Array.from(new Set(issues)) };
  const drugs = baseline.map(drug => {
    const override = byKey.get(drug.rowKey);
    const finalDose = override?.finalDose ?? drug.calculatedDose;
    const isManualDose = finalDose !== drug.calculatedDose;
    const prescribedDailyDose =
      drug.dailyDose === null
        ? null
        : finalDose === drug.calculatedDose
          ? drug.dailyDose
          : finalDose * (drug.dailyDose / drug.calculatedDose);
    if (prescribedDailyDose !== null && !positive(prescribedDailyDose))
      issues.push(
        "Dose diária prescrita não é finita e positiva; ajuste bloqueado."
      );
    return {
      ...drug,
      finalDose,
      prescribedDailyDose,
      isManualDose,
      adjustmentReason: isManualDose ? override?.reason.trim() : undefined,
    };
  });
  return {
    drugs: issues.length ? [] : drugs,
    issues: Array.from(new Set(issues)),
  };
}
