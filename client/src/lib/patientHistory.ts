import type { PatientData } from '@/types/calculator';

export interface PatientHistoryEntry {
  id: string;
  timestamp: number;
  patient: PatientData;
  protocol: string;
  cycle: number;
  drugs: Array<{
    name: string;
    dose: number;
    date: string;
  }>;
}

export interface CumulativeDose {
  drugName: string;
  totalDose: number;
  entries: Array<{
    dose: number;
    date: string;
    protocol: string;
  }>;
}

const STORAGE_KEY = 'chemo_calculator_patient_history';

// Salvar histórico de prescrição
export function savePatientHistory(entry: Omit<PatientHistoryEntry, 'id' | 'timestamp'>): PatientHistoryEntry {
  const history = getPatientHistory();
  
  const newEntry: PatientHistoryEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };
  
  history.push(newEntry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  
  return newEntry;
}

// Obter todo o histórico
export function getPatientHistory(): PatientHistoryEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    return [];
  }
}

// Buscar histórico de um paciente específico
export function getPatientHistoryByName(name: string): PatientHistoryEntry[] {
  const history = getPatientHistory();
  return history.filter(entry => 
    entry.patient.name.toLowerCase().includes(name.toLowerCase())
  ).sort((a, b) => b.timestamp - a.timestamp);
}

// Calcular doses cumulativas de um paciente
export function calculateCumulativeDoses(patientName: string): CumulativeDose[] {
  const history = getPatientHistoryByName(patientName);
  const doseMap = new Map<string, CumulativeDose>();
  
  history.forEach(entry => {
    entry.drugs.forEach(drug => {
      const existing = doseMap.get(drug.name);
      
      if (existing) {
        existing.totalDose += drug.dose;
        existing.entries.push({
          dose: drug.dose,
          date: drug.date,
          protocol: entry.protocol,
        });
      } else {
        doseMap.set(drug.name, {
          drugName: drug.name,
          totalDose: drug.dose,
          entries: [{
            dose: drug.dose,
            date: drug.date,
            protocol: entry.protocol,
          }],
        });
      }
    });
  });
  
  return Array.from(doseMap.values()).sort((a, b) => 
    b.totalDose - a.totalDose
  );
}

// Verificar cardiotoxicidade por antraciclinas
export function checkCardiotoxicityRisk(patientName: string): {
  drug: string;
  totalDose: number;
  limit: number;
  percentage: number;
  risk: 'safe' | 'warning' | 'danger';
}[] {
  const cumulativeDoses = calculateCumulativeDoses(patientName);
  
  const anthracyclines = [
    { name: 'doxorrubicina', limit: 450 },
    { name: 'daunorrubicina', limit: 550 },
    { name: 'epirrubicina', limit: 900 },
    { name: 'idarrubicina', limit: 150 },
  ];
  
  const results: {
    drug: string;
    totalDose: number;
    limit: number;
    percentage: number;
    risk: 'safe' | 'warning' | 'danger';
  }[] = [];
  
  anthracyclines.forEach(anthra => {
    const dose = cumulativeDoses.find(d => 
      d.drugName.toLowerCase().includes(anthra.name)
    );
    
    if (dose) {
      const percentage = (dose.totalDose / anthra.limit) * 100;
      let risk: 'safe' | 'warning' | 'danger' = 'safe';
      
      if (percentage >= 100) {
        risk = 'danger';
      } else if (percentage >= 80) {
        risk = 'warning';
      }
      
      results.push({
        drug: dose.drugName,
        totalDose: dose.totalDose,
        limit: anthra.limit,
        percentage,
        risk,
      });
    }
  });
  
  return results;
}

// Deletar entrada do histórico
export function deleteHistoryEntry(id: string): void {
  const history = getPatientHistory();
  const filtered = history.filter(entry => entry.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// Limpar todo o histórico
export function clearAllHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Exportar histórico como JSON
export function exportHistoryAsJSON(): string {
  const history = getPatientHistory();
  return JSON.stringify(history, null, 2);
}

// Importar histórico de JSON
export function importHistoryFromJSON(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      localStorage.setItem(STORAGE_KEY, jsonString);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao importar histórico:', error);
    return false;
  }
}

// Gerar ID único
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
