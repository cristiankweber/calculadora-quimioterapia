import * as React from "react";
import { useId, useState } from "react";
import { projectTemplateAntiemetics } from "@shared/clinicalProtocols/antiemetics";
import {
  getTemplateExecutionDocument,
  getTemplatePrescriptionIssues,
  isActiveTemplateDocument,
} from "@shared/clinicalProtocols/templates";
import type {
  ClinicalContext,
  ClinicalProtocolDocument,
  ResolvedClinicalProtocol as ClinicalResolution,
} from "@shared/clinicalProtocols/types";
import type { TemplateDoseOverride } from "@shared/clinicalProtocols/manualAdjustments";
import type { Drug } from "@/types/calculator";
import TemplateDoseAdjustmentEditor from "./TemplateDoseAdjustmentEditor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSearch, ShieldAlert } from "lucide-react";

export interface ClinicalProtocolPanelProps {
  document: ClinicalProtocolDocument;
  resolution: ClinicalResolution;
  context: ClinicalContext;
  onContextChange: (next: ClinicalContext) => void;
  packageData?: Record<string, unknown>;
  doseEditing?: {
    scopeKey: string;
    drugs: Drug[];
    onConfirm: (override: TemplateDoseOverride) => string[];
    onRestore: (rowKey: string) => void;
  };
}

type ResolvedRow = ClinicalResolution["rows"][number];

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Imported clinical extensions stay text, never React children or executable markup. */
function text(value: unknown, fallback = "Não informado"): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  try {
    return JSON.stringify(value, null, 2) ?? fallback;
  } catch {
    return "Valor não serializável; revisar documento de origem";
  }
}

function items(value: unknown): unknown[] {
  return value === undefined || value === null
    ? []
    : Array.isArray(value)
      ? value
      : [value];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function doseText(value: unknown, unit: unknown, suffix = ""): string {
  return isFiniteNumber(value)
    ? `${value.toLocaleString("pt-BR", { maximumSignificantDigits: 21 })} ${text(unit, "unidade não informada")}${suffix}`
    : "Não calculada";
}

const fieldLabels: Record<string, string> = {
  sourceId: "Fonte",
  sourcePages: "Páginas",
  selectedOn: "Data de seleção",
  scheduleAuthority: "Autoridade do calendário",
  requiresInstitutionalApproval: "Requer aprovação institucional",
  drugName: "Medicamento",
  drugId: "Identificador",
  validationStatus: "Status de validação",
  diluent: "Diluente",
  volume: "Volume",
  infusionTime: "Tempo de infusão",
  stability: "Estabilidade específica",
  specialInstructions: "Instruções específicas",
  administrationDurationMinutes: "Duração em minutos",
  status: "Status",
  reviewedOn: "Data de revisão",
  requiresMedicalApproval: "Requer aprovação médica",
  requiresPharmacyApproval: "Requer aprovação farmacêutica",
  calculatorIntegrationTested: "Integração testada",
  scheduleStatus: "Status do calendário",
  unresolvedItems: "Pendências",
  scope: "Escopo",
  type: "Tipo de fonte",
  accessedOn: "Data de acesso",
  accessStatus: "Status de acesso",
  note: "Nota",
  support: "Suporte da fase",
};

function ProvidedValue({
  value,
  empty = "Não informado no documento",
}: {
  value: unknown;
  empty?: string;
}) {
  if (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2 text-sm">
        {value.map((entry, index) => (
          <li key={index} className="min-w-0 rounded-md border bg-muted/20 p-3">
            <ProvidedValue value={entry} />
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(record(value));
  if (entries.length > 0) {
    return (
      <dl className="space-y-2 text-sm">
        {entries.map(([key, entry]) => (
          <div
            key={key}
            className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]"
          >
            <dt className="font-medium text-muted-foreground">
              {fieldLabels[key] ?? key}
            </dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {text(entry)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
      {text(value)}
    </p>
  );
}

function DataSection({
  title,
  value,
  empty,
}: {
  title: string;
  value: unknown;
  empty?: string;
}) {
  return (
    <section
      aria-label={title}
      className="min-w-0 space-y-3 rounded-xl border p-4"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <ProvidedValue value={value} empty={empty} />
    </section>
  );
}

const originLabels: Record<string, string> = {
  cycle_day_one: "Dia do ciclo",
  cycle_start: "Dia do ciclo",
  treatment_start: "Dia do tratamento",
  treatment_day_one: "Dia do tratamento",
  phase_day_one: "Dia da fase",
  transplant_day_zero: "Dia relativo ao D0",
  induction_day_one: "Dia relativo à indução",
};

function timeOrigins(
  rows: ResolvedRow[],
  phase: Record<string, unknown>,
  doc: Record<string, unknown>
): string[] {
  const explicit = rows.map(row => text(row.timeOrigin, "")).filter(Boolean);
  if (explicit.length === 0) {
    for (const drug of items(phase.drugs)) {
      for (const schedule of items(record(drug).schedule)) {
        const origin = record(schedule).timeOrigin;
        if (typeof origin === "string" && origin) explicit.push(origin);
      }
    }
  }
  if (explicit.length > 0) return Array.from(new Set(explicit));
  const kind = record(doc.cycleDefinition).kind;
  if (kind === "transplant_relative_calendar") return ["transplant_day_zero"];
  if (kind === "continuous_treatment") return ["treatment_start"];
  if (items(doc.phaseLibrary).length > 0) return [];
  return ["cycle_day_one"];
}

function safeReferenceUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function Sources({
  sources,
  references,
}: {
  sources: unknown;
  references: unknown;
}) {
  const index = new Map<string, Record<string, unknown>>();
  if (Array.isArray(references)) {
    for (const reference of references) {
      const entry = record(reference);
      if (typeof entry.id === "string") index.set(entry.id, entry);
    }
  } else {
    for (const [id, reference] of Object.entries(record(references)))
      index.set(id, record(reference));
  }
  const sourceItems = items(sources);
  return (
    <section
      aria-label="Fontes"
      className="min-w-0 space-y-3 rounded-xl border p-4"
    >
      <h3 className="text-sm font-semibold">Fontes</h3>
      {sourceItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Fontes não informadas no documento.
        </p>
      ) : (
        <ul className="space-y-3">
          {sourceItems.map((source, position) => {
            const sourceRecord = record(source);
            const id =
              typeof source === "string"
                ? source
                : text(sourceRecord.id ?? sourceRecord.sourceId, "");
            const reference = index.get(id) ?? sourceRecord;
            const url = safeReferenceUrl(reference.url);
            return (
              <li
                key={`${id}-${position}`}
                className="min-w-0 space-y-1 text-sm"
              >
                <p className="break-words [overflow-wrap:anywhere]">
                  <span className="font-medium">
                    {id || "Fonte fornecida"} ·{" "}
                  </span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                      title={`Consultar fonte ${text(reference.title, id)}`}
                    >
                      {text(reference.title, id)}
                    </a>
                  ) : (
                    text(reference.title, id || text(source))
                  )}
                </p>
                {Object.keys(reference).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Referência não resolvida no pacote; revisar identificador.
                  </p>
                ) : (
                  <ProvidedValue
                    value={Object.fromEntries(
                      Object.entries(reference).filter(
                        ([key]) => !["id", "title"].includes(key)
                      )
                    )}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DoseGroup({
  title,
  rows,
  status,
  isTemplate = false,
  doseEditing,
}: {
  title: string;
  rows: ResolvedRow[];
  status: ResolvedRow["status"];
  isTemplate?: boolean;
  doseEditing?: ClinicalProtocolPanelProps["doseEditing"];
}) {
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const prescribedByKey = new Map(
    doseEditing?.drugs.map(drug => [drug.rowKey, drug]) ?? []
  );
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className="min-w-0 space-y-3">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {title}
        <Badge variant={status === "blocked" ? "destructive" : "secondary"}>
          {rows.length} item(ns)
        </Badge>
      </h3>
      <div
        className="max-w-full overflow-x-auto rounded-xl border"
        role="region"
        aria-label={`Tabela: ${title}`}
        tabIndex={0}
      >
        <table className="w-full min-w-[880px] text-left text-sm">
          <caption className="sr-only">
            {title}.{" "}
            {isTemplate
              ? "Template do usuário; validar antes de administrar."
              : "Resultados de referência, não liberados para administração."}
          </caption>
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {[
                "Medicamento / procedimento",
                "Base informada",
                "Dose calculada por aplicação",
                ...(doseEditing ? ["Dose prescrita por aplicação"] : []),
                "Total diário / 24h",
                "Frequência / duração",
                "Período e origem temporal",
              ].map(heading => (
                <th key={heading} scope="col" className="p-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const source = record(row.source);
              const frequency: Record<string, unknown> = {
                ...record(source.administrationFrequency),
                ...(row.doseRepresents !== undefined
                  ? { doseRepresents: row.doseRepresents }
                  : {}),
                ...(row.continuousInfusion !== undefined
                  ? { continuousInfusion: row.continuousInfusion }
                  : {}),
              };
              const continuous = frequency.continuousInfusion === true;
              const totalInfusion =
                frequency.doseRepresents === "total_for_this_infusion";
              const dailyDivided =
                frequency.doseRepresents === "per_24_hours" &&
                !continuous &&
                isFiniteNumber(row.frequency) &&
                row.frequency > 1;
              const unavailable =
                status === "not_scheduled" ? "Não programada" : "Não calculada";
              const canDisplay = status === "ready";
              const prescribed = prescribedByKey.get(row.rowKey);
              const finalDose =
                prescribed?.finalDose === undefined
                  ? row.calculatedDose
                  : prescribed.finalDose;
              const dailyDose =
                prescribed?.prescribedDailyDose === undefined
                  ? row.dailyDose
                  : prescribed.prescribedDailyDose;
              const rowKey = row.rowKey;
              const adjusted = finalDose !== row.calculatedDose;
              return (
                <tr
                  key={row.rowKey ?? `${text(source.id, "row")}-${index}`}
                  className="border-b align-top last:border-0"
                >
                  <th
                    scope="row"
                    className="max-w-[260px] space-y-2 p-3 font-normal"
                  >
                    <p className="font-semibold">
                      {text(source.name, "Item sem nome")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Via: {text(source.route)}
                    </p>
                    {source.observations ? (
                      <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {text(source.observations)}
                      </p>
                    ) : null}
                    {row.issues.length > 0 ? (
                      <ul className="space-y-1 text-xs text-destructive">
                        {row.issues.map((issue, n) => (
                          <li key={n}>{text(issue)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </th>
                  <td className="p-3">
                    {canDisplay
                      ? doseText(row.dose, row.doseUnit ?? source.doseUnit)
                      : unavailable}
                  </td>
                  <td className="p-3">
                    <p
                      className={
                        canDisplay
                          ? "font-semibold text-primary"
                          : "font-medium text-muted-foreground"
                      }
                    >
                      {canDisplay
                        ? doseText(row.calculatedDose, row.resultUnit)
                        : unavailable}
                    </p>
                    {canDisplay && totalInfusion ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Total desta infusão, não taxa horária
                      </p>
                    ) : canDisplay && continuous ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Total de 24h / infusão, não taxa horária
                      </p>
                    ) : null}
                    {canDisplay && dailyDivided ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Total de 24h dividido nas aplicações indicadas
                      </p>
                    ) : null}
                  </td>
                  {doseEditing ? (
                    <td className="min-w-[260px] space-y-2 p-3">
                      <p className="font-semibold text-primary">
                        {doseText(finalDose, row.resultUnit)}
                      </p>
                      {adjusted ? (
                        <p className="text-xs">
                          Ajuste manual — motivo:{" "}
                          {prescribed?.adjustmentReason || "não registrado"}
                        </p>
                      ) : null}
                      {rowKey ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingRowKey(rowKey)}
                          >
                            Ajustar dose
                          </Button>
                          {adjusted ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                doseEditing.onRestore(rowKey);
                                setEditingRowKey(null);
                              }}
                            >
                              Restaurar dose calculada
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {rowKey &&
                      editingRowKey === rowKey &&
                      isFiniteNumber(row.calculatedDose) &&
                      isFiniteNumber(finalDose) ? (
                        <TemplateDoseAdjustmentEditor
                          rowKey={rowKey}
                          name={text(source.name)}
                          baseline={row.calculatedDose}
                          finalDose={finalDose}
                          unit={row.resultUnit}
                          doseRepresents={row.doseRepresents}
                          continuousInfusion={row.continuousInfusion}
                          maxDose={
                            prescribed?.maxDose ??
                            (isFiniteNumber(source.maxDose)
                              ? source.maxDose
                              : undefined)
                          }
                          onConfirm={doseEditing.onConfirm}
                          onCancel={() => setEditingRowKey(null)}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="p-3">
                    {canDisplay
                      ? totalInfusion && dailyDose === null
                        ? "Não definido para esta infusão"
                        : doseText(dailyDose, row.resultUnit, "/24h")
                      : unavailable}
                  </td>
                  <td className="space-y-1 p-3">
                    <p>
                      {continuous
                        ? "Infusão contínua"
                        : isFiniteNumber(row.frequency) && row.frequency > 0
                          ? `${row.frequency} ${row.frequency === 1 ? "administração" : "administrações"}/24h`
                          : "Frequência não definida"}
                    </p>
                    {isFiniteNumber(frequency.intervalHours) ? (
                      <p className="text-xs text-muted-foreground">
                        Intervalo: {frequency.intervalHours} h
                      </p>
                    ) : null}
                    {isFiniteNumber(source.administrationDurationMinutes) ? (
                      <p className="text-xs text-muted-foreground">
                        Duração: {source.administrationDurationMinutes} min
                      </p>
                    ) : null}
                    {frequency.doseRepresents ? (
                      <p className="text-xs text-muted-foreground">
                        Definição da dose: {text(frequency.doseRepresents)}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[240px] space-y-1 p-3">
                    <p className="break-words">
                      {text(row.days, "Período não resolvido")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {originLabels[row.timeOrigin] ??
                        "Origem temporal a revisar"}{" "}
                      · {text(row.timeOrigin)}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Baseline display stays controlled; optional individual overrides never edit the registered document. */
export default function ClinicalProtocolPanel({
  document,
  resolution,
  context,
  onContextChange,
  packageData,
  doseEditing,
}: ClinicalProtocolPanelProps) {
  const id = useId();
  const doc = record(document);
  const isTemplate = isActiveTemplateDocument(document);
  const execution = isTemplate
    ? getTemplateExecutionDocument(document)
    : document;
  const original = record(doc.sourceDocument ?? document);
  const review = record(doc.review);
  const pharmacy = Object.prototype.hasOwnProperty.call(doc, "dilutionInfo")
    ? doc.dilutionInfo
    : original.dilutionInfo;
  const antiemetics = projectTemplateAntiemetics(doc);
  const phases = items(execution.phaseLibrary)
    .map(record)
    .filter(phase => typeof phase.id === "string" && phase.id !== "");
  const selectedPhase = phases.find(phase => phase.id === context.phaseId);
  const phaseRequired = phases.length > 0;
  const missingPhase = phaseRequired && !selectedPhase;
  const hasAuc =
    isTemplate &&
    [
      ...items(execution.drugs),
      ...phases.flatMap(phase => items(phase.drugs)),
      ...resolution.rows.map(row => row.source),
    ].some(drug => {
      const entry = record(drug);
      return (
        entry.doseUnit === "AUC" ||
        items(entry.schedule).some(
          schedule => record(schedule).doseUnit === "AUC"
        )
      );
    });
  const origins = timeOrigins(
    resolution.rows,
    selectedPhase ?? {},
    record(execution)
  );
  const dayLabel =
    origins.length === 1
      ? (originLabels[origins[0]] ?? "Dia do calendário")
      : "Dia do calendário";
  const ambiguousDay =
    origins.length > 1 || (origins.length === 1 && !originLabels[origins[0]]);
  const version =
    doc.sourceVersion ??
    record(packageData?.metadata).sourceVersion ??
    record(packageData?.sourceEnvelope).version ??
    packageData?.sourceVersion ??
    packageData?.version ??
    doc.version;
  const issues = [...items(review.unresolvedItems), ...resolution.issues];
  const ready = missingPhase
    ? []
    : resolution.rows.filter(row => row.status === "ready");
  const blocked = missingPhase
    ? []
    : resolution.rows.filter(row => row.status === "blocked");
  const notScheduled = missingPhase
    ? []
    : resolution.rows.filter(row => row.status === "not_scheduled");
  const editable =
    isTemplate &&
    !missingPhase &&
    getTemplatePrescriptionIssues(document, context, resolution).length === 0;
  const coveredKeys = new Set([
    "name",
    "id",
    "indication",
    "version",
    "sources",
    "review",
    "selectedVariant",
    "baselineTests",
    "monitoring",
    "essentialSupportOrders",
    "dilutionInfo",
    "drugs",
  ]);
  const decisions = Object.fromEntries(
    Object.entries(doc).filter(([key]) => !coveredKeys.has(key))
  );

  return (
    <Card
      className="min-w-0 max-w-full overflow-hidden border-primary/15 shadow-sm"
      aria-labelledby={`${id}-title`}
    >
      <CardHeader className="min-w-0 border-b bg-primary/5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isTemplate ? "secondary" : "destructive"}>
            {isTemplate
              ? "Template do usuário — validar antes de administrar"
              : "Rascunho bloqueado"}
          </Badge>
          <Badge variant="outline">
            {execution.referenceOnly === true
              ? "Somente consulta"
              : isTemplate
                ? "Revisão da seleção"
                : "Simulação para revisão"}
          </Badge>
          <span className="break-words text-xs text-muted-foreground">
            Versão: {text(version, "não informada no pacote")}
          </span>
        </div>
        <CardTitle>
          <h2
            id={`${id}-title`}
            className="flex items-start gap-2 text-lg leading-snug"
          >
            <FileSearch
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">
              {text(doc.name, "Documento clínico")}
            </span>
          </h2>
        </CardTitle>
        <CardDescription className="whitespace-pre-wrap break-words">
          {text(doc.indication, "Biblioteca clínica para consulta técnica")}
        </CardDescription>
        <p className="break-words text-xs text-muted-foreground">
          {isTemplate ? "Status técnico da revisão" : "Status da revisão"}:{" "}
          {text(review.status, "não informado")} ·{" "}
          {text(doc.id, "sem identificador")}
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-6 pt-2">
        <Alert
          variant={isTemplate ? "default" : "destructive"}
          className={
            isTemplate
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }
        >
          <ShieldAlert aria-hidden="true" />
          <AlertTitle className="whitespace-normal">
            {isTemplate
              ? "Template do usuário — validar antes de administrar"
              : "Documento não homologado para prescrição"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {isTemplate
                ? "Template gerenciado pelo usuário: não equivale a homologação institucional. Revisar seleção, calendário, doses e dados farmacêuticos antes de administrar. Pendências técnicas concretas permanecem; nenhuma alternativa é escolhida automaticamente."
                : "Cálculos disponíveis são simulações para revisão médica e farmacêutica. Não autorizam preparo, administração ou reinício de ciclo. O bloqueio de prescrição é permanente neste painel."}
            </p>
          </AlertDescription>
        </Alert>
        <section
          aria-label={
            isTemplate ? "Contexto da seleção" : "Contexto da simulação"
          }
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold">
            {isTemplate ? "Contexto da seleção" : "Contexto da simulação"}
          </h3>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-cycle`}>Ciclo numérico</Label>
              <Input
                id={`${id}-cycle`}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                title="Número do ciclo para simulação"
                aria-describedby={`${id}-cycle-help`}
                value={context.cycle}
                onChange={event => {
                  const next = event.currentTarget.valueAsNumber;
                  if (Number.isInteger(next) && next >= 1)
                    onContextChange({
                      ...context,
                      cycle: next,
                      day: undefined,
                    });
                }}
              />
              <p
                id={`${id}-cycle-help`}
                className="text-xs text-muted-foreground"
              >
                Sem programação artificial de 999 ciclos. Cobertura e limites
                são verificados pelo calendário.
              </p>
            </div>
            {phaseRequired ? (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${id}-phase`}>Fase obrigatória</Label>
                <Select
                  value={selectedPhase ? context.phaseId : ""}
                  onValueChange={phaseId =>
                    onContextChange({ ...context, phaseId, day: undefined })
                  }
                >
                  <SelectTrigger
                    id={`${id}-phase`}
                    title="Selecionar explicitamente a fase clínica"
                    aria-required="true"
                    aria-invalid={missingPhase}
                    aria-describedby={`${id}-phase-help`}
                  >
                    <SelectValue placeholder="Selecione uma fase">
                      {selectedPhase
                        ? text(selectedPhase.name, text(selectedPhase.id))
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map(phase => (
                      <SelectItem
                        key={String(phase.id)}
                        value={String(phase.id)}
                      >
                        {text(phase.name, String(phase.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p
                  id={`${id}-phase-help`}
                  className="text-xs text-muted-foreground"
                >
                  Nenhuma fase é escolhida automaticamente; alternativas não são
                  somadas.
                </p>
              </div>
            ) : null}
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-day`}>{dayLabel} (opcional)</Label>
              <Input
                id={`${id}-day`}
                type="number"
                step={1}
                title="Dia para consulta do calendário; vazio mostra o período completo"
                value={context.day ?? ""}
                disabled={missingPhase || ambiguousDay}
                aria-describedby={`${id}-day-help`}
                onChange={event => {
                  const value = event.currentTarget.value;
                  const next = event.currentTarget.valueAsNumber;
                  if (value === "" || Number.isInteger(next))
                    onContextChange({
                      ...context,
                      day: value === "" ? undefined : next,
                    });
                }}
              />
              <p
                id={`${id}-day-help`}
                className="break-words text-xs text-muted-foreground"
              >
                {ambiguousDay
                  ? "Origens distintas ou não reconhecidas: revisar calendário antes de filtrar um dia."
                  : "Vazio: consultar o período completo. Dias negativos e D0 são aceitos quando previstos no calendário."}
                {origins.length > 0
                  ? ` Origem: ${origins.join(", ")}.`
                  : " Selecione a fase para definir a origem temporal."}
              </p>
            </div>
            {hasAuc ? (
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${id}-gfr`}>
                  GFR absoluto para Calvert (mL/min)
                </Label>
                <Input
                  id={`${id}-gfr`}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  title="GFR absoluto explicitamente selecionado para Calvert; não usar eGFR indexado"
                  aria-describedby={`${id}-gfr-help`}
                  value={context.gfrForCalvert ?? ""}
                  onChange={event => {
                    const value = event.currentTarget.value;
                    const next = event.currentTarget.valueAsNumber;
                    if (value === "" || (Number.isFinite(next) && next > 0))
                      onContextChange({
                        ...context,
                        gfrForCalvert: value === "" ? undefined : next,
                      });
                  }}
                />
                <p
                  id={`${id}-gfr-help`}
                  className="text-xs text-muted-foreground"
                >
                  Opcional para consulta; necessário para calcular AUC. Informar
                  GFR absoluto selecionado pelo prescritor; não preencher a
                  partir do eGFR indexado.
                </p>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Duração resolvida do ciclo:{" "}
            {isFiniteNumber(resolution.cycleLength)
              ? `${resolution.cycleLength} dias`
              : "não definida; depende de contexto e revisão"}
            . Não equivale a autorização do próximo ciclo.
          </p>
          <p className="break-words text-xs text-muted-foreground">
            Parâmetros recebidos: SC {text(context.bsa)} m² · peso{" "}
            {text(context.weight)} kg · eGFR {text(context.egfr)} mL/min/1,73 m²
            · GFR para Calvert {text(context.gfrForCalvert)} mL/min. Sem ajustes
            inferidos neste painel.
          </p>
        </section>
        {missingPhase ? (
          <Alert variant="destructive">
            <AlertTitle className="whitespace-normal">
              Fase obrigatória: selecione uma fase
            </AlertTitle>
            <AlertDescription>
              As doses ficam ocultas até uma seleção explícita válida. O painel
              não concatena medicamentos de fases alternativas.
            </AlertDescription>
          </Alert>
        ) : null}
        {issues.length > 0 ? (
          <>
            <DataSection
              title="Pendências de revisão e cálculo"
              value={issues}
            />
            {isTemplate ? (
              <p className="text-sm text-muted-foreground">
                Revisar o JSON completo para decisões de fase, nível, idade,
                alternativas ou suporte não resolvidas; nenhuma dose ou escolha
                é presumida.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isTemplate
              ? "Nenhuma pendência adicional informada. Isso não substitui revisão médica e farmacêutica antes de administrar."
              : "Nenhuma pendência adicional informada. Isso não homologa o documento nem libera a prescrição."}
          </p>
        )}
        {execution.referenceOnly === true ? (
          <p className="text-sm text-muted-foreground">
            Somente consulta: documento referencial, sem liberação de doses.
          </p>
        ) : (
          <>
            <DoseGroup
              key={doseEditing?.scopeKey ?? "read-only"}
              title={
                isTemplate
                  ? "Doses resolvidas para revisão"
                  : "Doses disponíveis para simulação"
              }
              rows={ready}
              status="ready"
              isTemplate={isTemplate}
              doseEditing={editable ? doseEditing : undefined}
            />
            <DoseGroup
              title="Doses bloqueadas"
              rows={blocked}
              status="blocked"
            />
            <DoseGroup
              title="Não programadas"
              rows={notScheduled}
              status="not_scheduled"
            />
          </>
        )}
        {!missingPhase &&
        (resolution.rows.length === 0 || execution.referenceOnly === true) ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma dose resolvida para esta seleção. O documento permanece
            disponível para consulta.
          </p>
        ) : null}
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <DataSection title="Exames basais" value={doc.baselineTests} />
          <DataSection title="Monitorização" value={doc.monitoring} />
          <DataSection
            title="Suporte essencial para revisão"
            value={doc.essentialSupportOrders}
          />
          <DataSection
            title="Profilaxias Obrigatórias/Recomendadas"
            value={doc.prophylaxis}
          />
          <DataSection title="Cuidados de Enfermagem" value={doc.nursingCare} />
          <DataSection title="Alertas do protocolo" value={doc.specialAlerts} />
          <DataSection
            title="Orientações de ajustes renais"
            value={doc.renalAdjustments}
          />
          <DataSection
            title="Orientações de ajustes hepáticos"
            value={doc.hepaticAdjustments}
          />
          <DataSection
            title="Orientações de ajustes hematológicos"
            value={doc.hematologicAdjustments}
          />
          <DataSection
            title="Variante selecionada"
            value={doc.selectedVariant}
            empty="Variante não informada no documento; nenhuma alternativa escolhida pelo painel."
          />
        </div>
        <section
          aria-label="Antieméticos cadastrados"
          className="min-w-0 space-y-3 rounded-xl border p-4"
        >
          <h3 className="text-sm font-semibold">Antieméticos cadastrados</h3>
          <p className="text-sm text-muted-foreground">
            Referência temporal:{" "}
            {antiemetics.timeReference ||
              "não informada — conferir antes de prescrever"}
            . Os rótulos não são convertidos automaticamente para dias do
            transplante.
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <div>
              <h4 className="text-sm font-medium">Dia 1 / Pré-QT</h4>
              <ProvidedValue
                value={antiemetics.day1}
                empty="Não informado — cadastrar e conferir com o prescritor."
              />
            </div>
            <div>
              <h4 className="text-sm font-medium">Dias seguintes (2–4)</h4>
              <ProvidedValue
                value={antiemetics.days2to4}
                empty="Não informado — cadastrar e conferir com o prescritor."
              />
            </div>
            <div>
              <h4 className="text-sm font-medium">Medicações de resgate</h4>
              <ProvidedValue
                value={antiemetics.rescue}
                empty="Não informado — cadastrar e conferir com o prescritor."
              />
            </div>
          </div>
          <ProvidedValue
            value={antiemetics.alerts}
            empty="Sem notas adicionais cadastradas."
          />
        </section>
        {selectedPhase && selectedPhase.support !== undefined ? (
          <DataSection
            title="Suporte fornecido da fase selecionada"
            value={selectedPhase.support}
          />
        ) : null}
        <DataSection
          title="Informações farmacêuticas fornecidas"
          value={pharmacy}
          empty="Dados farmacêuticos não fornecidos. Validar produto, diluente, concentração, estabilidade e liberação com a farmácia; nenhum parâmetro universal foi aplicado."
        />
        {isTemplate
          ? items(pharmacy).map((entry, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {text(record(entry).drugName, "Item farmacêutico")} · Status
                farmacêutico:{" "}
                {text(
                  record(entry).validationStatus ?? record(entry).status,
                  "não informado"
                )}
              </p>
            ))
          : null}
        <p className="text-xs text-muted-foreground">
          Informações farmacêuticas reproduzidas do documento, dependentes de
          produto e validação específica. Não constituem relatório de preparo
          nem prescrição de suporte.
        </p>
        <Sources sources={doc.sources} references={packageData?.references} />
        <details className="min-w-0 rounded-xl border p-4">
          <summary
            className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            title="Consultar decisões avançadas preservadas do documento"
          >
            Decisões de fase, dose e suporte
          </summary>
          <div className="min-w-0 pt-4">
            <ProvidedValue value={decisions} />
            <DataSection title="Dados da revisão" value={doc.review} />
          </div>
        </details>
        <details className="min-w-0 rounded-xl border p-4">
          <summary
            className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            title="Consultar JSON original completo para revisão, não prescrição"
          >
            Documento completo · JSON para revisão
          </summary>
          <pre className="mt-4 max-h-[32rem] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-xs [overflow-wrap:anywhere]">
            {text(document)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
