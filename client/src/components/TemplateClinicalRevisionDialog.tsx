import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { TemplateClinicalField } from "@shared/clinicalProtocols/templateClinicalRevision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PreparedRevision = {
  id: number;
  name: string;
  expectedHash: string;
  fields: TemplateClinicalField[];
};
type SavedRevision = { id: number; protocolId: string };
type EditorProps = {
  onClose: () => void;
  onSaved?: (result: SavedRevision) => void | Promise<void>;
};
type DraftValue = string | string[];
type ClinicalEditValue = string | number | boolean | string[] | number[] | null;
function isClinicalEditValue(value: unknown): value is ClinicalEditValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) &&
      (value.every(item => typeof item === "string") ||
        value.every(item => typeof item === "number" && Number.isFinite(item))))
  );
}
const sections: Array<{
  key: TemplateClinicalField["section"];
  label: string;
}> = [
  { key: "general", label: "Informações gerais" },
  { key: "drugs", label: "Medicamentos, doses e fases" },
  { key: "administration", label: "Diluição e administração" },
  { key: "prophylaxis", label: "Profilaxias" },
  { key: "antiemetics", label: "Antieméticos e referência temporal" },
  { key: "nursing", label: "Cuidados de enfermagem" },
  { key: "alerts", label: "Alertas" },
  { key: "adjustments", label: "Ajustes renal, hepático e hematológico" },
];
function initialDraft(field: TemplateClinicalField): DraftValue {
  if (field.kind === "textList")
    return Array.isArray(field.value) ? field.value.map(String) : [];
  if (field.kind === "days" && Array.isArray(field.value))
    return field.value.join(", ");
  return field.value == null ? "" : String(field.value);
}
function parseDraft(
  field: TemplateClinicalField,
  draft: DraftValue
): { value: unknown; error?: string } {
  if (field.kind === "textList") {
    const items = Array.isArray(draft) ? draft : [draft];
    if (items.some(item => !item.trim()))
      return { value: items, error: "Preencha ou remova os itens vazios." };
    return { value: items };
  }
  const text = String(draft);
  if (field.kind === "number") {
    if (!text.trim() && field.nullable) return { value: null };
    const number = text.trim() ? Number(text) : NaN;
    if (!Number.isFinite(number))
      return { value: null, error: "Informe um número finito." };
    if (typeof field.value === "number" && field.value > 0 && number <= 0)
      return {
        value: number,
        error:
          "Este valor deve ser maior que zero. Zero não omite medicamentos.",
      };
    return { value: number };
  }
  if (field.kind === "days" && Array.isArray(field.value)) {
    if (!text.trim())
      return { value: [], error: "Informe ao menos um dia inteiro." };
    const tokens = text.split(/[;,\n]/).map(token => token.trim());
    if (
      tokens.some(
        token => !/^-?\d+$/.test(token) || !Number.isSafeInteger(Number(token))
      )
    )
      return {
        value: null,
        error:
          "Use apenas dias inteiros separados por vírgulas; não use intervalos neste campo estruturado.",
      };
    const days = tokens.map(Number);
    if (new Set(days).size !== days.length)
      return { value: days, error: "Não repita dias na lista estruturada." };
    return { value: days };
  }
  if (field.kind === "select") {
    if (!text && field.nullable) return { value: null };
    if (field.options && !field.options.some(option => option.value === text))
      return { value: text, error: "Selecione uma opção válida." };
    if (typeof field.value === "boolean") return { value: text === "true" };
    if (typeof field.value === "number") return { value: Number(text) };
  }
  return { value: !text && field.nullable ? null : text };
}
function displayValue(value: unknown): string {
  if (value === undefined) return "Não informado (ausente)";
  if (value === null) return "Não informado (nulo)";
  if (Array.isArray(value))
    return value.length ? value.join("; ") : "Lista vazia";
  return String(value) || "Texto vazio";
}

/** Mounted only when a specific template is selected; unmounting discards its local draft. */
export function TemplateClinicalRevisionDialog({
  id,
  onClose,
  onSaved,
}: { id: number } & EditorProps) {
  const [pending, setPending] = useState(false);
  const prepared = trpc.templateClinicalRevision.prepare.useQuery(
    { id },
    {
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="w-[calc(100%-1rem)] sm:max-w-5xl max-h-[90dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
        showCloseButton={!pending}
        onEscapeKeyDown={event => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Editar protocolo completo</DialogTitle>
          <DialogDescription>
            Revise os campos clínicos disponíveis e confira as alterações antes
            de criar uma nova versão ativa. A versão anterior será arquivada;
            prescrições já salvas não serão alteradas.
          </DialogDescription>
        </DialogHeader>
        {prepared.isLoading ? (
          <p role="status">Carregando o documento clínico atual…</p>
        ) : prepared.error ? (
          <div className="space-y-3">
            <p role="alert" className="text-destructive">
              {prepared.error.message}
            </p>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : prepared.data?.id === id ? (
          <TemplateClinicalRevisionForm
            key={`${id}:${prepared.data.expectedHash}`}
            prepared={prepared.data}
            onClose={onClose}
            onSaved={onSaved}
            onPendingChange={setPending}
          />
        ) : (
          <p role="alert">Não foi possível preparar esta versão.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Real form shared by the manager and dialog, independently of the portal boundary. */
export function TemplateClinicalRevisionForm({
  prepared,
  onClose,
  onSaved,
  onPendingChange,
}: {
  prepared: PreparedRevision;
  onPendingChange?: (pending: boolean) => void;
} & EditorProps) {
  const utils = trpc.useUtils();
  const [values, setValues] = useState<DraftValue[]>(() =>
    prepared.fields.map(initialDraft)
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const clear = () => {
    setValues(prepared.fields.map(initialDraft));
    setReason("");
    setError("");
  };
  const invalidate = () =>
    Promise.all([
      utils.customProtocols.list.invalidate(),
      utils.customProtocols.listActive.invalidate(),
      utils.templateClinicalRevision.prepare.invalidate({ id: prepared.id }),
    ]);
  const mutation = trpc.templateClinicalRevision.update.useMutation({
    onSuccess: async result => {
      setFinalizing(true);
      clear();
      try {
        await invalidate();
        if (onSaved) await onSaved(result);
        toast.success("Nova versão criada; versão anterior arquivada.");
        onClose();
      } catch {
        toast.error(
          "A versão foi salva, mas não foi possível atualizar a seleção. Reabra a lista de protocolos."
        );
        onClose();
      } finally {
        setFinalizing(false);
      }
    },
    onError: async err => {
      const code = err.data?.code ?? "";
      if (
        ["CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)
      ) {
        toast.error(
          `Revisão não salva. O rascunho foi descartado; reabra a versão atual. ${err.message}`
        );
        clear();
        onClose();
        await invalidate();
      } else {
        setError(err.message);
        toast.error(`Revisão não salva: ${err.message}`);
      }
    },
  });
  const pending = mutation.isPending || finalizing;
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  const evaluated = prepared.fields.map((field, index) => {
    // Unchanged missing/null values remain absent/null; opening the editor never normalizes the document.
    if (JSON.stringify(values[index]) === JSON.stringify(initialDraft(field)))
      return { value: field.value };
    return parseDraft(field, values[index]);
  });
  const changes = prepared.fields.flatMap((field, index) =>
    JSON.stringify(evaluated[index].value) !== JSON.stringify(field.value)
      ? [{ path: field.path, value: evaluated[index].value }]
      : []
  );
  const hasAntiemeticOrders = prepared.fields.some(
    (field, index) =>
      field.section === "antiemetics" &&
      ["day1", "days2to4", "rescue"].includes(field.path.at(-1) ?? "") &&
      Array.isArray(evaluated[index].value) &&
      (evaluated[index].value as unknown[]).length > 0
  );
  const timeReferenceIndex = prepared.fields.findIndex(
    field =>
      field.section === "antiemetics" && field.path.at(-1) === "timeReference"
  );
  const missingTimeReference =
    hasAntiemeticOrders &&
    (timeReferenceIndex < 0 ||
      !String(evaluated[timeReferenceIndex].value ?? "").trim());
  const invalidFields = evaluated.some(value => value.error);
  const valid =
    !invalidFields &&
    !missingTimeReference &&
    changes.length > 0 &&
    reason.trim().length > 0 &&
    reason.trim().length <= 2000;
  const update = (index: number, value: DraftValue) => {
    setValues(prior => prior.map((old, i) => (i === index ? value : old)));
    setError("");
  };
  const submit = () => {
    if (!valid || pending) return;
    setError("");
    const submittedChanges = changes.flatMap(change =>
      isClinicalEditValue(change.value)
        ? [{ path: change.path, value: change.value }]
        : []
    );
    if (submittedChanges.length !== changes.length) {
      setError(
        "Uma alteração tem formato inválido. Reabra o documento atual antes de salvar."
      );
      return;
    }
    mutation.mutate({
      id: prepared.id,
      expectedHash: prepared.expectedHash,
      changes: submittedChanges,
      reason: reason.trim(),
    });
  };
  return (
    <div className="min-w-0 space-y-4">
      <section
        aria-label="Metadados protegidos"
        className="rounded-md border bg-muted/40 p-3 text-sm space-y-1 break-words"
      >
        <h3 className="font-semibold">Metadados protegidos</h3>
        <p>
          {prepared.name} · Registro #{prepared.id}
        </p>
        <p>
          Fontes, identidade, histórico de revisão e dados não listados
          permanecem preservados. Calendários, fases, decisões condicionais e
          frequência só mudam nos campos explicitamente exibidos abaixo; resumos
          diários são derivados, não texto manual.
        </p>
        <p>
          Este editor não gera recomendações clínicas. A revisão e a validação
          institucional do conteúdo são responsabilidade da equipe.
        </p>
      </section>
      <fieldset
        disabled={pending}
        className="min-w-0 space-y-4"
        aria-busy={pending}
      >
        {sections.map(section => {
          const indices = prepared.fields.flatMap((field, i) =>
            field.section === section.key ? [i] : []
          );
          if (!indices.length) return null;
          return (
            <details
              key={section.key}
              open
              className="min-w-0 rounded-md border"
            >
              <summary className="cursor-pointer px-3 py-3 font-semibold text-sm focus-visible:outline-primary">
                {section.label}{" "}
                <span className="font-normal text-muted-foreground">
                  ({indices.length})
                </span>
              </summary>
              <div className="min-w-0 space-y-4 border-t p-3">
                {section.key === "antiemetics" ? (
                  <p className="text-sm text-muted-foreground">
                    A classificação de risco emetogênico não define
                    automaticamente a prescrição. Confira cada ordem existente e
                    sua referência temporal (dia do ciclo ou dia de
                    quimioterapia); nenhum medicamento é sugerido ou incluído
                    pelo editor.
                  </p>
                ) : null}
                {indices.map(index => {
                  const field = prepared.fields[index];
                  const inputId = `clinical-field-${index}`;
                  const fieldError = evaluated[index].error;
                  const common = {
                    id: inputId,
                    "aria-label": field.label,
                    "aria-invalid": !!fieldError,
                    "aria-describedby": fieldError
                      ? `${inputId}-error`
                      : undefined,
                    disabled: pending,
                    className: "w-full min-w-0",
                  };
                  return (
                    <div
                      key={JSON.stringify(field.path)}
                      className="min-w-0 space-y-2"
                    >
                      <Label
                        htmlFor={inputId}
                        className="block leading-relaxed break-words"
                      >
                        {field.label}
                      </Label>
                      {field.kind === "textList" ? (
                        <div className="space-y-2">
                          {(values[index] as string[]).map(
                            (item, itemIndex) => (
                              <div
                                key={itemIndex}
                                className="flex min-w-0 items-start gap-2"
                              >
                                <Textarea
                                  aria-label={`${field.label} · item ${itemIndex + 1}`}
                                  rows={2}
                                  className="min-w-0 flex-1"
                                  value={item}
                                  disabled={pending}
                                  onChange={event =>
                                    update(
                                      index,
                                      (values[index] as string[]).map(
                                        (old, i) =>
                                          i === itemIndex
                                            ? event.target.value
                                            : old
                                      )
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  aria-label={`Remover item ${itemIndex + 1} de ${field.label}`}
                                  onClick={() =>
                                    update(
                                      index,
                                      (values[index] as string[]).filter(
                                        (_, i) => i !== itemIndex
                                      )
                                    )
                                  }
                                >
                                  <span className="sr-only">
                                    Remover item {itemIndex + 1} de{" "}
                                    {field.label}
                                  </span>
                                  <span aria-hidden>×</span>
                                </Button>
                              </div>
                            )
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-w-full h-auto whitespace-normal text-left"
                            disabled={pending}
                            onClick={() =>
                              update(index, [
                                ...(values[index] as string[]),
                                "",
                              ])
                            }
                          >
                            Adicionar item em {field.label}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Cada item é independente. Enter insere uma nova
                            linha no mesmo item; use Adicionar item para criar
                            outra entrada.
                          </p>
                        </div>
                      ) : field.kind === "select" ? (
                        <select
                          {...common}
                          className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                          value={String(values[index])}
                          onChange={event => update(index, event.target.value)}
                        >
                          {field.nullable || field.value == null ? (
                            <option value="">Não informado</option>
                          ) : null}
                          {field.value != null &&
                          !field.options?.some(
                            option => option.value === String(field.value)
                          ) ? (
                            <option value={String(field.value)}>
                              {String(field.value)} (valor atual)
                            </option>
                          ) : null}
                          {field.options?.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.kind === "number" ? (
                        <Input
                          {...common}
                          type="number"
                          step="any"
                          value={String(values[index])}
                          onChange={event => update(index, event.target.value)}
                        />
                      ) : field.kind === "text" &&
                        [
                          "name",
                          "route",
                          "doseUnit",
                          "diluent",
                          "volume",
                          "infusionTime",
                          "status",
                          "validationStatus",
                          "timeReference",
                        ].includes(field.path.at(-1) ?? "") ? (
                        <Input
                          {...common}
                          value={String(values[index])}
                          onChange={event => update(index, event.target.value)}
                        />
                      ) : (
                        <Textarea
                          {...common}
                          rows={field.kind === "days" ? 2 : 3}
                          value={String(values[index])}
                          onChange={event => update(index, event.target.value)}
                        />
                      )}
                      {field.kind === "days" ? (
                        <p className="text-xs text-muted-foreground">
                          {Array.isArray(field.value)
                            ? "Agenda estruturada para cálculo: dias inteiros separados por vírgulas, inclusive dias negativos. A lista é preservada como array; confira a origem temporal da fase."
                            : "Dias descritivos (texto do documento): mantenha a expressão dos dias. Alterar este texto não substitui automaticamente a agenda estruturada usada no cálculo."}
                        </p>
                      ) : null}
                      {field.kind === "number" && field.nullable ? (
                        <p className="text-xs text-muted-foreground">
                          Deixe vazio para retirar explicitamente este valor
                          opcional (nulo).
                        </p>
                      ) : null}
                      {field.mirroredPaths.length ? (
                        <p className="text-xs text-muted-foreground">
                          Campos equivalentes serão atualizados juntos pelo
                          servidor.
                        </p>
                      ) : null}
                      {fieldError ? (
                        <p
                          id={`${inputId}-error`}
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {fieldError}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
        {!prepared.fields.length ? (
          <p>Nenhum campo editável disponível nesta versão.</p>
        ) : null}
        <section
          aria-label="Prévia das alterações"
          className="rounded-md border p-3 space-y-2 min-w-0"
        >
          <h3 className="font-semibold">Prévia das alterações</h3>
          <p role="status" className="text-sm">
            {changes.length}{" "}
            {changes.length === 1 ? "campo alterado" : "campos alterados"}
          </p>
          {!changes.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma alteração. Campos não alterados serão preservados.
            </p>
          ) : (
            <ul className="space-y-3 text-sm max-h-60 overflow-y-auto">
              {prepared.fields.map((field, index) =>
                JSON.stringify(evaluated[index].value) !==
                JSON.stringify(field.value) ? (
                  <li key={index} className="min-w-0 break-words">
                    <strong>{field.label}</strong>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      Antes: {displayValue(field.value)}
                    </p>
                    <p className="whitespace-pre-wrap">
                      Depois: {displayValue(evaluated[index].value)}
                    </p>
                  </li>
                ) : null
              )}
            </ul>
          )}
        </section>
        <div className="space-y-2">
          <Label htmlFor="clinical-revision-reason">
            Motivo da revisão (obrigatório)
          </Label>
          <Textarea
            id="clinical-revision-reason"
            aria-label="Motivo da revisão"
            value={reason}
            maxLength={2000}
            disabled={pending}
            onChange={event => setReason(event.target.value)}
            placeholder="Registre a justificativa desta revisão institucional."
          />
          <p className="text-xs text-muted-foreground">
            A confirmação cria uma nova versão ativa e arquiva a anterior; não
            altera prescrições já salvas.
          </p>
        </div>
        {missingTimeReference ? (
          <p role="alert" className="text-sm text-destructive">
            Informe a referência temporal dos antieméticos antes de salvar
            ordens: dia do ciclo ou dia de quimioterapia, conforme o documento.
          </p>
        ) : null}
      </fieldset>
      {error ? (
        <p role="alert" className="text-destructive break-words">
          {error}
        </p>
      ) : null}
      <DialogFooter className="sticky bottom-0 border-t bg-background pt-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            clear();
            onClose();
          }}
        >
          Cancelar
        </Button>
        <Button type="button" disabled={!valid || pending} onClick={submit}>
          {pending ? "Salvando…" : "Criar nova versão"}
        </Button>
      </DialogFooter>
    </div>
  );
}
