import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PatientForm from '@/components/PatientForm';
import CalculatedValuesDisplay from '@/components/CalculatedValues';
import ProtocolSelector from '@/components/ProtocolSelector';
import DrugsTable from '@/components/DrugsTable';
import ProphylaxisAlerts from '@/components/ProphylaxisAlerts';
import type { PatientData, Protocol, Drug, CalculatedValues } from '@/types/calculator';
import { calculatePatientValues, calculateDrugDose } from '@/lib/calculations';
import { generateAntiemeticProphylaxis } from '@/lib/antiemetics';
import { FileDown, Copy } from 'lucide-react';

export default function Calculator() {
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

  // Recalcular doses quando protocolo ou valores calculados mudarem
  useEffect(() => {
    if (selectedProtocol && calculatedValues) {
      const drugsWithCalculatedDoses = selectedProtocol.drugs.map((drug) => ({
        ...drug,
        calculatedDose: calculateDrugDose(
          drug.dose,
          drug.doseUnit,
          calculatedValues.bsa,
          patientData.weight,
          calculatedValues.globalAdjustmentFactor
        ),
      }));
      setCalculatedDrugs(drugsWithCalculatedDoses);
    } else {
      setCalculatedDrugs([]);
    }
  }, [selectedProtocol, calculatedValues, patientData.weight]);

  const handleExportPDF = () => {
    toast.info('Funcionalidade de exportação PDF em desenvolvimento');
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
      prescription += `• ${drug.name}: ${drug.calculatedDose.toFixed(1)} mg ${drug.route} - Dias ${drug.days}\n`;
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Calculadora de Prescrição Quimioterápica
              </h1>
              <p className="text-muted-foreground mt-1">
                Hematologia e Oncologia - Cálculos automáticos de dose e profilaxias
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleExportPDF} disabled>
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
            <DrugsTable drugs={calculatedDrugs} />
            <ProphylaxisAlerts protocol={selectedProtocol} antiemetics={antiemetics} />
          </div>
        </div>
      </main>
    </div>
  );
}
