import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  History,
  Calendar,
  Pill,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { readPrescriptionHistory } from "@/hooks/prescriptionHistoryAdapter";
import { formatDoseQuantity } from "@/lib/pdfGenerator";

interface PatientPrescriptionHistoryProps {
  patientId: number;
  patientName: string;
}

export default function PatientPrescriptionHistory({
  patientId,
  patientName,
}: PatientPrescriptionHistoryProps) {
  const [open, setOpen] = useState(false);

  // Buscar prescrições do paciente
  const { data: prescriptions = [], isLoading } =
    trpc.prescriptions.getByPatient.useQuery({ patientId }, { enabled: open });

  // Ordenar por data (mais recente primeiro)
  const sortedPrescriptions = [...prescriptions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <History className="h-4 w-4 mr-2" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Prescrições</DialogTitle>
          <DialogDescription>
            Todas as prescrições de {patientName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : sortedPrescriptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma prescrição registrada para este paciente
          </div>
        ) : (
          <div className="space-y-4">
            {/* Timeline */}
            <div className="relative">
              {/* Linha vertical da timeline */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              {sortedPrescriptions.map((prescription, index) => {
                const prescriptionData = readPrescriptionHistory(
                  prescription.prescriptionData
                );
                const isFirst = index === 0;

                return (
                  <div key={prescription.id} className="relative pl-12 pb-8">
                    {/* Ponto da timeline */}
                    <div
                      className={`absolute left-2.5 w-3 h-3 rounded-full ${
                        isFirst ? "bg-primary" : "bg-muted-foreground"
                      }`}
                    />

                    <Card className={isFirst ? "border-primary" : ""}>
                      <CardContent className="pt-6">
                        {/* Header do card */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">
                                {prescription.protocolName}
                              </h3>
                              {isFirst && (
                                <Badge variant="default">Mais recente</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  prescription.createdAt
                                ).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span>Ciclo {prescriptionData.cycle}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Snapshot histórico — valores registrados, sem
                              recálculo.
                            </p>
                            <p className="text-sm mt-1">
                              Fase:{" "}
                              {prescriptionData.context.phaseId ??
                                "não registrada"}{" "}
                              | Dia:{" "}
                              {prescriptionData.context.day ??
                                "agenda completa do ciclo"}
                              {prescriptionData.context.gfrForCalvert !==
                                undefined && (
                                <>
                                  {" "}
                                  | GFR absoluto de Calvert registrado:{" "}
                                  {prescriptionData.context.gfrForCalvert}{" "}
                                  mL/min (não reutilizado automaticamente)
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Dados calculados */}
                        {prescriptionData?.calculatedValues && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                            <div>
                              <div className="text-xs text-muted-foreground">
                                SC
                              </div>
                              <div className="font-medium">
                                {prescriptionData.calculatedValues.bsa?.toFixed(
                                  2
                                )}{" "}
                                m²
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                eGFR
                              </div>
                              <div className="font-medium">
                                {prescriptionData.calculatedValues.egfr?.toFixed(
                                  0
                                )}{" "}
                                mL/min/1,73 m²
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Peso
                              </div>
                              <div className="font-medium">
                                {prescriptionData.patient.weight} kg
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                ECOG
                              </div>
                              <div className="font-medium">
                                {prescriptionData.patient.ecog}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Drogas prescritas */}
                        {prescriptionData.drugs.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Pill className="h-4 w-4" />
                              Drogas Prescritas
                            </div>
                            <div className="space-y-2">
                              {prescriptionData.drugs.map((drug, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-background border rounded"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {drug.name}
                                    </div>
                                    {drug.notes && (
                                      <div className="text-xs text-muted-foreground">
                                        {drug.notes}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      {drug.route} • {drug.days}{" "}
                                      {drug.frequency !== undefined &&
                                        `• ${drug.frequency} administração(ões)/dia`}{" "}
                                      {drug.timeOrigin}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      {drug.finalDose === undefined
                                        ? "Dose não registrada"
                                        : formatDoseQuantity(
                                            drug.finalDose
                                          )}{" "}
                                      {drug.resultUnit ??
                                        "unidade absoluta não registrada"}
                                    </div>
                                    {drug.dailyDose !== undefined && (
                                      <div className="text-xs">
                                        {formatDoseQuantity(drug.dailyDose)}{" "}
                                        {drug.resultUnit ?? "?"} /24h
                                      </div>
                                    )}
                                    {drug.baseDose && (
                                      <div className="text-xs text-muted-foreground">
                                        Base: {drug.baseDose} {drug.doseUnit}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Toxicidades relatadas */}
                        {prescriptionData?.toxicities &&
                          Object.keys(prescriptionData.toxicities).length >
                            0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                                <AlertTriangle className="h-4 w-4" />
                                Toxicidades Relatadas
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(
                                  prescriptionData.toxicities
                                ).map(([key, value]: [string, any]) => {
                                  if (value && value !== "G0") {
                                    return (
                                      <Badge
                                        key={key}
                                        variant="outline"
                                        className="text-amber-600 border-amber-600"
                                      >
                                        {key.replace(/_/g, " ")}: {value}
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          )}

                        {/* Dose cumulativa (se houver) */}
                        {prescriptionData?.cumulativeDose && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                              <TrendingUp className="h-4 w-4" />
                              Dose Cumulativa de Antraciclina
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                              {prescriptionData.cumulativeDose} mg/m²
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Resumo estatístico */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {sortedPrescriptions.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total de Prescrições
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {
                        new Set(sortedPrescriptions.map(p => p.protocolName))
                          .size
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Protocolos Diferentes
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {sortedPrescriptions.length > 0
                        ? Math.max(
                            ...sortedPrescriptions.map(
                              p =>
                                readPrescriptionHistory(p.prescriptionData)
                                  .cycle
                            )
                          )
                        : 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ciclo Máximo
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {sortedPrescriptions.length > 0
                        ? Math.ceil(
                            (new Date(
                              sortedPrescriptions[0].createdAt
                            ).getTime() -
                              new Date(
                                sortedPrescriptions[
                                  sortedPrescriptions.length - 1
                                ].createdAt
                              ).getTime()) /
                              (1000 * 60 * 60 * 24)
                          )
                        : 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dias em Tratamento
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
