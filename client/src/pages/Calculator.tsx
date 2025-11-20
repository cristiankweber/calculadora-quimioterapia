import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PatientForm from '@/components/PatientForm';
import CalculatedValuesDisplay from '@/components/CalculatedValues';
import ProtocolSelector from '@/components/ProtocolSelector';
import DrugsTable from '@/components/DrugsTable';
import ProphylaxisAlerts from '@/components/ProphylaxisAlerts';
import DilutionInfo from '@/components/DilutionInfo';
import type { PatientData, Protocol, Drug, CalculatedValues } from '@/types/calculator';
import { calculatePatientValues, calculateDrugDose } from '@/lib/calculations';
import { generateAntiemeticProphylaxis } from '@/lib/antiemetics';
import { FileDown, Copy, Save, History, Printer, Settings as SettingsIcon } from 'lucide-react';
import { generatePrescriptionPDF } from '@/lib/pdfGenerator';
import { savePatientHistory } from '@/lib/patientHistory';
import PatientHistoryDB from '@/components/PatientHistoryDB';
import { trpc } from '@/lib/trpc';
import ToxicityAssessment from '@/components/ToxicityAssessment';
import type { ToxicityGrade } from '@/data/ctcae';
import { getDoseAdjustmentFactor } from '@/data/ctcae';
import PrintablePrescription from '@/components/PrintablePrescrip tion';

export default function Calculator() {
  const [, setLocation] = useLocation();
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

  const [calculatedValues, setCalculatedValues] = useState<CalculatedValues | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [calculatedDrugs, setCalculatedDrugs] = useState<Drug[]>([]);
  const [toxicities, setToxicities] = useState<Record<string, ToxicityGrade>>({});
    const [prescriptionId, setPrescriptionId] = useState<string>('');
  
  // Carregar configurações institucionais
  const { data: institutionSettings } = trpc.settings.get.useQuery();

  // Recalcular valores quando dados do paciente mudarem
  useEffect(() => {
    if (
      patientData.weight > 0 &&
      patientData.height > 0 &&
      patientData.creatinine > 0 &&
      patientData.age > 0
    ) {
      const values = calculatePatientValues(patientData);
      setCalculatedValues(values);
    }
  }, [patientData]);

  // Recalcular doses quando protocolo, valores calculados ou toxicidades mudarem
  useEffect(() => {
    if (selectedProtocol && calculatedValues) {
      // Calcular fator de ajuste por toxicidade
      const toxicityFactor = getDoseAdjustmentFactor(toxicities);

      const drugsWithCalculatedDoses = selectedProtocol.drugs.map((drug) => {
        const baseDose = calculateDrugDose(
          drug.dose,
          drug.doseUnit,
          calculatedValues.bsa,
          patientData.weight,
          calculatedValues.globalAdjustmentFactor,
          drug.maxDose,
          calculatedValues.egfr
        );
        // Aplicar ajuste de toxicidade
        const finalDose = baseDose * toxicityFactor;
        return {
          ...drug,
          calculatedDose: finalDose,
        };
      });
      setCalculatedDrugs(drugsWithCalculatedDoses);
    } else {
      setCalculatedDrugs([]);
    }
  }, [selectedProtocol, calculatedValues, patientData.weight, toxicities]);

  const handleDoseChange = (index: number, newDose: number) => {
    const updatedDrugs = [...calculatedDrugs];
    updatedDrugs[index] = { ...updatedDrugs[index], calculatedDose: newDose };
    setCalculatedDrugs(updatedDrugs);
    toast.success(`Dose de ${updatedDrugs[index].name} ajustada para ${newDose.toFixed(1)} mg`);
  };

  const handlePrint = () => {
    if (!selectedProtocol || !calculatedValues) {
      toast.error('Preencha todos os dados antes de imprimir');
      return;
    }
    window.print();
  };

  const handleExportPDF = async () => {
    if (!selectedProtocol || !calculatedValues) {
      toast.error('Preencha todos os dados antes de exportar o PDF');
      return;
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
      toast.success('PDF gerado com sucesso! Use Ctrl+P ou Cmd+P para salvar.');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const savePrescriptionMutation = trpc.prescriptions.create.useMutation();
  const createPatientMutation = trpc.patients.create.useMutation();

  const handleSaveToHistory = async () => {
    if (!selectedProtocol || !calculatedValues || !patientData.name) {
      toast.error('Preencha todos os dados antes de salvar');
      return;
    }

    try {
      // Primeiro, garantir que o paciente existe no banco
      const patientResponse = await createPatientMutation.mutateAsync({
        name: patientData.name,
        age: patientData.age,
        sex: patientData.sex,
        weight: patientData.weight,
        height: patientData.height,
        creatinine: Math.round(patientData.creatinine * 100),
        bilirubin: Math.round(patientData.bilirubin * 100),
        ecog: patientData.ecog,
        comorbidities: patientData.comorbidities || undefined,
      });

      // Preparar dados completos da prescrição
      const prescriptionData = {
        patientData,
        protocol: selectedProtocol,
        cycle: selectedCycle,
        calculatedValues,
        calculatedDrugs,
        antiemetics,
        toxicities,
        adjustmentFactor: getDoseAdjustmentFactor(toxicities),
      };

      // Salvar prescrição no banco
      const prescription = await savePrescriptionMutation.mutateAsync({
        patientId: patientResponse.id,
        patientName: patientData.name,
        protocolName: selectedProtocol.name,
        cycle: selectedCycle,
        bsa: calculatedValues.bsa,
        egfr: calculatedValues.egfr,
        renalStatus: calculatedValues.renalStatus,
        prescriptionData,
      });
      
      setPrescriptionId(prescription.prescriptionId);
      toast.success(`Prescrição salva! ID: ${prescription.prescriptionId}`);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar prescrição');
    }
  };

  const handleCopyPrescription = () => {
    if (!selectedProtocol || !calculatedValues) {
      toast.error('Preencha todos os dados antes de copiar a prescrição');
      return;
    }

    let prescription = `PRESCRIÇÃO DE QUIMIOTERAPIA\n\n`;
    prescription += `Paciente: ${patientData.name}\n`;
    prescription += `Idade: ${patientData.age} anos | Sexo: ${patientData.sex === 'M' ? 'Masculino' : 'Feminino'}\n`;
    prescription += `Peso: ${patientData.weight} kg | Altura: ${patientData.height} cm\n`;
    prescription += `SC: ${calculatedValues.bsa.toFixed(2)} m² | eGFR: ${calculatedValues.egfr.toFixed(1)} mL/min\n`;
    prescription += `ECOG: ${patientData.ecog}\n\n`;

    prescription += `PROTOCOLO: ${selectedProtocol.name} - Ciclo ${selectedCycle}\n`;
    prescription += `Indicação: ${selectedProtocol.indication}\n\n`;

    prescription += `DROGAS:\n`;
    calculatedDrugs.forEach((drug) => {
      prescription += `• ${drug.name}: ${(drug.calculatedDose || 0).toFixed(1)} mg ${drug.route} - Dias ${drug.days}\n`;
      if (drug.observations) {
        prescription += `  Obs: ${drug.observations}\n`;
      }
    });

    prescription += `\nPROFILAXIAS:\n`;
    selectedProtocol.prophylaxis.forEach((p) => {
      prescription += `• ${p}\n`;
    });

    const antiemetics = generateAntiemeticProphylaxis(selectedProtocol.emetogenicRisk);
    prescription += `\nANTIEMÉTICOS (Risco ${antiemetics.risk}):\n`;
    prescription += `Dia 1:\n`;
    antiemetics.day1.forEach((a) => {
      prescription += `• ${a}\n`;
    });

    prescription += `\nCUIDADOS DE ENFERMAGEM:\n`;
    selectedProtocol.nursingCare.forEach((c) => {
      prescription += `• ${c}\n`;
    });

    if (selectedProtocol.specialAlerts.length > 0) {
      prescription += `\n⚠️ ALERTAS ESPECIAIS:\n`;
      selectedProtocol.specialAlerts.forEach((a) => {
        prescription += `• ${a}\n`;
      });
    }

    navigator.clipboard.writeText(prescription);
    toast.success('Prescrição copiada para a área de transferência!');
  };

  const antiemetics = selectedProtocol
    ? generateAntiemeticProphylaxis(selectedProtocol.emetogenicRisk)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Calculadora de Prescrição Quimioterápica
              </h1>
              <p className="text-muted-foreground mt-1">
                Hematologia e Oncologia - Cálculos automáticos de dose e profilaxias
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PatientHistoryDB onLoadPatient={setPatientData} />
              <Button variant="outline" onClick={handleSaveToHistory}>
                <Save className="h-4 w-4 mr-2" />
                Salvar no Histórico
              </Button>
              <Button variant="outline" onClick={() => setLocation('/settings')}>
                <SettingsIcon className="h-4 w-4 mr-2" />
                Configurações
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={handleCopyPrescription}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Prescrição
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda - Entrada de Dados */}
          <div className="lg:col-span-1 space-y-6">
            <PatientForm data={patientData} onChange={setPatientData} />
            <ProtocolSelector
              selectedProtocol={selectedProtocol}
              selectedCycle={selectedCycle}
              onProtocolChange={setSelectedProtocol}
              onCycleChange={setSelectedCycle}
            />
          </div>

          {/* Coluna Direita - Resultados */}
          <div className="lg:col-span-2 space-y-6">
            {calculatedValues && <CalculatedValuesDisplay values={calculatedValues} />}
            <DrugsTable drugs={calculatedDrugs} onDoseChange={handleDoseChange} />
            <ProphylaxisAlerts protocol={selectedProtocol} antiemetics={antiemetics} />
            <DilutionInfo drugs={calculatedDrugs} />

            {/* Avaliação de Toxicidade */}
            <ToxicityAssessment
              toxicities={toxicities}
              onToxicityChange={(toxicity, grade) => {
                setToxicities((prev) => ({
                  ...prev,
                  [toxicity]: grade,
                }));
              }}
            />
          </div>
        </div>
      </main>

      {/* Versão para Impressão */}
      {selectedProtocol && calculatedValues && antiemetics && (
        <PrintablePrescription
          patient={patientData}
          calculatedValues={calculatedValues}
          protocol={selectedProtocol}
          cycle={selectedCycle}
          drugs={calculatedDrugs}
          antiemetics={antiemetics}
          prescriptionId={prescriptionId}
          institutionName={institutionSettings?.institutionName || undefined}
          institutionLogo={institutionSettings?.institutionLogo || undefined}
          prescriberName={institutionSettings?.prescriberName || undefined}
          prescriberCRM={institutionSettings?.prescriberCRM || undefined}
        />
      )}
    </div>
  );
}
