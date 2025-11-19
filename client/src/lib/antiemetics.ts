import type { AntiemeticProphylaxis } from '@/types/calculator';

/**
 * Gera esquema de profilaxia antiemética baseado no risco emetogênico
 */
export function generateAntiemeticProphylaxis(
  risk: 'high' | 'moderate' | 'low' | 'minimal'
): AntiemeticProphylaxis {
  switch (risk) {
    case 'high':
      return {
        risk: 'high',
        day1: [
          'Fosaprepitanto 150 mg EV (antagonista NK1)',
          'Ondansetrona 8 mg EV 8/8h (antagonista 5-HT3)',
          'Dexametasona 10 mg EV (corticoide)',
          'Olanzapina 5 mg VO à noite (antipsicótico atípico)',
        ],
        days2to4: [
          'Dexametasona 8 mg VO/EV 12/12h',
          'Ondansetrona 8 mg VO/EV 8/8h',
          'Olanzapina 5 mg VO à noite',
        ],
        rescue: [
          'Metoclopramida 10 mg VO/EV 6/6-8/8h',
          'Lorazepam 0,5-1 mg VO/EV 6/6h (se componente ansioso)',
          'Haloperidol 0,5-1 mg VO/EV 6/6h',
        ],
        alerts: [
          'Monitorar prolongamento de QT se associação Ondansetrona + Olanzapina + TKI',
          'Perguntar sobre uso de Tramadol - se sim, preferir Metoclopramida no lugar de Ondansetrona',
        ],
      };

    case 'moderate':
      return {
        risk: 'moderate',
        day1: [
          'Ondansetrona 8 mg EV 8/8h (antagonista 5-HT3)',
          'Dexametasona 10 mg EV (corticoide)',
        ],
        days2to4: [
          'Ondansetrona 8 mg VO 8/8h OU',
          'Dexametasona 4 mg VO 12/12h',
        ],
        rescue: [
          'Metoclopramida 10 mg VO/EV 6/6-8/8h',
          'Olanzapina 5-10 mg VO/dia (boa para náusea tardia)',
        ],
        alerts: [
          'Para Carboplatina: tratar como alto risco (adicionar NK1)',
          'Perguntar sobre uso de Tramadol',
        ],
      };

    case 'low':
      return {
        risk: 'low',
        day1: [
          'Dexametasona 8 mg VO/EV pré-QT OU',
          'Ondansetrona 8 mg VO/EV pré-QT',
        ],
        days2to4: ['Sem profilaxia de rotina (apenas resgate se necessário)'],
        rescue: [
          'Metoclopramida 10 mg VO 6/6-8/8h',
          'Ondansetrona 8 mg VO se necessário',
        ],
        alerts: [],
      };

    case 'minimal':
      return {
        risk: 'minimal',
        day1: ['Não indicar profilaxia fixa'],
        days2to4: ['Não indicar profilaxia fixa'],
        rescue: [
          'Metoclopramida 10 mg VO se surgirem náuseas',
          'Ondansetrona 8 mg VO se necessário',
        ],
        alerts: [],
      };
  }
}

/**
 * Alertas específicos para antiemese
 */
export function getAntiemeticAlerts(
  usesTramadol: boolean,
  hasQTProlongation: boolean,
  isPostHaploTCT: boolean,
  isMEL200: boolean
): string[] {
  const alerts: string[] = [];

  if (usesTramadol) {
    alerts.push(
      '⚠️ INTERAÇÃO TRAMADOL × ONDANSETRONA: Evitar Ondansetrona. Preferir Metoclopramida (risco de síndrome serotoninérgica e redução de efeito analgésico)'
    );
  }

  if (hasQTProlongation) {
    alerts.push(
      '⚠️ PROLONGAMENTO DE QT: Associação Ondansetrona + Olanzapina + TKI/antiarrítmicos. Sugerir monitorização de ECG'
    );
  }

  if (isPostHaploTCT) {
    alerts.push(
      '⚠️ PÓS-TMO HAPLOIDÊNTICO (pós-Ciclofosfamida): EVITAR CORTICOIDE (Dexametasona) em D+3 e D+4. Sugerir esquema sem corticoide: 5-HT3 + NK1 + Olanzapina'
    );
  }

  if (isMEL200) {
    alerts.push(
      '💡 MELFALANO (MEL200): Crioterapia oral (gelo) é uma das intervenções mais eficazes para reduzir mucosite e náusea secundária'
    );
  }

  return alerts;
}
