import * as React from "react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDoseQuantity } from "@/lib/pdfGenerator";
import type { TemplateDoseOverride } from "@shared/clinicalProtocols/manualAdjustments";

interface Props {
  rowKey: string;
  name: string;
  baseline: number;
  finalDose: number;
  unit: string;
  doseRepresents?: string;
  continuousInfusion?: boolean;
  maxDose?: number;
  onConfirm: (override: TemplateDoseOverride) => string[];
  onCancel: () => void;
}

export default function TemplateDoseAdjustmentEditor({
  rowKey,
  name,
  baseline,
  finalDose,
  unit,
  doseRepresents,
  continuousInfusion,
  maxDose,
  onConfirm,
  onCancel,
}: Props) {
  const id = useId();
  const [mode, setMode] = useState<"absolute" | "percentage">("absolute");
  const [quantity, setQuantity] = useState(String(finalDose));
  const [reason, setReason] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const numeric = Number(quantity.replace(",", "."));
  // Divide the percentage first: preserve small representable amounts without decimal-place rounding.
  const proposed = mode === "percentage" ? baseline * (numeric / 100) : numeric;
  const valid =
    quantity.trim() !== "" &&
    Number.isFinite(proposed) &&
    proposed > 0 &&
    reason.trim().length > 0 &&
    reason.trim().length <= 1000 &&
    (maxDose === undefined || proposed <= maxDose);
  const quantityDefinition =
    doseRepresents === "total_for_this_infusion"
      ? "total desta infusão (não taxa horária)"
      : continuousInfusion
        ? "total de 24h da infusão (não taxa horária)"
        : "por aplicação";

  return (
    <section
      aria-label={`Ajuste individual de ${name}`}
      className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3 text-sm"
    >
      <p className="font-semibold">Ajuste individual: {name}</p>
      <p>
        Dose calculada: {formatDoseQuantity(baseline)} {unit} —{" "}
        {quantityDefinition}. O protocolo cadastrado não será alterado.
      </p>
      <div className="space-y-1">
        <Label htmlFor={`${id}-mode`}>Forma do ajuste</Label>
        <select
          id={`${id}-mode`}
          className="w-full rounded border bg-background p-2"
          value={mode}
          onChange={event => {
            const next = event.currentTarget.value as "absolute" | "percentage";
            setMode(next);
            setQuantity(
              next === "percentage"
                ? String((finalDose / baseline) * 100)
                : String(finalDose)
            );
            setIssues([]);
          }}
        >
          <option value="absolute">Dose absoluta — {quantityDefinition}</option>
          <option value="percentage">Percentual da dose calculada</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-quantity`}>
          {mode === "percentage"
            ? "Percentual da dose calculada (%)"
            : `Dose absoluta (${unit}) — ${quantityDefinition}`}
        </Label>
        <Input
          id={`${id}-quantity`}
          aria-label={
            mode === "percentage"
              ? "Percentual da dose calculada"
              : "Dose absoluta por aplicação"
          }
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={event => {
            setQuantity(event.currentTarget.value);
            setIssues([]);
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-reason`}>Motivo do ajuste (obrigatório)</Label>
        <textarea
          id={`${id}-reason`}
          className="w-full rounded border bg-background p-2"
          value={reason}
          maxLength={1000}
          onChange={event => {
            setReason(event.currentTarget.value);
            setIssues([]);
          }}
        />
      </div>
      <p aria-live="polite">
        Dose prescrita proposta:{" "}
        {Number.isFinite(proposed) && proposed > 0
          ? `${formatDoseQuantity(proposed)} ${unit}`
          : "informe uma dose finita e positiva"}{" "}
        — {quantityDefinition}.
      </p>
      {maxDose !== undefined && (
        <p>
          Máximo absoluto do documento: {formatDoseQuantity(maxDose)} {unit}.
        </p>
      )}
      {Number.isFinite(proposed) &&
        maxDose !== undefined &&
        proposed > maxDose && (
          <p role="alert">
            Dose proposta excede o máximo absoluto do documento.
          </p>
        )}
      {issues.length > 0 && <p role="alert">{issues.join("; ")}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            const result = onConfirm({
              rowKey,
              finalDose: proposed,
              reason: reason.trim(),
            });
            if (result.length) setIssues(result);
            else onCancel();
          }}
        >
          Confirmar ajuste
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}
