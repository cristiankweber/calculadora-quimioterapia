import { describe, it, expect } from 'vitest';
import { calculateDrugDose } from './calculations';

describe('Dose Fixa - Daratumumabe', () => {
  it('deve manter dose fixa de 1800mg independente da SC', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    
    // Testar com diferentes BSAs
    const bsa1 = 1.5; // SC pequena
    const bsa2 = 2.0; // SC média
    const bsa3 = 2.5; // SC grande
    
    const dose1 = calculateDrugDose(baseDose, doseUnit, bsa1, 60);
    const dose2 = calculateDrugDose(baseDose, doseUnit, bsa2, 80);
    const dose3 = calculateDrugDose(baseDose, doseUnit, bsa3, 100);
    
    // Todas as doses devem ser 1800mg
    expect(dose1).toBe(1800);
    expect(dose2).toBe(1800);
    expect(dose3).toBe(1800);
  });

  it('deve manter dose fixa de 1800mg independente do peso', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    const bsa = 2.0;
    
    // Testar com diferentes pesos
    const weight1 = 50; // Peso baixo
    const weight2 = 80; // Peso médio
    const weight3 = 120; // Peso alto
    
    const dose1 = calculateDrugDose(baseDose, doseUnit, bsa, weight1);
    const dose2 = calculateDrugDose(baseDose, doseUnit, bsa, weight2);
    const dose3 = calculateDrugDose(baseDose, doseUnit, bsa, weight3);
    
    // Todas as doses devem ser 1800mg
    expect(dose1).toBe(1800);
    expect(dose2).toBe(1800);
    expect(dose3).toBe(1800);
  });

  it('deve aplicar fator de ajuste mesmo em dose fixa', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    const bsa = 2.0;
    const weight = 80;
    
    // Fator de ajuste de 75% (ECOG 2, por exemplo)
    const adjustmentFactor = 0.75;
    
    const dose = calculateDrugDose(baseDose, doseUnit, bsa, weight, adjustmentFactor);
    
    // Dose deve ser 1800 * 0.75 = 1350mg
    expect(dose).toBe(1350);
  });

  it('deve respeitar dose máxima mesmo em dose fixa', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    const bsa = 2.0;
    const weight = 80;
    const adjustmentFactor = 1.0;
    const maxDose = 1500; // Dose máxima menor que a dose fixa
    
    const dose = calculateDrugDose(baseDose, doseUnit, bsa, weight, adjustmentFactor, maxDose);
    
    // Dose deve ser limitada a 1500mg
    expect(dose).toBe(1500);
  });

  it('não deve aplicar dose máxima se for maior que dose fixa', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    const bsa = 2.0;
    const weight = 80;
    const adjustmentFactor = 1.0;
    const maxDose = 2000; // Dose máxima maior que a dose fixa
    
    const dose = calculateDrugDose(baseDose, doseUnit, bsa, weight, adjustmentFactor, maxDose);
    
    // Dose deve ser 1800mg (não limitada)
    expect(dose).toBe(1800);
  });

  it('deve calcular corretamente dose fixa com ajuste de toxicidade', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    const bsa = 2.0;
    const weight = 80;
    
    // Diferentes fatores de ajuste de toxicidade
    const toxicityFactor50 = 0.5; // Redução de 50%
    const toxicityFactor75 = 0.75; // Redução de 25%
    
    const dose50 = calculateDrugDose(baseDose, doseUnit, bsa, weight, toxicityFactor50);
    const dose75 = calculateDrugDose(baseDose, doseUnit, bsa, weight, toxicityFactor75);
    
    expect(dose50).toBe(900); // 1800 * 0.5
    expect(dose75).toBe(1350); // 1800 * 0.75
  });

  it('deve arredondar corretamente dose fixa com ajuste', () => {
    const baseDose = 1800;
    const doseUnit = 'mg';
    const bsa = 2.0;
    const weight = 80;
    const adjustmentFactor = 0.85; // Fator que gera decimal
    
    const dose = calculateDrugDose(baseDose, doseUnit, bsa, weight, adjustmentFactor);
    
    // 1800 * 0.85 = 1530.0 (arredondado para 1 casa decimal)
    expect(dose).toBe(1530);
  });
});
