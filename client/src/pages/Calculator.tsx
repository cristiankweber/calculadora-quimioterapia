import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PatientForm from '@/components/PatientForm';
import CalculatedValuesDisplay from '@/components/CalculatedValues';
import ProtocolSelector from '@/components/ProtocolSelector';
import DrugsTable from '@/components/DrugsTable';
import ProphylaxisAlerts from '@/components/ProphylaxisAlerts';
import DilutionInfo from '@/components/DilutionInfo';
import ToxicityAssessment from '@/components/ToxicityAssessment';
import { ToxicityPredictionWithMetrics } from '@/components/ToxicityPrediction';
import PatientHistoryDB from '@/components/PatientHistoryDB';
import EmergencyModal, { type EmergencyPatientData } from '@/components/EmergencyModal';

// Lazy load PrintablePrescription para evitar travamento ao selecionar protocolo
const PrintablePrescription = lazy(() => import('@/components/PrintablePrescription'));

import type { PatientData, Protocol, Drug, CalculatedValues } from '@/types/calculator';
import type { ToxicityGrade } from '@/data/ctcae';

import { calculatePatientValues, calculateDrugDose } from '@/lib/calculations';
import { generateAntiemeticProphylaxis } from '@/lib/antiemetics';
import { getDoseAdjustmentFactor } from '@/data/ctcae';
import { generatePrescriptionPDF } from '@/lib/pdfGenerator';
import { trpc } from '@/lib/trpc';

import {
  FileDown,
  Copy,
  Save,
  Printer,
  Settings as SettingsIcon,
  BarChart3,
  AlertCircle
} from 'lucide-react';

export default function Calculator() {

  const [, setLocation] = useLocation();

  /** ESTADO DO PACIENTE */
  const [patientData, setPatientData] = useState<PatientData>({
    name: '',
    age: 0,
    sex: 'M',
    weight: 0,
    height: 0,
    creatinine: 0,
    bilirubin: 0,
    ecog: 0,
    comorbidities: '',
  });

  /** Atualização do paciente — MEMOIZADA */
  const handlePatientChange = useCallback((newData: PatientData) => {
    setPatientData(prev => {
      // Comparar campo por campo para evitar updates desnecessários
      for (const key in newData) {
        if (newData[key as keyof PatientData] !== prev[key as keyof PatientData]) {
          return newData;
        }
      }
      return prev;
    });
    // Limpar erros de validação quando campos forem preenchidos
    setValidationErrors(prev => {
      const newErrors = new Set(prev);
      if (newData.weight > 0) newErrors.delete('weight');
      if (newData.height > 0) newErrors.delete('height');
      if (newData.creatinine > 0) newErrors.delete('creatinine');
      return newErrors;
    });
  }, []);

  /** ESTADOS DA CALCULADORA */
  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [calculatedDrugs, setCalculatedDrugs] = useState<Drug[]>([]);
  const [toxicities, setToxicities] = useState<Record<string, ToxicityGrade>>({});
  const [prescriptionId, setPrescriptionId] = useState<string>('');
  const [showPrint, setShowPrint] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<keyof PatientData>>(new Set());

  /** CONFIGURAÇÕES */
  const { data: institutionSettings } = trpc.settings.get.useQuery();

  /** Memo toxicidade */
  const toxicityFactor = useMemo(() => {
    return getDoseAdjustmentFactor(toxicities);
  }, [JSON.stringify(toxicities)]);

  /** REFS PARA EVITAR RE-CÁLCULOS INDESEJADOS */
  const lastCalculatedValuesRef = useRef('');
  const lastCalculatedDrugsRef = useRef('');

  /** EFFECT 1 — CALCULAR BSA/EGRF SOMENTE QUANDO CAMPOS CENTRAIS MUDAM */
  useEffect(() => {
    const core = {
      age: patientData.age,
      sex: patientData.sex,
      weight: patientData.weight,
      height: patientData.height,
      creatinine: patientData.creatinine
    };

    // Validar campos obrigatórios
    const errors = new Set<keyof PatientData>();
    if (!core.weight || core.weight <= 0) errors.add('weight');
    if (!core.height || core.height <= 0) errors.add('height');
    if (!core.creatinine || core.creatinine <= 0) errors.add('creatinine');

    if (errors.size > 0) {
      setValidationErrors(errors);
      // Não calcular se houver erros
      if (calculatedValues) {
        setCalculatedValues(null);
      }
      return;
    }

    // Limpar erros se tudo estiver OK
    setValidationErrors(new Set());

    if (
      core.age > 0 &&
      core.weight > 0 &&
      core.height > 0 &&
      core.creatinine > 0
    ) {
      const values = calculatePatientValues(patientData);
      const serialized = JSON.stringify(values);

      if (serialized !== lastCalculatedValuesRef.current) {
        lastCalculatedValuesRef.current = serialized;
        setCalculatedValues(values);
      }
    } else {
      setCalculatedValues(null);
      lastCalculatedValuesRef.current = '';
    }
  }, [
    patientData.age,
    patientData.sex,
    patientData.weight,
    patientData.height,
    patientData.creatinine,
  ]);

  /** Memo antieméticos */
  const antiemetics = useMemo(() => {
    if (!selectedProtocol) return null;
    return generateAntiemeticProphylaxis(selectedProtocol.emetogenicRisk);
  }, [selectedProtocol?.emetogenicRisk]);

  /** EFFECT 2 — CALCULAR DOSES QUANDO O NECESSÁRIO */
  useEffect(() => {
    if (!selectedProtocol || !calculatedValues) {
      if (lastCalculatedDrugsRef.current !== '') {
        lastCalculatedDrugsRef.current = '';
        setCalculatedDrugs([]);
      }
      return;
    }

    const drugs = selectedProtocol.drugs.map(drug => {
      const baseDose = calculateDrugDose(
        drug.dose,
        drug.doseUnit,
        calculatedValues.bsa,
        patientData.weight,
        calculatedValues.globalAdjustmentFactor,
        drug.maxDose,
        calculatedValues.egfr
      );

      return {
        ...drug,
        calculatedDose: baseDose * toxicityFactor
      };
    });

    const serialized = JSON.stringify(drugs);
    if (serialized !== lastCalculatedDrugsRef.current) {
      lastCalculatedDrugsRef.current = serialized;
      setCalculatedDrugs(drugs);
    }
  }, [
    selectedProtocol?.id,
    calculatedValues?.bsa,
    calculatedValues?.egfr,
    calculatedValues?.globalAdjustmentFactor,
    toxicityFactor
  ]);

  /** AJUSTE MANUAL DE DOSE */
  const handleDoseChange = (index: number, newDose: number) => {
    setCalculatedDrugs(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], calculatedDose: newDose };
      toast.success(`Dose ajustada: ${clone[index].name} → ${newDose.toFixed(1)} mg`);
      return clone;
    });
  };

  /** IMPRESSÃO — carrega PrintablePrescription somente aqui */
  const handlePrint = () => {
    if (!selectedProtocol || !calculatedValues) {
      toast.error('Preencha todos os dados antes de imprimir');
      return;
    }

    // Avisar se configurações não estão preenchidas
    if (!institutionSettings?.institutionName || !institutionSettings?.prescriberName) {
      toast.warning('Configure os dados institucionais em Configurações para personalizar a impressão');
    }

    setShowPrint(true);
    setTimeout(() => window.print(), 80);
  };

  /** EXPORTAR PDF */
  const handleExportPDF = async () => {
    if (!selectedProtocol || !calculatedValues) {
      toast.error('Preencha todos os dados antes de exportar o PDF');
      return;
    }

    // Avisar se configurações não estão preenchidas
    if (!institutionSettings?.institutionName || !institutionSettings?.prescriberName) {
      toast.warning('Configure os dados institucionais em Configurações para personalizar o PDF');
    }

    try {
      await generatePrescriptionPDF({
        patient: patientData,
        calculatedValues,
        protocol: selectedProtocol,
        cycle: selectedCycle,
        drugs: calculatedDrugs,
        antiemetics: antiemetics!,
      });

      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF.');
    }
  };

  /** SALVAR */
  const createPatientMutation = trpc.patients.create.useMutation();
  const savePrescriptionMutation = trpc.prescriptions.create.useMutation();

  const handleSaveToHistory = async () => {
    if (!selectedProtocol || !calculatedValues || !patientData.name) {
      toast.error('Preencha todos os dados antes de salvar');
      return;
    }

    try {
      const patient = await createPatientMutation.mutateAsync({
        name: patientData.name,
        age: patientData.age,
        sex: patientData.sex,
        weight: patientData.weight,
        height: patientData.height,
        creatinine: patientData.creatinine,
        bilirubin: patientData.bilirubin,
        ecog: patientData.ecog,
        comorbidities: patientData.comorbidities || undefined,
      });

      const prescription = await savePrescriptionMutation.mutateAsync({
        patientId: patient.id,
        patientName: patientData.name,
        protocolName: selectedProtocol.name,
        cycle: selectedCycle,
        bsa: calculatedValues.bsa,
        egfr: calculatedValues.egfr,
        renalStatus: calculatedValues.renalStatus,
        prescriptionData: {
          patientData,
          protocol: selectedProtocol,
          cycle: selectedCycle,
          calculatedValues,
          calculatedDrugs,
          antiemetics,
          toxicities,
          adjustmentFactor: getDoseAdjustmentFactor(toxicities)
        },
      });

      setPrescriptionId(prescription.prescriptionId);
      toast.success(`Prescrição salva! ID: ${prescription.prescriptionId}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar.');
    }
  };

  /** COPY PRESCRIPTION (texto) */
  const handleCopyPrescription = () => {
    if (!selectedProtocol || !calculatedValues) {
      toast.error('Preencha todos os dados antes de copiar');
      return;
    }

    let text = `PRESCRIÇÃO DE QUIMIOTERAPIA\n\n`;
    text += `Paciente: ${patientData.name}\n`;
    text += `Idade: ${patientData.age} anos | Sexo: ${patientData.sex}\n`;
    text += `Peso: ${patientData.weight} kg | Altura: ${patientData.height} cm\n`;
    text += `SC: ${calculatedValues.bsa.toFixed(2)} m² | eGFR: ${calculatedValues.egfr.toFixed(1)}\n\n`;

    text += `PROTOCOLO: ${selectedProtocol.name}\nCiclo: ${selectedCycle}/${selectedProtocol.cycles}\n`;
    text += `Indicação: ${selectedProtocol.indication}\n\n`;

    text += `DROGAS:\n`;
    calculatedDrugs.forEach(d => {
      text += `• ${d.name}: ${d.calculatedDose?.toFixed(1)} mg ${d.route} (Dias ${d.days})\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success('Prescrição copiada!');
  };

  return (
    <div className="min-h-screen bg-background">

      {/** HEADER */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Calculadora de Prescrição Quimioterápica</h1>
              <p className="text-muted-foreground">
                Hematologia • Oncologia • Terapia Celular
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="destructive" 
                onClick={() => setShowEmergency(true)}
                className="bg-red-600 hover:bg-red-700 font-bold"
              >
                <AlertCircle className="h-4 w-4 mr-2" /> 🚨 EMERGÊNCIA
              </Button>
              <PatientHistoryDB onLoadPatient={(patientData, prescriptionData) => {
                // Usar dados do paciente já corrigidos (creatinina/bilirrubina divididos por 100)
                setPatientData(patientData);
                
                // Se houver dados de prescrição, restaurar protocolo e doses
                // IMPORTANTE: NÃO restaurar prescriptionData.patientData pois pode ter valores brutos
                if (prescriptionData) {
                  // Restaurar protocolo selecionado
                  if (prescriptionData.protocol) {
                    setSelectedProtocol(prescriptionData.protocol);
                  }
                  
                  // Restaurar ciclo
                  if (prescriptionData.cycle) {
                    setSelectedCycle(prescriptionData.cycle);
                  }
                  
                  // Restaurar drogas calculadas
                  if (prescriptionData.calculatedDrugs) {
                    setCalculatedDrugs(prescriptionData.calculatedDrugs);
                  }
                  
                  // Restaurar toxicidades
                  if (prescriptionData.toxicities) {
                    setToxicities(prescriptionData.toxicities);
                  }
                }
              }} />
              <Button variant="outline" onClick={handleSaveToHistory}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
              <Button variant="outline" onClick={() => setLocation('/settings')}>
                <SettingsIcon className="h-4 w-4 mr-2" /> Configurações
              </Button>
              <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button onClick={handleCopyPrescription}>
                <Copy className="h-4 w-4 mr-2" /> Copiar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/** MAIN */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/** COLUNA 1 */}
          <div className="space-y-6 lg:col-span-1">
            <PatientForm 
              data={patientData} 
              onChange={handlePatientChange} 
              validationErrors={validationErrors}
            />

            <ProtocolSelector
              selectedProtocol={selectedProtocol}
              selectedCycle={selectedCycle}
              onProtocolChange={setSelectedProtocol}
              onCycleChange={setSelectedCycle}
            />
          </div>

          {/** COLUNA 2 - RESULTADOS */}
          <div className="space-y-6 lg:col-span-2">
            {calculatedValues && (
              <CalculatedValuesDisplay values={calculatedValues} />
            )}

            <DrugsTable drugs={calculatedDrugs} onDoseChange={handleDoseChange} />

            <ProphylaxisAlerts protocol={selectedProtocol} antiemetics={antiemetics} />

            <DilutionInfo drugs={calculatedDrugs} />

            <ToxicityAssessment
              toxicities={toxicities}
              onToxicityChange={(tox, grade) =>
                setToxicities(prev => ({ ...prev, [tox]: grade }))
              }
            />

            {/* Predição de Toxicidade com IA */}
            <ToxicityPredictionWithMetrics
              patientData={patientData}
              protocol={selectedProtocol}
            />
          </div>

        </div>
      </main>

      {/** IMPRESSÃO — SOMENTE QUANDO NECESSÁRIO */}
      {showPrint && selectedProtocol && calculatedValues && antiemetics && (
        <Suspense fallback={<div className="print:hidden">Preparando impressão...</div>}>
          <PrintablePrescription
            patient={patientData}
            calculatedValues={calculatedValues}
            protocol={selectedProtocol}
            cycle={selectedCycle}
            drugs={calculatedDrugs}
            antiemetics={antiemetics}
            prescriptionId={prescriptionId}
            institutionName={institutionSettings?.institutionName ?? undefined}
            institutionLogo={institutionSettings?.institutionLogo ?? undefined}
            prescriberName={institutionSettings?.prescriberName ?? undefined}
            prescriberCRM={institutionSettings?.prescriberCRM ?? undefined}
          />
        </Suspense>
      )}

      {/** MODAL DE EMERGÊNCIA */}
      <EmergencyModal 
        open={showEmergency} 
        onOpenChange={setShowEmergency}
        patientData={calculatedValues ? {
          name: patientData.name,
          age: patientData.age,
          sex: patientData.sex,
          weight: patientData.weight,
          height: patientData.height,
          bsa: calculatedValues.bsa,
          egfr: calculatedValues.egfr,
          creatinine: patientData.creatinine
        } : null}
      />
    </div>
  );
}
