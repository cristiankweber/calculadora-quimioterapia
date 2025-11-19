/**
 * Dados de diluição e administração baseados na tabela CMI/HCPA
 * Última atualização: 11/05/18
 */

export interface DilutionInfo {
  drugName: string;
  maxConcentration?: {
    value: number;
    unit: 'mg/mL' | 'UI/mL' | 'mcg/mL';
    diluent?: 'SF' | 'SG' | 'SF ou SG';
  };
  minVolume?: number; // mL
  diluents: ('SF' | 'SG' | 'AD')[];
  pvcCompatible: boolean;
  specialEquipment?: 'LPVC' | 'FS' | 'Filtro';
  infusionTime?: {
    min?: number; // minutos
    max?: number; // minutos
    standard?: number; // minutos (tempo padrão)
    notes?: string;
  };
  stability: {
    room?: string; // TA
    refrigerated?: string; // R
    syringe?: string;
    bag?: string;
  };
  ph?: string;
  photosensitive?: boolean;
  specialAlerts?: string[];
}

export const dilutionDatabase: Record<string, DilutionInfo> = {
  'Doxorrubicina': {
    drugName: 'Doxorrubicina',
    maxConcentration: {
      value: 2,
      unit: 'mg/mL',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    specialEquipment: 'FS',
    infusionTime: {
      min: 30,
      max: 120,
      standard: 60,
      notes: 'Infusão lenta para reduzir cardiotoxicidade',
    },
    stability: {
      refrigerated: '48h',
      syringe: '48h',
      bag: '48h',
    },
    ph: '1,3-5',
    photosensitive: true,
    specialAlerts: [
      'Fotossensível - proteger da luz',
      'Vesicante - cuidado com extravasamento',
      'Usar equipo fotossensível',
    ],
  },
  'Ciclofosfamida': {
    drugName: 'Ciclofosfamida',
    maxConcentration: {
      value: 20,
      unit: 'mg/mL',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    infusionTime: {
      min: 30,
      max: 120,
      standard: 60,
    },
    stability: {
      refrigerated: '48h',
      syringe: '48h',
      bag: '48h',
    },
    ph: '2,3-6',
    specialAlerts: [
      'Hidratação adequada obrigatória',
      'Monitorar diurese',
    ],
  },
  'Vincristina': {
    drugName: 'Vincristina',
    maxConcentration: {
      value: 1,
      unit: 'mg/mL',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    infusionTime: {
      min: 5,
      max: 10,
      standard: 10,
      notes: 'Dose ≤1 mg: seringa não SF - 10min',
    },
    stability: {
      refrigerated: '48h',
      syringe: '48h',
      bag: '48h',
    },
    ph: '1,3-6',
    specialAlerts: [
      'NUNCA administrar via intratecal - FATAL',
      'Vesicante - cuidado com extravasamento',
      'Dose máxima 2 mg',
    ],
  },
  'Carboplatina': {
    drugName: 'Carboplatina',
    maxConcentration: {
      value: 6,
      unit: 'mg/mL',
      diluent: 'SG',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    infusionTime: {
      min: 30,
      max: 60,
      standard: 60,
    },
    stability: {
      room: '48h',
      bag: '48h',
    },
    ph: '2,4-6,7',
    specialAlerts: [
      'Conc. máx em SG: 6 mg/mL',
      'Conc. máx em SF: 2 mg/mL',
      'Preferir SG para concentrações maiores',
    ],
  },
  'Rituximabe': {
    drugName: 'Rituximabe',
    maxConcentration: {
      value: 4,
      unit: 'mg/mL',
    },
    minVolume: 250,
    diluents: ['SF'],
    pvcCompatible: true,
    infusionTime: {
      min: 120,
      max: 360,
      standard: 240,
      notes: 'Primeira infusão: iniciar 50 mg/h, aumentar gradualmente',
    },
    stability: {
      refrigerated: '7 dias',
      bag: '24h',
    },
    ph: '3,6',
    specialAlerts: [
      'Pré-medicação obrigatória',
      'Monitorar reações infusionais',
      'Primeira dose: iniciar lentamente',
    ],
  },
  'Citarabina': {
    drugName: 'Citarabina (Ara-C)',
    minVolume: 50,
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    infusionTime: {
      min: 30,
      max: 180,
      standard: 120,
      notes: 'Alta dose: infusão 1-3h',
    },
    stability: {
      room: '24h',
      bag: '48h',
    },
    ph: '4,6',
    specialAlerts: [
      'Alta dose: colírio de dexametasona obrigatório',
      'Iniciar colírio 6h antes da infusão',
      'IT (intratecal): estabilidade 6h TA',
    ],
  },
  'Etoposídeo': {
    drugName: 'Etoposídeo',
    maxConcentration: {
      value: 0.4,
      unit: 'mg/mL',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: false,
    specialEquipment: 'LPVC',
    infusionTime: {
      min: 30,
      max: 240,
      standard: 60,
      notes: 'Infusão lenta para evitar hipotensão',
    },
    stability: {
      refrigerated: '48h',
      bag: '48h',
    },
    ph: '2-4,6',
    specialAlerts: [
      'Usar equipo livre de PVC (LPVC)',
      'Infusão rápida pode causar hipotensão',
      'Precipita em concentrações altas',
    ],
  },
  'Ifosfamida': {
    drugName: 'Ifosfamida',
    maxConcentration: {
      value: 20,
      unit: 'mg/mL',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    infusionTime: {
      min: 60,
      max: 1440,
      standard: 120,
      notes: 'Pode ser infusão contínua 24h',
    },
    stability: {
      refrigerated: '48h',
      bag: '48h',
    },
    ph: '2,3-6',
    specialAlerts: [
      'MESNA obrigatório para proteção vesical',
      'Hidratação vigorosa',
      'Monitorar função renal',
    ],
  },
  'Paclitaxel': {
    drugName: 'Paclitaxel',
    maxConcentration: {
      value: 1.2,
      unit: 'mg/mL',
    },
    minVolume: 250,
    diluents: ['SF', 'SG'],
    pvcCompatible: false,
    specialEquipment: 'Filtro',
    infusionTime: {
      min: 60,
      max: 180,
      standard: 180,
    },
    stability: {
      refrigerated: '48h',
      bag: '27h',
    },
    ph: '2,4-6',
    specialAlerts: [
      'Usar equipo com filtro inline',
      'Pré-medicação obrigatória (corticoides, anti-histamínicos)',
      'Monitorar reações de hipersensibilidade',
    ],
  },
  'Gencitabina': {
    drugName: 'Gencitabina',
    minVolume: 50,
    diluents: ['SF'],
    pvcCompatible: true,
    infusionTime: {
      min: 30,
      max: 30,
      standard: 30,
      notes: 'Infusão fixa em 30 minutos',
    },
    stability: {
      room: '48h',
      bag: '48h',
    },
    ph: '2,4-6',
    specialAlerts: [
      'Tempo de infusão fixo: 30 minutos',
      'Não prolongar infusão (aumenta toxicidade)',
    ],
  },
  'Metotrexato': {
    drugName: 'Metotrexato',
    maxConcentration: {
      value: 25,
      unit: 'mg/mL',
    },
    diluents: ['SF', 'SG'],
    pvcCompatible: true,
    specialEquipment: 'FS',
    infusionTime: {
      min: 30,
      max: 240,
      standard: 120,
      notes: 'Alta dose: infusão 2-4h',
    },
    stability: {
      refrigerated: '48h',
      bag: '48h',
    },
    ph: '4,6',
    photosensitive: true,
    specialAlerts: [
      'Alta dose: hidratação + alcalinização urinária',
      'Leucovorin rescue obrigatório',
      'Monitorar metotrexatemia',
      'Fotossensível',
    ],
  },
  'Bortezomibe': {
    drugName: 'Bortezomibe',
    diluents: ['SF'],
    pvcCompatible: false,
    specialEquipment: 'LPVC',
    infusionTime: {
      min: 3,
      max: 5,
      standard: 5,
      notes: 'Push IV em 3-5 segundos ou SC',
    },
    stability: {
      room: '5 dias',
      syringe: '48h',
      refrigerated: '48h',
    },
    ph: '3,6',
    specialAlerts: [
      'Pode ser administrado SC (preferível)',
      'Push IV: 3-5 segundos',
      'Usar equipo livre de PVC',
    ],
  },
};

/**
 * Busca informações de diluição por nome da droga
 */
export function getDilutionInfo(drugName: string): DilutionInfo | undefined {
  // Busca exata
  if (dilutionDatabase[drugName]) {
    return dilutionDatabase[drugName];
  }

  // Busca parcial (case-insensitive)
  const normalizedName = drugName.toLowerCase();
  for (const [key, value] of Object.entries(dilutionDatabase)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return value;
    }
  }

  return undefined;
}
