import { DilutionInfo } from '../data/dilutionData';

export interface DilutionCalculationResult {
  drugName: string;
  calculatedDose: number; // mg
  recommendedVolume: number; // mL
  finalConcentration: number; // mg/mL
  infusionRate: number; // mL/h
  infusionTime: number; // minutos
  diluent: string;
  warnings: string[];
  specialInstructions: string[];
}

/**
 * Calcula volume de diluição baseado na dose e concentração máxima
 */
export function calculateDilutionVolume(
  dose: number, // mg
  dilutionInfo: DilutionInfo
): { volume: number; concentration: number; warnings: string[] } {
  const warnings: string[] = [];
  let volume = 0;

  if (dilutionInfo.maxConcentration) {
    // Calcular volume mínimo baseado na concentração máxima
    volume = dose / dilutionInfo.maxConcentration.value;
    
    // Arredondar para cima para volumes práticos (50, 100, 250, 500, 1000 mL)
    const practicalVolumes = [50, 100, 250, 500, 1000];
    volume = practicalVolumes.find(v => v >= volume) || Math.ceil(volume / 100) * 100;
  } else if (dilutionInfo.minVolume) {
    // Usar volume mínimo se não houver concentração máxima definida
    volume = dilutionInfo.minVolume;
  } else {
    // Volume padrão: 100 mL para doses pequenas, 250 mL para doses maiores
    volume = dose < 100 ? 100 : 250;
    warnings.push('Volume calculado baseado em prática padrão (sem dados CMI específicos)');
  }

  // Verificar se atende ao volume mínimo
  if (dilutionInfo.minVolume && volume < dilutionInfo.minVolume) {
    volume = dilutionInfo.minVolume;
    warnings.push(`Volume ajustado para mínimo recomendado: ${dilutionInfo.minVolume} mL`);
  }

  const finalConcentration = dose / volume;

  // Verificar se concentração está dentro do limite
  if (dilutionInfo.maxConcentration && finalConcentration > dilutionInfo.maxConcentration.value) {
    warnings.push(
      `Atenção: Concentração ${finalConcentration.toFixed(2)} ${dilutionInfo.maxConcentration.unit} ` +
      `excede máximo recomendado de ${dilutionInfo.maxConcentration.value} ${dilutionInfo.maxConcentration.unit}`
    );
  }

  return {
    volume,
    concentration: finalConcentration,
    warnings,
  };
}

/**
 * Calcula velocidade de infusão (mL/h) baseado no volume e tempo
 */
export function calculateInfusionRate(
  volume: number, // mL
  timeMinutes: number // minutos
): number {
  const timeHours = timeMinutes / 60;
  return Math.round((volume / timeHours) * 10) / 10; // 1 casa decimal
}

/**
 * Calcula tempo de infusão baseado no volume e velocidade
 */
export function calculateInfusionTime(
  volume: number, // mL
  rateMLPerHour: number // mL/h
): number {
  return Math.round((volume / rateMLPerHour) * 60); // retorna em minutos
}

/**
 * Calcula todos os parâmetros de diluição e infusão
 */
export function calculateDilution(
  drugName: string,
  dose: number, // mg
  dilutionInfo: DilutionInfo,
  customInfusionTime?: number // minutos (opcional)
): DilutionCalculationResult {
  const warnings: string[] = [];
  const specialInstructions: string[] = [];

  // Calcular volume de diluição
  const { volume, concentration, warnings: volumeWarnings } = calculateDilutionVolume(dose, dilutionInfo);
  warnings.push(...volumeWarnings);

  // Determinar tempo de infusão
  let infusionTime = customInfusionTime;
  if (!infusionTime && dilutionInfo.infusionTime) {
    infusionTime = dilutionInfo.infusionTime.standard || dilutionInfo.infusionTime.min || 60;
  } else if (!infusionTime) {
    infusionTime = 60; // padrão: 1 hora
    warnings.push('Tempo de infusão padrão: 60 minutos (verificar protocolo)');
  }

  // Validar tempo de infusão
  if (dilutionInfo.infusionTime) {
    if (dilutionInfo.infusionTime.min && infusionTime < dilutionInfo.infusionTime.min) {
      warnings.push(
        `Tempo de infusão abaixo do mínimo recomendado (${dilutionInfo.infusionTime.min} min)`
      );
    }
    if (dilutionInfo.infusionTime.max && infusionTime > dilutionInfo.infusionTime.max) {
      warnings.push(
        `Tempo de infusão acima do máximo recomendado (${dilutionInfo.infusionTime.max} min)`
      );
    }
    if (dilutionInfo.infusionTime.notes) {
      specialInstructions.push(dilutionInfo.infusionTime.notes);
    }
  }

  // Calcular velocidade de infusão
  const infusionRate = calculateInfusionRate(volume, infusionTime);

  // Determinar diluente recomendado
  let diluent = 'SF ou SG';
  if (dilutionInfo.maxConcentration?.diluent) {
    diluent = dilutionInfo.maxConcentration.diluent;
  } else if (dilutionInfo.diluents.length === 1) {
    diluent = dilutionInfo.diluents[0];
  } else if (dilutionInfo.diluents.includes('SF')) {
    diluent = 'SF (preferencial)';
  }

  // Adicionar alertas especiais
  if (dilutionInfo.photosensitive) {
    specialInstructions.push('⚠️ FOTOSSENSÍVEL - Proteger da luz durante preparo e infusão');
  }

  if (!dilutionInfo.pvcCompatible) {
    specialInstructions.push('⚠️ NÃO compatível com PVC - Usar equipo livre de PVC');
  }

  if (dilutionInfo.specialEquipment) {
    const equipmentNames = {
      LPVC: 'Equipo livre de PVC',
      FS: 'Equipo fotossensível (protegido da luz)',
      Filtro: 'Equipo com filtro inline',
    };
    specialInstructions.push(`📋 Usar: ${equipmentNames[dilutionInfo.specialEquipment]}`);
  }

  if (dilutionInfo.specialAlerts) {
    specialInstructions.push(...dilutionInfo.specialAlerts.map(alert => `⚠️ ${alert}`));
  }

  // Informações de estabilidade
  const stabilityInfo: string[] = [];
  if (dilutionInfo.stability.room) {
    stabilityInfo.push(`TA: ${dilutionInfo.stability.room}`);
  }
  if (dilutionInfo.stability.refrigerated) {
    stabilityInfo.push(`Refrigerado: ${dilutionInfo.stability.refrigerated}`);
  }
  if (dilutionInfo.stability.bag) {
    stabilityInfo.push(`Bolsa: ${dilutionInfo.stability.bag}`);
  }
  if (stabilityInfo.length > 0) {
    specialInstructions.push(`🕐 Estabilidade: ${stabilityInfo.join(' | ')}`);
  }

  if (dilutionInfo.ph) {
    specialInstructions.push(`pH: ${dilutionInfo.ph}`);
  }

  return {
    drugName,
    calculatedDose: dose,
    recommendedVolume: volume,
    finalConcentration: concentration,
    infusionRate,
    infusionTime,
    diluent,
    warnings,
    specialInstructions,
  };
}

/**
 * Formata tempo em horas e minutos
 */
export function formatInfusionTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}
