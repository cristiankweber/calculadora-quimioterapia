// CTCAE v5.0 - Common Terminology Criteria for Adverse Events
// Estrutura de dados para avaliação de toxicidades e ajuste de dose

export type ToxicityGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface ToxicityCriteria {
  name: string;
  category: 'hematologic' | 'non-hematologic';
  grades: {
    [key in ToxicityGrade]?: string;
  };
  doseAdjustment: {
    [key in ToxicityGrade]?: {
      action: 'continue' | 'reduce_25' | 'reduce_50' | 'hold' | 'discontinue';
      description: string;
    };
  };
}

export const ctcaeToxicities: Record<string, ToxicityCriteria> = {
  neutropenia: {
    name: 'Neutropenia',
    category: 'hematologic',
    grades: {
      0: 'Normal (≥1500/mm³)',
      1: 'Leve (1000-1499/mm³)',
      2: 'Moderada (500-999/mm³)',
      3: 'Grave (< 500/mm³)',
      4: 'Risco de vida (< 500/mm³ + febre ou infecção)',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, monitorar',
      },
      2: {
        action: 'continue',
        description: 'Manter dose, considerar G-CSF profilático',
      },
      3: {
        action: 'reduce_25',
        description: 'Reduzir 25% no próximo ciclo + G-CSF profilático',
      },
      4: {
        action: 'reduce_50',
        description: 'Reduzir 50% no próximo ciclo + G-CSF profilático obrigatório',
      },
    },
  },
  thrombocytopenia: {
    name: 'Plaquetopenia',
    category: 'hematologic',
    grades: {
      0: 'Normal (≥150.000/mm³)',
      1: 'Leve (75.000-149.999/mm³)',
      2: 'Moderada (50.000-74.999/mm³)',
      3: 'Grave (25.000-49.999/mm³)',
      4: 'Risco de vida (< 25.000/mm³)',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, monitorar',
      },
      2: {
        action: 'continue',
        description: 'Manter dose, considerar redução se recorrente',
      },
      3: {
        action: 'reduce_25',
        description: 'Reduzir 25% no próximo ciclo',
      },
      4: {
        action: 'reduce_50',
        description: 'Reduzir 50% no próximo ciclo ou considerar descontinuar',
      },
    },
  },
  anemia: {
    name: 'Anemia',
    category: 'hematologic',
    grades: {
      0: 'Normal (Hb ≥ LIN)',
      1: 'Leve (Hb < LIN - 10 g/dL)',
      2: 'Moderada (Hb 8-9.9 g/dL)',
      3: 'Grave (Hb < 8 g/dL)',
      4: 'Risco de vida (consequências urgentes)',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, monitorar',
      },
      2: {
        action: 'continue',
        description: 'Manter dose, considerar transfusão ou eritropoetina',
      },
      3: {
        action: 'hold',
        description: 'Suspender até Hb > 8 g/dL, transfusão',
      },
      4: {
        action: 'hold',
        description: 'Suspender, transfusão urgente, considerar descontinuar',
      },
    },
  },
  neuropathy_peripheral: {
    name: 'Neuropatia Periférica',
    category: 'non-hematologic',
    grades: {
      0: 'Ausente',
      1: 'Assintomática ou sintomas leves',
      2: 'Sintomas moderados, limitação de AVD instrumentais',
      3: 'Sintomas graves, limitação de AVD autocuidado',
      4: 'Consequências risco de vida',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, monitorar',
      },
      2: {
        action: 'reduce_25',
        description: 'Reduzir 25% (especialmente alcaloides da vinca, taxanos, platinas)',
      },
      3: {
        action: 'hold',
        description: 'Suspender até melhora para G1, reduzir 50% ao reiniciar',
      },
      4: {
        action: 'discontinue',
        description: 'Descontinuar definitivamente',
      },
    },
  },
  diarrhea: {
    name: 'Diarreia',
    category: 'non-hematologic',
    grades: {
      0: 'Ausente',
      1: 'Aumento < 4 evacuações/dia',
      2: 'Aumento 4-6 evacuações/dia',
      3: 'Aumento ≥ 7 evacuações/dia, incontinência, hospitalização',
      4: 'Consequências risco de vida',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, tratamento sintomático',
      },
      2: {
        action: 'continue',
        description: 'Manter dose, tratamento agressivo (loperamida)',
      },
      3: {
        action: 'hold',
        description: 'Suspender até melhora para G1, reduzir 25% ao reiniciar',
      },
      4: {
        action: 'hold',
        description: 'Suspender, hospitalização, reduzir 50% ou descontinuar',
      },
    },
  },
  mucositis: {
    name: 'Mucosite Oral',
    category: 'non-hematologic',
    grades: {
      0: 'Ausente',
      1: 'Assintomática ou sintomas leves',
      2: 'Dor moderada, não interfere com ingestão oral',
      3: 'Dor grave, interfere com ingestão oral',
      4: 'Consequências risco de vida',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, cuidados orais',
      },
      2: {
        action: 'continue',
        description: 'Manter dose, analgesia, cuidados orais intensivos',
      },
      3: {
        action: 'hold',
        description: 'Suspender até melhora para G1, reduzir 25%',
      },
      4: {
        action: 'hold',
        description: 'Suspender, suporte nutricional, reduzir 50%',
      },
    },
  },
  hepatotoxicity: {
    name: 'Hepatotoxicidade (ALT/AST)',
    category: 'non-hematologic',
    grades: {
      0: 'Normal (≤ LSN)',
      1: 'Elevação leve (> LSN - 3× LSN)',
      2: 'Elevação moderada (> 3-5× LSN)',
      3: 'Elevação grave (> 5-20× LSN)',
      4: 'Elevação risco de vida (> 20× LSN)',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, monitorar semanalmente',
      },
      2: {
        action: 'hold',
        description: 'Suspender até < 3× LSN, reduzir 25%',
      },
      3: {
        action: 'hold',
        description: 'Suspender até < 3× LSN, reduzir 50%',
      },
      4: {
        action: 'discontinue',
        description: 'Descontinuar definitivamente',
      },
    },
  },
  nephrotoxicity: {
    name: 'Nefrotoxicidade (Creatinina)',
    category: 'non-hematologic',
    grades: {
      0: 'Normal (≤ LSN)',
      1: 'Elevação leve (> LSN - 1.5× basal)',
      2: 'Elevação moderada (> 1.5-3× basal)',
      3: 'Elevação grave (> 3-6× basal)',
      4: 'Risco de vida (> 6× basal ou diálise)',
    },
    doseAdjustment: {
      0: {
        action: 'continue',
        description: 'Manter dose',
      },
      1: {
        action: 'continue',
        description: 'Manter dose, hidratação, monitorar',
      },
      2: {
        action: 'hold',
        description: 'Suspender até < 1.5× basal, ajustar dose conforme CrCl',
      },
      3: {
        action: 'hold',
        description: 'Suspender até recuperação, reduzir 50%',
      },
      4: {
        action: 'discontinue',
        description: 'Descontinuar, suporte renal',
      },
    },
  },
};

export function getDoseAdjustmentFactor(toxicities: {
  [toxicity: string]: ToxicityGrade;
}): number {
  let maxReduction = 0;

  for (const [toxicity, grade] of Object.entries(toxicities)) {
    const criteria = ctcaeToxicities[toxicity];
    if (!criteria || grade === 0) continue;

    const adjustment = criteria.doseAdjustment[grade];
    if (!adjustment) continue;

    // Determinar fator de redução
    switch (adjustment.action) {
      case 'reduce_25':
        maxReduction = Math.max(maxReduction, 0.25);
        break;
      case 'reduce_50':
        maxReduction = Math.max(maxReduction, 0.5);
        break;
      case 'hold':
      case 'discontinue':
        maxReduction = Math.max(maxReduction, 1.0); // 100% redução (suspender)
        break;
    }
  }

  return 1 - maxReduction; // Retorna fator multiplicador (0.75 = reduzir 25%)
}

export function getToxicityRecommendations(toxicities: {
  [toxicity: string]: ToxicityGrade;
}): string[] {
  const recommendations: string[] = [];

  for (const [toxicity, grade] of Object.entries(toxicities)) {
    const criteria = ctcaeToxicities[toxicity];
    if (!criteria || grade === 0) continue;

    const adjustment = criteria.doseAdjustment[grade];
    if (adjustment) {
      recommendations.push(
        `${criteria.name} G${grade}: ${adjustment.description}`
      );
    }
  }

  return recommendations;
}
