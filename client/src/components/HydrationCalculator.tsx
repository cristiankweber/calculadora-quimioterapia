import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  createContext,
  useContext,
} from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Droplets,
  Zap,
  Heart,
  AlertTriangle,
  AlertCircle,
  Info,
  ClipboardCopy,
  Printer,
  ChevronDown,
  Beaker,
  Activity,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";

import type {
  PatientData,
  CalculatedValues,
  Protocol,
} from "@/types/calculator";
import {
  calculateHydration,
  calculateElectrolyteReplacements,
  calculateTransfusionSupport,
  type HydrationInput,
  type HydrationResult,
  type HydrationScheme,
  type HydrationAlert,
  type ElectrolyteInput,
  type ElectrolyteReplacement,
  type TransfusionInput,
  type TransfusionRecommendation,
} from "@/lib/hydrationSupport";

export interface HydrationSupportData {
  hydration: HydrationResult | null;
  electrolytes: ElectrolyteReplacement[];
  transfusion: TransfusionRecommendation[];
}

interface HydrationCalculatorProps {
  patientData: PatientData;
  calculatedValues: CalculatedValues | null;
  selectedProtocol: Protocol | null;
  effectiveDrugs?: HydrationInput["drugs"];
  selectionResolved?: boolean;
  proposalOnly?: boolean;
  onDataChange?: (data: HydrationSupportData) => void;
}

const SupportProposalContext = createContext(false);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function HydrationCalculator({
  patientData,
  calculatedValues,
  selectedProtocol,
  effectiveDrugs,
  selectionResolved = true,
  proposalOnly = false,
  onDataChange,
}: HydrationCalculatorProps) {
  const [activeTab, setActiveTab] = useState("hydration");

  // Estado para flags clínicos
  const [hasCardiacDisease, setHasCardiacDisease] = useState(false);
  const [isBleeding, setIsBleeding] = useState(false);
  const [isPreProcedure, setIsPreProcedure] = useState(false);
  const [isBMT, setIsBMT] = useState(false);
  const [isImmunosuppressed, setIsImmunosuppressed] = useState(false);
  const [hasFever, setHasFever] = useState(false);

  // Estado para eletrólitos (valores laboratoriais)
  const [labValues, setLabValues] = useState({
    sodium: "",
    potassium: "",
    magnesium: "",
    calciumIonized: "",
    phosphorus: "",
    hemoglobin: "",
    platelets: "",
  });

  const handleLabChange = useCallback((field: string, value: string) => {
    setLabValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const hasPatientData = calculatedValues && patientData.weight > 0;

  // Calcular dados de hidratação, eletrólitos e transfusão para expor ao pai (PDF)
  const hydrationData = useMemo(() => {
    if (!hasPatientData || !calculatedValues) return null;

    const hydration = selectedProtocol
      ? calculateHydration({
          weight: patientData.weight,
          bsa: calculatedValues.bsa,
          egfr: calculatedValues.egfr,
          protocolName: selectedProtocol.name,
          drugs:
            effectiveDrugs ??
            selectedProtocol.drugs.map(drug => ({
              name: drug.name,
              dose: drug.dose,
              doseUnit: drug.doseUnit,
            })),
          selectionResolved,
          hasCardiacDisease,
          hasRenalImpairment: calculatedValues.egfr < 60,
        })
      : null;

    const electrolytes = calculateElectrolyteReplacements({
      weight: patientData.weight,
      egfr: calculatedValues.egfr,
      hasCardiacDisease,
      sodium: labValues.sodium ? parseFloat(labValues.sodium) : undefined,
      potassium: labValues.potassium
        ? parseFloat(labValues.potassium)
        : undefined,
      magnesium: labValues.magnesium
        ? parseFloat(labValues.magnesium)
        : undefined,
      calciumIonized: labValues.calciumIonized
        ? parseFloat(labValues.calciumIonized)
        : undefined,
      phosphorus: labValues.phosphorus
        ? parseFloat(labValues.phosphorus)
        : undefined,
    });

    const transfusion = calculateTransfusionSupport({
      weight: patientData.weight,
      hemoglobin: labValues.hemoglobin
        ? parseFloat(labValues.hemoglobin)
        : undefined,
      platelets: labValues.platelets
        ? parseFloat(labValues.platelets)
        : undefined,
      isBleeding,
      isPreProcedure,
      isBMT,
      isImmunosuppressed,
      hasFever,
    });

    return { hydration, electrolytes, transfusion };
  }, [
    hasPatientData,
    calculatedValues,
    selectedProtocol,
    patientData.weight,
    hasCardiacDisease,
    labValues,
    isBleeding,
    isPreProcedure,
    isBMT,
    isImmunosuppressed,
    hasFever,
    effectiveDrugs,
    selectionResolved,
  ]);

  // Notificar o pai quando os dados mudam
  useEffect(() => {
    onDataChange?.(
      hydrationData ?? { hydration: null, electrolytes: [], transfusion: [] }
    );
  }, [hydrationData, onDataChange]);

  return (
    <SupportProposalContext.Provider value={proposalOnly}>
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">
              Calculadora de Hidratação e Suporte
            </CardTitle>
          </div>
          <CardDescription>
            Esquemas de hidratação, reposição de eletrólitos e suporte
            transfusional
          </CardDescription>
        </CardHeader>
        <CardContent>
          {proposalOnly && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                Suporte para revisão — não é prescrição liberada
              </AlertTitle>
              <AlertDescription>
                Hidratação, eletrólitos e transfusão são propostas assistivas.
                Validar fase/dia, condições clínicas, produto e ordens
                individuais; a cópia está bloqueada para os rascunhos.
              </AlertDescription>
            </Alert>
          )}
          {!hasPatientData ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Dados do paciente necessários</AlertTitle>
              <AlertDescription>
                Preencha peso, altura e creatinina do paciente para calcular os
                esquemas de hidratação e suporte.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="hydration" className="text-xs sm:text-sm">
                  <Droplets className="h-3.5 w-3.5 mr-1.5" />
                  Hidratação
                </TabsTrigger>
                <TabsTrigger
                  value="electrolytes"
                  className="text-xs sm:text-sm"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Eletrólitos
                </TabsTrigger>
                <TabsTrigger value="transfusion" className="text-xs sm:text-sm">
                  <Syringe className="h-3.5 w-3.5 mr-1.5" />
                  Transfusão
                </TabsTrigger>
              </TabsList>

              {/* ═══ TAB HIDRATAÇÃO ═══ */}
              <TabsContent value="hydration">
                <HydrationTab
                  patientData={patientData}
                  calculatedValues={calculatedValues}
                  selectedProtocol={selectedProtocol}
                  hasCardiacDisease={hasCardiacDisease}
                  setHasCardiacDisease={setHasCardiacDisease}
                  hydrationResult={hydrationData?.hydration ?? null}
                />
              </TabsContent>

              {/* ═══ TAB ELETRÓLITOS ═══ */}
              <TabsContent value="electrolytes">
                <ElectrolytesTab
                  patientData={patientData}
                  calculatedValues={calculatedValues}
                  hasCardiacDisease={hasCardiacDisease}
                  setHasCardiacDisease={setHasCardiacDisease}
                  labValues={labValues}
                  onLabChange={handleLabChange}
                />
              </TabsContent>

              {/* ═══ TAB TRANSFUSÃO ═══ */}
              <TabsContent value="transfusion">
                <TransfusionTab
                  patientData={patientData}
                  labValues={labValues}
                  onLabChange={handleLabChange}
                  isBleeding={isBleeding}
                  setIsBleeding={setIsBleeding}
                  isPreProcedure={isPreProcedure}
                  setIsPreProcedure={setIsPreProcedure}
                  isBMT={isBMT}
                  setIsBMT={setIsBMT}
                  isImmunosuppressed={isImmunosuppressed}
                  setIsImmunosuppressed={setIsImmunosuppressed}
                  hasFever={hasFever}
                  setHasFever={setHasFever}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </SupportProposalContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB HIDRATAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

function HydrationTab({
  patientData,
  calculatedValues,
  selectedProtocol,
  hasCardiacDisease,
  setHasCardiacDisease,
  hydrationResult,
}: {
  patientData: PatientData;
  calculatedValues: CalculatedValues;
  selectedProtocol: Protocol | null;
  hasCardiacDisease: boolean;
  setHasCardiacDisease: (v: boolean) => void;
  hydrationResult: HydrationResult | null;
}) {
  const proposalOnly = useContext(SupportProposalContext);

  const handleCopy = useCallback(() => {
    if (!hydrationResult || proposalOnly) return;
    const text = formatHydrationForCopy(
      hydrationResult,
      patientData,
      calculatedValues
    );
    navigator.clipboard.writeText(text);
    toast.success("Esquema de hidratação copiado!");
  }, [hydrationResult, patientData, calculatedValues, proposalOnly]);

  return (
    <div className="space-y-4">
      {/* Flags clínicos */}
      <div className="flex flex-wrap gap-4 p-3 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <Switch
            checked={hasCardiacDisease}
            onCheckedChange={setHasCardiacDisease}
            id="cardiac"
          />
          <Label htmlFor="cardiac" className="text-sm cursor-pointer">
            <Heart className="h-3.5 w-3.5 inline mr-1 text-red-500" />
            Cardiopatia / ICC
          </Label>
        </div>
      </div>

      {!selectedProtocol ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Selecione um protocolo</AlertTitle>
          <AlertDescription>
            Selecione um protocolo de quimioterapia na calculadora principal
            para gerar o esquema de hidratação.
          </AlertDescription>
        </Alert>
      ) : hydrationResult ? (
        <>
          {/* Tipo de protocolo */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge
                variant={
                  hydrationResult.protocolType === "none"
                    ? "secondary"
                    : "default"
                }
                className={`max-w-full whitespace-normal text-left ${
                  hydrationResult.protocolType.startsWith("cisplatin") ||
                  hydrationResult.protocolType === "methotrexate_hd"
                    ? "bg-red-100 text-red-800 border-red-200"
                    : hydrationResult.protocolType === "ifosfamide" ||
                        hydrationResult.protocolType === "cyclophosphamide_hd"
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : ""
                }`}
              >
                {hydrationResult.protocolLabel}
              </Badge>
              {hydrationResult.totalVolume > 0 && (
                <span className="text-sm text-muted-foreground">
                  Volume total:{" "}
                  <strong>
                    {hydrationResult.totalVolume.toLocaleString()} mL
                  </strong>
                </span>
              )}
            </div>
            {hydrationResult.schemes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={proposalOnly}
              >
                <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
                Copiar
              </Button>
            )}
          </div>

          {/* Alertas */}
          <AlertsList alerts={hydrationResult.alerts} />

          {/* Esquemas de hidratação */}
          {hydrationResult.schemes.length > 0 && (
            <div className="space-y-3">
              {hydrationResult.schemes.map((scheme, idx) => (
                <HydrationSchemeCard key={idx} scheme={scheme} index={idx} />
              ))}
            </div>
          )}

          {/* Monitorização */}
          {hydrationResult.monitoring.length > 0 && (
            <Card className="bg-white">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Monitorização
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <ul className="space-y-1">
                  {hydrationResult.monitoring.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-muted-foreground flex items-start gap-1.5"
                    >
                      <span className="text-blue-500 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB ELETRÓLITOS
// ═══════════════════════════════════════════════════════════════════════════════

function ElectrolytesTab({
  patientData,
  calculatedValues,
  hasCardiacDisease,
  setHasCardiacDisease,
  labValues,
  onLabChange,
}: {
  patientData: PatientData;
  calculatedValues: CalculatedValues;
  hasCardiacDisease: boolean;
  setHasCardiacDisease: (v: boolean) => void;
  labValues: Record<string, string>;
  onLabChange: (field: string, value: string) => void;
}) {
  const proposalOnly = useContext(SupportProposalContext);
  const electrolyteResults = useMemo(() => {
    const input: ElectrolyteInput = {
      weight: patientData.weight,
      egfr: calculatedValues.egfr,
      hasCardiacDisease,
      sodium: labValues.sodium ? parseFloat(labValues.sodium) : undefined,
      potassium: labValues.potassium
        ? parseFloat(labValues.potassium)
        : undefined,
      magnesium: labValues.magnesium
        ? parseFloat(labValues.magnesium)
        : undefined,
      calciumIonized: labValues.calciumIonized
        ? parseFloat(labValues.calciumIonized)
        : undefined,
      phosphorus: labValues.phosphorus
        ? parseFloat(labValues.phosphorus)
        : undefined,
    };
    return calculateElectrolyteReplacements(input);
  }, [patientData.weight, calculatedValues.egfr, hasCardiacDisease, labValues]);

  const handleCopy = useCallback(() => {
    if (proposalOnly) return;
    const text = formatElectrolytesForCopy(electrolyteResults, patientData);
    navigator.clipboard.writeText(text);
    toast.success("Reposição de eletrólitos copiada!");
  }, [electrolyteResults, patientData, proposalOnly]);

  const hasAnyValue = Object.values(labValues).some(
    v =>
      v !== "" &&
      ["sodium", "potassium", "magnesium", "calciumIonized", "phosphorus"].some(
        k => labValues[k as keyof typeof labValues] !== ""
      )
  );

  return (
    <div className="space-y-4">
      {/* Flags */}
      <div className="flex flex-wrap gap-4 p-3 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <Switch
            checked={hasCardiacDisease}
            onCheckedChange={setHasCardiacDisease}
            id="cardiac-elec"
          />
          <Label htmlFor="cardiac-elec" className="text-sm cursor-pointer">
            <Heart className="h-3.5 w-3.5 inline mr-1 text-red-500" />
            Cardiopatia
          </Label>
        </div>
      </div>

      {/* Inputs de eletrólitos */}
      <Card className="bg-white">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">Valores Laboratoriais</CardTitle>
          <CardDescription className="text-xs">
            Insira os valores dos eletrólitos para calcular a reposição
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="support-sodium" className="text-xs">
                Na⁺ (mEq/L)
              </Label>
              <Input
                id="support-sodium"
                type="number"
                step="0.1"
                placeholder="135-145"
                value={labValues.sodium}
                onChange={e => onLabChange("sodium", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="support-potassium" className="text-xs">
                K⁺ (mEq/L)
              </Label>
              <Input
                id="support-potassium"
                type="number"
                step="0.1"
                placeholder="3.5-5.5"
                value={labValues.potassium}
                onChange={e => onLabChange("potassium", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="support-magnesium" className="text-xs">
                Mg²⁺ (mg/dL)
              </Label>
              <Input
                id="support-magnesium"
                type="number"
                step="0.1"
                placeholder="1.8-2.4"
                value={labValues.magnesium}
                onChange={e => onLabChange("magnesium", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="support-calcium" className="text-xs">
                Ca²⁺ (mmol/L)
              </Label>
              <Input
                id="support-calcium"
                type="number"
                step="0.01"
                placeholder="1.15-1.35"
                value={labValues.calciumIonized}
                onChange={e => onLabChange("calciumIonized", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="support-phosphorus" className="text-xs">
                PO₄ (mg/dL)
              </Label>
              <Input
                id="support-phosphorus"
                type="number"
                step="0.1"
                placeholder="2.5-4.5"
                value={labValues.phosphorus}
                onChange={e => onLabChange("phosphorus", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {electrolyteResults.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={proposalOnly}
            >
              <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
              Copiar Reposição
            </Button>
          </div>

          <Accordion
            type="multiple"
            defaultValue={electrolyteResults
              .filter(r => r.status !== "normal")
              .map((_, i) => `elec-${i}`)}
          >
            {electrolyteResults.map((result, idx) => (
              <ElectrolyteResultCard key={idx} result={result} index={idx} />
            ))}
          </Accordion>
        </>
      )}

      {!hasAnyValue && (
        <Alert>
          <Beaker className="h-4 w-4" />
          <AlertTitle>Insira valores laboratoriais</AlertTitle>
          <AlertDescription>
            Preencha os valores dos eletrólitos acima para calcular as
            reposições necessárias.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB TRANSFUSÃO
// ═══════════════════════════════════════════════════════════════════════════════

function TransfusionTab({
  patientData,
  labValues,
  onLabChange,
  isBleeding,
  setIsBleeding,
  isPreProcedure,
  setIsPreProcedure,
  isBMT,
  setIsBMT,
  isImmunosuppressed,
  setIsImmunosuppressed,
  hasFever,
  setHasFever,
}: {
  patientData: PatientData;
  labValues: Record<string, string>;
  onLabChange: (field: string, value: string) => void;
  isBleeding: boolean;
  setIsBleeding: (v: boolean) => void;
  isPreProcedure: boolean;
  setIsPreProcedure: (v: boolean) => void;
  isBMT: boolean;
  setIsBMT: (v: boolean) => void;
  isImmunosuppressed: boolean;
  setIsImmunosuppressed: (v: boolean) => void;
  hasFever: boolean;
  setHasFever: (v: boolean) => void;
}) {
  const proposalOnly = useContext(SupportProposalContext);
  const transfusionResults = useMemo(() => {
    const input: TransfusionInput = {
      weight: patientData.weight,
      hemoglobin: labValues.hemoglobin
        ? parseFloat(labValues.hemoglobin)
        : undefined,
      platelets: labValues.platelets
        ? parseFloat(labValues.platelets)
        : undefined,
      isBleeding,
      isPreProcedure,
      isBMT,
      isImmunosuppressed,
      hasFever,
    };
    return calculateTransfusionSupport(input);
  }, [
    patientData.weight,
    labValues.hemoglobin,
    labValues.platelets,
    isBleeding,
    isPreProcedure,
    isBMT,
    isImmunosuppressed,
    hasFever,
  ]);

  const handleCopy = useCallback(() => {
    if (proposalOnly) return;
    const text = formatTransfusionForCopy(transfusionResults, patientData);
    navigator.clipboard.writeText(text);
    toast.success("Suporte transfusional copiado!");
  }, [transfusionResults, patientData, proposalOnly]);

  const hasAnyValue = labValues.hemoglobin !== "" || labValues.platelets !== "";

  return (
    <div className="space-y-4">
      {/* Flags clínicos */}
      <div className="flex flex-wrap gap-x-5 gap-y-3 p-3 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <Switch
            checked={isBleeding}
            onCheckedChange={setIsBleeding}
            id="bleeding"
          />
          <Label htmlFor="bleeding" className="text-sm cursor-pointer">
            Sangramento Ativo
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isPreProcedure}
            onCheckedChange={setIsPreProcedure}
            id="procedure"
          />
          <Label htmlFor="procedure" className="text-sm cursor-pointer">
            Pré-Procedimento
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isBMT} onCheckedChange={setIsBMT} id="bmt" />
          <Label htmlFor="bmt" className="text-sm cursor-pointer">
            TMO/TCTH
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isImmunosuppressed}
            onCheckedChange={setIsImmunosuppressed}
            id="immuno"
          />
          <Label htmlFor="immuno" className="text-sm cursor-pointer">
            Imunossuprimido
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={hasFever} onCheckedChange={setHasFever} id="fever" />
          <Label htmlFor="fever" className="text-sm cursor-pointer">
            Febre
          </Label>
        </div>
      </div>

      {/* Inputs laboratoriais */}
      <Card className="bg-white">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">Valores Laboratoriais</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="support-hemoglobin" className="text-xs">
                Hemoglobina (g/dL)
              </Label>
              <Input
                id="support-hemoglobin"
                type="number"
                step="0.1"
                placeholder="Ex: 7.5"
                value={labValues.hemoglobin}
                onChange={e => onLabChange("hemoglobin", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="support-platelets" className="text-xs">
                Plaquetas (/mm³)
              </Label>
              <Input
                id="support-platelets"
                type="number"
                step="1000"
                placeholder="Ex: 15000"
                value={labValues.platelets}
                onChange={e => onLabChange("platelets", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {transfusionResults.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={proposalOnly}
            >
              <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
              Copiar
            </Button>
          </div>

          <div className="space-y-3">
            {transfusionResults.map((result, idx) => (
              <TransfusionResultCard key={idx} result={result} />
            ))}
          </div>
        </>
      )}

      {!hasAnyValue && (
        <Alert>
          <Syringe className="h-4 w-4" />
          <AlertTitle>Insira valores laboratoriais</AlertTitle>
          <AlertDescription>
            Preencha hemoglobina e/ou plaquetas para avaliar necessidade de
            suporte transfusional.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

function AlertsList({ alerts }: { alerts: HydrationAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, idx) => (
        <Alert
          key={idx}
          variant={alert.type === "danger" ? "destructive" : "default"}
          className={
            alert.type === "danger"
              ? "border-red-300 bg-red-50"
              : alert.type === "warning"
                ? "border-amber-300 bg-amber-50"
                : "border-blue-200 bg-blue-50"
          }
        >
          {alert.type === "danger" ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : alert.type === "warning" ? (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          ) : (
            <Info className="h-4 w-4 text-blue-600" />
          )}
          <AlertDescription
            className={
              alert.type === "danger"
                ? "text-red-800 text-sm font-medium"
                : alert.type === "warning"
                  ? "text-amber-800 text-sm"
                  : "text-blue-800 text-sm"
            }
          >
            {alert.message}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

function HydrationSchemeCard({
  scheme,
  index,
}: {
  scheme: HydrationScheme;
  index: number;
}) {
  const phaseColors = {
    pre: "border-l-blue-500 bg-blue-50/50",
    concurrent: "border-l-purple-500 bg-purple-50/50",
    post: "border-l-green-500 bg-green-50/50",
  };

  return (
    <Card className={`border-l-4 ${phaseColors[scheme.phase]} bg-white`}>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {index + 1}. {scheme.phaseLabel}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {scheme.duration > 0 ? `${scheme.duration}h` : "Conforme protocolo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="text-xs font-medium text-muted-foreground py-1 w-24">
                Solução
              </TableCell>
              <TableCell className="text-sm py-1 font-medium">
                {scheme.solution}
              </TableCell>
            </TableRow>
            {scheme.volume > 0 && (
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground py-1">
                  Volume
                </TableCell>
                <TableCell className="text-sm py-1">
                  {scheme.volume.toLocaleString()} mL
                </TableCell>
              </TableRow>
            )}
            {scheme.rate > 0 && (
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground py-1">
                  Velocidade
                </TableCell>
                <TableCell className="text-sm py-1">
                  {scheme.rate.toLocaleString()} mL/h
                </TableCell>
              </TableRow>
            )}
            {scheme.additives && scheme.additives.length > 0 && (
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground py-1">
                  Aditivos
                </TableCell>
                <TableCell className="text-sm py-1">
                  {scheme.additives.map((a, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="mr-1 mb-1 text-xs"
                    >
                      {a}
                    </Badge>
                  ))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {scheme.notes && scheme.notes.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {scheme.notes.map((note, i) => (
              <p
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-1"
              >
                <span className="text-blue-400 mt-0.5 shrink-0">→</span>
                {note}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ElectrolyteResultCard({
  result,
  index,
}: {
  result: ElectrolyteReplacement;
  index: number;
}) {
  const statusColors: Record<string, string> = {
    critical: "text-red-700 bg-red-100 border-red-200",
    low: "text-amber-700 bg-amber-100 border-amber-200",
    normal: "text-green-700 bg-green-100 border-green-200",
    high: "text-amber-700 bg-amber-100 border-amber-200",
    critical_high: "text-red-700 bg-red-100 border-red-200",
  };

  const borderColors: Record<string, string> = {
    critical: "border-red-400",
    low: "border-amber-400",
    normal: "border-green-400",
    high: "border-amber-400",
    critical_high: "border-red-400",
  };

  return (
    <AccordionItem
      value={`elec-${index}`}
      className={`border rounded-lg mb-2 ${borderColors[result.status]} bg-white`}
    >
      <AccordionTrigger className="px-4 py-2 hover:no-underline">
        <div className="flex items-center gap-3 w-full">
          <span className="font-semibold text-sm">{result.electrolyte}</span>
          <Badge className={`text-xs ${statusColors[result.status]}`}>
            {result.currentValue} {result.unit} — {result.statusLabel}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto mr-2">
            Ref: {result.normalRange} {result.unit}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        {/* Alertas */}
        {result.alerts.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {result.alerts.map((alert, i) => (
              <Alert
                key={i}
                variant="destructive"
                className="py-2 border-red-200 bg-red-50"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs text-red-800">
                  {alert}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Opções de reposição */}
        {result.replacements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Opções de Reposição
            </h4>
            {result.replacements.map((rep, i) => (
              <Card key={i} className="bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {rep.route}
                    </Badge>
                    <span className="font-medium text-sm">{rep.solution}</span>
                  </div>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground py-0.5 w-20">
                          Dose
                        </TableCell>
                        <TableCell className="text-xs py-0.5">
                          {rep.dose}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground py-0.5">
                          Diluição
                        </TableCell>
                        <TableCell className="text-xs py-0.5">
                          {rep.volume}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground py-0.5">
                          Velocidade
                        </TableCell>
                        <TableCell className="text-xs py-0.5">
                          {rep.rate}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground py-0.5">
                          Frequência
                        </TableCell>
                        <TableCell className="text-xs py-0.5">
                          {rep.frequency}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  {rep.notes && (
                    <p className="text-xs text-muted-foreground mt-1.5 italic">
                      {rep.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {result.status === "normal" && result.replacements.length === 0 && (
          <p className="text-sm text-green-700">
            Valor dentro da faixa normal. Sem necessidade de reposição.
          </p>
        )}

        {/* Monitorização */}
        {result.monitoring.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Monitorização
            </h4>
            <ul className="space-y-0.5">
              {result.monitoring.map((item, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground flex items-start gap-1"
                >
                  <span className="text-blue-400 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function TransfusionResultCard({
  result,
}: {
  result: TransfusionRecommendation;
}) {
  const urgencyColors: Record<string, string> = {
    immediate: "bg-red-100 text-red-800 border-red-200",
    routine: "bg-amber-100 text-amber-800 border-amber-200",
    not_indicated: "bg-green-100 text-green-800 border-green-200",
  };

  const borderColors: Record<string, string> = {
    immediate: "border-l-red-500",
    routine: "border-l-amber-500",
    not_indicated: "border-l-green-500",
  };

  return (
    <Card className={`border-l-4 ${borderColors[result.urgency]} bg-white`}>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Syringe className="h-4 w-4" />
            {result.productLabel}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={urgencyColors[result.urgency]}>
              {result.indicated ? result.urgencyLabel : "Não Indicada"}
            </Badge>
            <span className="text-sm">
              {result.currentValue.toLocaleString()} {result.unit}
              <span className="text-muted-foreground">
                {" "}
                (threshold: {result.threshold.toLocaleString()})
              </span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {/* Alertas */}
        {result.alerts.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {result.alerts.map((alert, i) => (
              <Alert
                key={i}
                variant={
                  result.urgency === "immediate" ? "destructive" : "default"
                }
                className="py-2"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">{alert}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {result.indicated && (
          <div className="space-y-3">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium text-muted-foreground py-1 w-32">
                    Volume
                  </TableCell>
                  <TableCell className="text-sm py-1">
                    {result.volume}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium text-muted-foreground py-1">
                    Incremento Esperado
                  </TableCell>
                  <TableCell className="text-sm py-1">
                    {result.expectedIncrement}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Requisitos especiais */}
            {result.specialRequirements.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Requisitos Especiais
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.specialRequirements.map((req, i) => (
                    <Badge
                      key={i}
                      variant="destructive"
                      className="text-xs bg-red-100 text-red-800 border-red-200"
                    >
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Pré-medicação */}
            {result.premedication.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Pré-Medicação
                </h4>
                <ul className="space-y-0.5">
                  {result.premedication.map((med, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1"
                    >
                      <span className="text-purple-400 mt-0.5">•</span>
                      {med}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Monitorização */}
            {result.monitoring.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Monitorização
                </h4>
                <ul className="space-y-0.5">
                  {result.monitoring.map((item, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground flex items-start gap-1"
                    >
                      <span className="text-blue-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATAÇÃO PARA CÓPIA
// ═══════════════════════════════════════════════════════════════════════════════

function formatHydrationForCopy(
  result: HydrationResult,
  patient: PatientData,
  calc: CalculatedValues
): string {
  const lines: string[] = [];
  lines.push("═══ ESQUEMA DE HIDRATAÇÃO ═══");
  lines.push(
    `Paciente: ${patient.name || "N/I"} | Peso: ${patient.weight}kg | SC: ${calc.bsa.toFixed(2)}m² | eGFR: ${calc.egfr.toFixed(0)} mL/min`
  );
  lines.push(`Protocolo: ${result.protocolLabel}`);
  lines.push(`Volume Total: ${result.totalVolume.toLocaleString()} mL`);
  lines.push("");

  result.schemes.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.phaseLabel}`);
    lines.push(`   Solução: ${s.solution}`);
    if (s.volume > 0) lines.push(`   Volume: ${s.volume.toLocaleString()} mL`);
    if (s.rate > 0)
      lines.push(`   Velocidade: ${s.rate.toLocaleString()} mL/h`);
    if (s.duration > 0) lines.push(`   Duração: ${s.duration}h`);
    if (s.additives?.length)
      lines.push(`   Aditivos: ${s.additives.join(", ")}`);
    if (s.notes?.length) s.notes.forEach(n => lines.push(`   → ${n}`));
    lines.push("");
  });

  if (result.alerts.length > 0) {
    lines.push("ALERTAS:");
    result.alerts.forEach(a => lines.push(`  ⚠ ${a.message}`));
    lines.push("");
  }

  if (result.monitoring.length > 0) {
    lines.push("MONITORIZAÇÃO:");
    result.monitoring.forEach(m => lines.push(`  • ${m}`));
  }

  return lines.join("\n");
}

function formatElectrolytesForCopy(
  results: ElectrolyteReplacement[],
  patient: PatientData
): string {
  const lines: string[] = [];
  lines.push("═══ REPOSIÇÃO DE ELETRÓLITOS ═══");
  lines.push(`Paciente: ${patient.name || "N/I"} | Peso: ${patient.weight}kg`);
  lines.push("");

  results.forEach(r => {
    lines.push(
      `${r.electrolyte}: ${r.currentValue} ${r.unit} (${r.statusLabel}) [Ref: ${r.normalRange}]`
    );
    if (r.replacements.length > 0) {
      r.replacements.forEach(rep => {
        lines.push(`  ${rep.route}: ${rep.solution} — ${rep.dose}`);
        lines.push(
          `    Diluição: ${rep.volume} | Velocidade: ${rep.rate} | Freq: ${rep.frequency}`
        );
        if (rep.notes) lines.push(`    Obs: ${rep.notes}`);
      });
    } else if (r.status === "normal") {
      lines.push("  Sem necessidade de reposição.");
    }
    if (r.alerts.length > 0) r.alerts.forEach(a => lines.push(`  ⚠ ${a}`));
    lines.push("");
  });

  return lines.join("\n");
}

function formatTransfusionForCopy(
  results: TransfusionRecommendation[],
  patient: PatientData
): string {
  const lines: string[] = [];
  lines.push("═══ SUPORTE TRANSFUSIONAL ═══");
  lines.push(`Paciente: ${patient.name || "N/I"} | Peso: ${patient.weight}kg`);
  lines.push("");

  results.forEach(r => {
    lines.push(
      `${r.productLabel}: ${r.currentValue.toLocaleString()} ${r.unit}`
    );
    lines.push(
      `  Indicação: ${r.indicated ? r.urgencyLabel : "Não indicada"} (threshold: ${r.threshold.toLocaleString()})`
    );
    if (r.indicated) {
      lines.push(`  Volume: ${r.volume}`);
      lines.push(`  Incremento esperado: ${r.expectedIncrement}`);
      if (r.specialRequirements.length > 0)
        lines.push(`  Requisitos: ${r.specialRequirements.join("; ")}`);
      if (r.premedication.length > 0)
        lines.push(`  Pré-medicação: ${r.premedication.join("; ")}`);
    }
    if (r.alerts.length > 0) r.alerts.forEach(a => lines.push(`  ⚠ ${a}`));
    lines.push("");
  });

  return lines.join("\n");
}
