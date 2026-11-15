import { memo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Protocol, AntiemeticProphylaxis } from "@/types/calculator";
import { AlertTriangle, Shield, Pill, Activity } from "lucide-react";

interface ProphylaxisAlertsProps {
  protocol: Protocol | null;
  antiemetics: AntiemeticProphylaxis | null;
}

// JSON e registros legados podem omitir estas listas, apesar do contrato TypeScript.
// A normalização é apenas uma projeção de apresentação: não altera a fonte clínica.
const textList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
const isTextList = (value: unknown): boolean =>
  Array.isArray(value) && value.every(item => typeof item === "string");

function ProphylaxisAlerts({ protocol, antiemetics }: ProphylaxisAlertsProps) {
  if (!protocol) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profilaxias e Alertas</CardTitle>
          <CardDescription>
            Selecione um protocolo para visualizar as profilaxias recomendadas
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const specialAlerts = textList(protocol.specialAlerts);
  const prophylaxis = textList(protocol.prophylaxis);
  const nursingCare = textList(protocol.nursingCare);
  const renalAdjustments = textList(protocol.renalAdjustments);
  const hepaticAdjustments = textList(protocol.hepaticAdjustments);
  const hematologicAdjustments = textList(protocol.hematologicAdjustments);
  const incompleteProtocol = [
    protocol.specialAlerts,
    protocol.prophylaxis,
    protocol.nursingCare,
    protocol.renalAdjustments,
    protocol.hepaticAdjustments,
    protocol.hematologicAdjustments,
  ].some(value => !isTextList(value));
  const day1 = textList(antiemetics?.day1);
  const days2to4 = textList(antiemetics?.days2to4);
  const rescue = textList(antiemetics?.rescue);
  const antiemeticAlerts = textList(antiemetics?.alerts);
  const incompleteAntiemetics = Boolean(
    antiemetics &&
      [
        antiemetics.day1,
        antiemetics.days2to4,
        antiemetics.rescue,
        antiemetics.alerts,
      ].some(value => !isTextList(value))
  );
  const emptySection = (
    <p className="text-sm text-muted-foreground">
      Informações não cadastradas nesta seção. Confira o protocolo.
    </p>
  );
  const riskLabel =
    antiemetics?.risk === "high"
      ? "Alto"
      : antiemetics?.risk === "moderate"
        ? "Moderado"
        : antiemetics?.risk === "low"
          ? "Baixo"
          : antiemetics?.risk === "minimal"
            ? "Mínimo"
            : "Não informado";

  return (
    <div className="space-y-4">
      {incompleteProtocol && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Informações de profilaxia e cuidados não informadas ou incompletas.
            Algumas listas estão ausentes ou em formato inválido; confira o
            cadastro. A ausência de informação não significa ausência de
            indicação clínica.
          </AlertDescription>
        </Alert>
      )}
      {/* Alertas Especiais */}
      {specialAlerts.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">
                Alertas Especiais
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {specialAlerts.map((alert, index) => (
              <Alert key={index} variant="destructive">
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Profilaxias e Cuidados */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Profilaxias e Cuidados</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="prophylaxis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prophylaxis">Profilaxias</TabsTrigger>
              <TabsTrigger value="antiemetics">Antieméticos</TabsTrigger>
              <TabsTrigger value="nursing">Enfermagem</TabsTrigger>
            </TabsList>
            <TabsContent value="prophylaxis" className="space-y-3 mt-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center space-x-2">
                  <Pill className="h-4 w-4" />
                  <span>Profilaxias Obrigatórias/Recomendadas</span>
                </h4>
                {prophylaxis.length > 0 ? (
                  <ul className="space-y-2">
                    {prophylaxis.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start space-x-2 text-sm"
                      >
                        <span className="text-primary mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  emptySection
                )}
              </div>
            </TabsContent>
            <TabsContent value="antiemetics" className="space-y-3 mt-4">
              {antiemetics ? (
                <>
                  {incompleteAntiemetics && (
                    <Alert>
                      <AlertDescription>
                        Dados de antiemese não informados ou incompletos.
                        Confira o cadastro; nenhuma medicação foi presumida.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center space-x-2 mb-3">
                    <Badge
                      variant="outline"
                      className={
                        antiemetics.risk === "high"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : antiemetics.risk === "moderate"
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                            : "bg-blue-100 text-blue-800 border-blue-300"
                      }
                    >
                      Risco Emetogênico: {riskLabel}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">
                        Dia 1 (Pré-QT):
                      </h4>
                      {day1.length > 0 ? (
                        <ul className="space-y-1">
                          {day1.map((item, index) => (
                            <li
                              key={index}
                              className="flex items-start space-x-2 text-sm"
                            >
                              <span className="text-primary mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        emptySection
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Dias 2-4:</h4>
                      {days2to4.length > 0 ? (
                        <ul className="space-y-1">
                          {days2to4.map((item, index) => (
                            <li
                              key={index}
                              className="flex items-start space-x-2 text-sm"
                            >
                              <span className="text-primary mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        emptySection
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2">
                        Medicações de Resgate:
                      </h4>
                      {rescue.length > 0 ? (
                        <ul className="space-y-1">
                          {rescue.map((item, index) => (
                            <li
                              key={index}
                              className="flex items-start space-x-2 text-sm"
                            >
                              <span className="text-secondary mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        emptySection
                      )}
                    </div>
                    {antiemeticAlerts.length > 0 && (
                      <div className="mt-4">
                        {antiemeticAlerts.map((alert, index) => (
                          <Alert key={index} className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              {alert}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma profilaxia antiemética configurada
                </p>
              )}
            </TabsContent>
            <TabsContent value="nursing" className="space-y-3 mt-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Cuidados de Enfermagem</span>
                </h4>
                {nursingCare.length > 0 ? (
                  <ul className="space-y-2">
                    {nursingCare.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start space-x-2 text-sm"
                      >
                        <span className="text-secondary mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  emptySection
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Ajustes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustes de Dose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renalAdjustments.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-primary">
                Ajustes Renais:
              </h4>
              <ul className="space-y-1">
                {renalAdjustments.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hepaticAdjustments.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-secondary">
                Ajustes Hepáticos:
              </h4>
              <ul className="space-y-1">
                {hepaticAdjustments.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hematologicAdjustments.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-accent">
                Ajustes Hematológicos:
              </h4>
              <ul className="space-y-1">
                {hematologicAdjustments.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {renalAdjustments.length === 0 &&
            hepaticAdjustments.length === 0 &&
            hematologicAdjustments.length === 0 &&
            emptySection}
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(ProphylaxisAlerts);
