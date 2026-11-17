import { useMemo, useRef, useState } from "react";
import type { ResolvedClinicalProtocol } from "@shared/clinicalProtocols/types";
import {
  applyTemplateManualAdjustments,
  type TemplateDoseOverride,
} from "@shared/clinicalProtocols/manualAdjustments";
import type { Drug } from "@/types/calculator";

interface AdjustmentContext {
  /** Includes session/user, patient, complete document revision and all calculation inputs. */
  scopeKey: string;
  resolution: ResolvedClinicalProtocol | null;
  enabled: boolean;
}

/** No effect-based invalidation: an old adjustment is never exposed in a new render. */
export function useTemplateDoseAdjustments({
  scopeKey,
  resolution,
  enabled,
}: AdjustmentContext) {
  const key = JSON.stringify([scopeKey, resolution, enabled]);
  const live = useRef({
    key,
    revision: 0,
    overrides: [] as TemplateDoseOverride[],
  });
  const [stored, setStored] = useState(() => ({
    key,
    overrides: [] as TemplateDoseOverride[],
  }));
  if (live.current.key !== key) {
    live.current = { key, revision: live.current.revision + 1, overrides: [] };
  }
  if (stored.key !== key) setStored({ key, overrides: [] });
  const overrides =
    enabled && stored.key === key ? stored.overrides : live.current.overrides;
  const revision = live.current.revision;
  const application = useMemo(
    () =>
      resolution
        ? applyTemplateManualAdjustments(resolution, overrides)
        : { drugs: [], issues: [] },
    [resolution, overrides]
  );

  const confirm = (override: TemplateDoseOverride): string[] => {
    if (
      !enabled ||
      !resolution ||
      live.current.key !== key ||
      live.current.revision !== revision
    )
      return ["Contexto do ajuste mudou; revise a seleção atual."];
    const next = [
      ...live.current.overrides.filter(item => item.rowKey !== override.rowKey),
      override,
    ];
    const checked = applyTemplateManualAdjustments(resolution, next);
    if (checked.issues.length) return checked.issues;
    // Restoring the baseline is not an audit override, even when explicitly confirmed.
    const actual = next.filter(item =>
      checked.drugs.some(
        drug => drug.rowKey === item.rowKey && drug.isManualDose
      )
    );
    live.current.overrides = actual;
    setStored({ key, overrides: actual });
    return [];
  };
  const restore = (rowKey: string) => {
    if (
      !enabled ||
      live.current.key !== key ||
      live.current.revision !== revision
    )
      return;
    const next = live.current.overrides.filter(item => item.rowKey !== rowKey);
    live.current.overrides = next;
    setStored({ key, overrides: next });
  };

  return {
    scopeKey: key,
    drugs: application.drugs as Drug[],
    issues: application.issues,
    overrides,
    confirm,
    restore,
  };
}

/** Support consumes the declared base, scaled by final/baseline, not an absolute dose mislabeled as mg/kg. */
export function buildTemplateSupportDrugs(
  resolution: ResolvedClinicalProtocol,
  drugs: Drug[]
) {
  const prescribedByKey = new Map(drugs.map(drug => [drug.rowKey, drug]));
  return resolution.rows
    .filter(row => row.status === "ready")
    .map(row => {
      const drug = prescribedByKey.get(row.rowKey);
      const baseline = row.calculatedDose;
      const final = drug?.finalDose === undefined ? baseline : drug.finalDose;
      const ratio =
        typeof baseline === "number" &&
        baseline > 0 &&
        Number.isFinite(baseline) &&
        typeof final === "number" &&
        final > 0 &&
        Number.isFinite(final)
          ? final / baseline
          : 1;
      return {
        name: row.source.name,
        dose: (row.dose ?? 0) * ratio,
        doseUnit: row.doseUnit ?? row.source.doseUnit,
        administrationsPerDay:
          row.doseRepresents === "per_24_hours" ||
          row.doseRepresents === "total_for_this_infusion" ||
          row.continuousInfusion
            ? 1
            : (row.frequency ?? undefined),
      };
    });
}
