import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { TemplateDoseField } from "@shared/clinicalProtocols/templateDoseRevision";
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
  expectedHash: string;
  fields: TemplateDoseField[];
};

/** Mounted only for an explicitly selected active user template; unmount discards all draft state. */
export function TemplateDoseRevisionDialog({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const prepared = trpc.templateDoseRevision.prepare.useQuery(
    { id },
    {
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar doses-padrão</DialogTitle>
          <DialogDescription>
            Cria uma nova versão ativa e arquiva a anterior. Não altera
            prescrições já salvas, documentos originais, decisões clínicas,
            unidades, limites, frequência ou calendário. Revise separadamente a
            dose principal e cada agenda/fase antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        {prepared.isLoading ? (
          <p role="status">Carregando doses do documento atual…</p>
        ) : prepared.error ? (
          <p role="alert" className="text-destructive">
            {prepared.error.message}
          </p>
        ) : prepared.data?.id === id ? (
          <TemplateDoseRevisionForm
            key={`${id}:${prepared.data.expectedHash}`}
            prepared={prepared.data}
            onClose={onClose}
          />
        ) : (
          <p role="alert">Não foi possível preparar esta versão.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateDoseRevisionForm({
  prepared,
  onClose,
}: {
  prepared: PreparedRevision;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [values, setValues] = useState<string[]>(() =>
    prepared.fields.map(f => String(f.dose))
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const clear = () => {
    setValues(prepared.fields.map(f => String(f.dose)));
    setReason("");
    setError("");
  };
  const invalidate = async () => {
    await Promise.all([
      utils.customProtocols.list.invalidate(),
      utils.customProtocols.listActive.invalidate(),
      utils.templateDoseRevision.prepare.invalidate({ id: prepared.id }),
    ]);
  };
  const mutation = trpc.templateDoseRevision.update.useMutation({
    onSuccess: async () => {
      clear();
      onClose();
      toast.success("Nova versão criada; versão anterior arquivada.");
      await invalidate();
    },
    onError: async err => {
      toast.error(`Revisão não salva: ${err.message}`);
      if (
        ["CONFLICT", "NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"].includes(
          err.data?.code ?? ""
        )
      ) {
        clear();
        onClose();
        await invalidate();
      } else setError(err.message);
    },
  });
  const numbers = values.map(value =>
    value.trim() === "" ? NaN : Number(value)
  );
  const validDoses = numbers.every(n => Number.isFinite(n) && n > 0);
  const changes = prepared.fields.flatMap((field, i) =>
    numbers[i] !== field.dose ? [{ path: field.path, dose: numbers[i] }] : []
  );
  const valid =
    validDoses &&
    changes.length > 0 &&
    reason.trim().length > 0 &&
    reason.trim().length <= 2000;
  const submit = () => {
    if (!valid || mutation.isPending) return;
    setError("");
    mutation.mutate({
      id: prepared.id,
      expectedHash: prepared.expectedHash,
      changes,
      reason: reason.trim(),
    });
  };
  return (
    <div className="space-y-4">
      {prepared.fields.length === 0 ? (
        <p>
          Nenhuma dose numérica positiva existente pode ser editada neste
          documento.
        </p>
      ) : (
        <div className="space-y-3">
          {prepared.fields.map((field, index) => (
            <div
              key={JSON.stringify(field.path)}
              className="rounded-md border p-3 space-y-2"
            >
              <Label htmlFor={`template-dose-${index}`}>
                {field.drugName} · {field.unit}
              </Label>
              <p className="text-sm text-muted-foreground">{field.period}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">
                  Atual: {field.dose} {field.unit}
                </span>
                <Input
                  id={`template-dose-${index}`}
                  type="number"
                  step="any"
                  value={values[index]}
                  aria-label={`${field.drugName} · ${field.period} (${field.unit})`}
                  aria-invalid={
                    !Number.isFinite(numbers[index]) || numbers[index] <= 0
                  }
                  disabled={mutation.isPending}
                  className="max-w-48"
                  onChange={event =>
                    setValues(prior =>
                      prior.map((v, i) =>
                        i === index ? event.target.value : v
                      )
                    )
                  }
                />
              </div>
              {field.mirroredPaths.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Espelhos equivalentes serão atualizados juntos.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="template-revision-reason">
          Motivo da revisão (obrigatório)
        </Label>
        <Textarea
          id="template-revision-reason"
          value={reason}
          maxLength={2000}
          disabled={mutation.isPending}
          onChange={event => setReason(event.target.value)}
          placeholder="Justifique a revisão das doses-padrão."
        />
      </div>
      {!validDoses ? (
        <p role="alert" className="text-destructive text-sm">
          Informe apenas doses numéricas finitas maiores que zero. Zero não
          omite medicamentos.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => {
            clear();
            onClose();
          }}
        >
          Cancelar
        </Button>
        <Button disabled={!valid || mutation.isPending} onClick={submit}>
          {mutation.isPending ? "Salvando…" : "Criar nova versão"}
        </Button>
      </DialogFooter>
    </div>
  );
}
