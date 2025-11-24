// Protocolos de Emergência para Situações Críticas em Hematologia

export interface EmergencyProtocol {
  id: string;
  title: string;
  icon: string;
  diagnosis?: {
    title: string;
    criteria: string[];
  };
  management: {
    title: string;
    steps: Array<{
      step: string;
      description: string;
      details?: string[];
      medications?: Array<{
        name: string;
        dose: string;
        route: string;
        frequency: string;
        notes?: string;
      }>;
    }>;
  };
  monitoring?: string[];
  alerts?: string[];
}

export const emergencyProtocols: EmergencyProtocol[] = [
  {
    id: 'tumor-lysis',
    title: 'Síndrome de Lise Tumoral (SLT)',
    icon: '⚡',
    diagnosis: {
      title: 'Critérios Diagnósticos (Cairo-Bishop)',
      criteria: [
        'Ácido Úrico > 8 mg/dL',
        'Fósforo > 4 mg/dL',
        'Potássio > 6 mmol/L',
        'Cálcio corrigido < 7 mg/dL ou Cálcio ionizado < 4,5 mg/dL (1,1 mmol/L)',
      ],
    },
    management: {
      title: 'Manejo da Síndrome de Lise Tumoral',
      steps: [
        {
          step: '1. Identificação de Risco',
          description: 'Identificar pacientes com potencial risco de SLT antes de iniciar quimioterapia',
          details: [
            'Alto risco: LLA, Burkitt, LMA com leucócitos > 100.000, LDH muito elevado',
            'Risco intermediário: Linfomas agressivos, LMA com leucócitos 25.000-100.000',
            'Baixo risco: Tumores sólidos, linfomas indolentes',
          ],
        },
        {
          step: '2. Hidratação Vigorosa',
          description: 'Hidratação EV agressiva para manter diurese adequada',
          details: [
            'Iniciar pelo menos 24h ANTES da quimioterapia',
            'Orientar consumo de 1,5-2L de água VO 2 dias antes da QT',
            'Hidratação EV: velocidade alta o suficiente para débito urinário > 100 mL/h',
            'Meta: diurese de pelo menos 3L/dia',
            'Manter hidratação por 24-48h PÓS-quimioterapia',
            'Em sobrecarga hídrica ou diurese insuficiente: considerar diuréticos',
          ],
        },
        {
          step: '3. Terapia Redutora de Ácido Úrico',
          description: 'Escolha baseada no risco de SLT',
          medications: [
            {
              name: 'Alopurinol',
              dose: '600-800 mg/dia',
              route: 'VO',
              frequency: 'Dividido em 2-3 tomadas',
              notes: 'Indicado para BAIXO e INTERMEDIÁRIO risco. Iniciar 2-3 dias ANTES da QT. Manter por 10-14 dias após QT ou até ausência de lise passiva. Ajustar dose em insuficiência renal. Cuidado com azatioprina, ciclofosfamida, mercaptopurina (potencializa citotoxicidade).',
            },
            {
              name: 'Rasburicase',
              dose: '0,2 mg/kg/dia',
              route: 'EV',
              frequency: 'Infusão em 30 minutos por 5 dias',
              notes: 'Indicado para ALTO risco, LRA estabelecida ou SLT já instalada. Efeito IMEDIATO. Não necessita ajuste em LRA. Dose única pode ser suficiente. CONTRAINDICADO: deficiência de G6PD (risco de anemia hemolítica).',
            },
          ],
        },
        {
          step: '4. Manejo de Hiperfosfatemia',
          description: 'Controle rigoroso do fósforo sérico',
          details: [
            'Restrição de fosfato na dieta',
            'EVITAR bicarbonato (aumenta precipitação de fosfato de cálcio)',
            'Quelantes de fósforo não dependentes de cálcio (ex: Sevelamer)',
            'Hiperfosfatemia severa: admissão em CTI + considerar TSR (terapia de substituição renal)',
          ],
        },
        {
          step: '5. Manejo de Hipercalemia',
          description: 'Tratamento urgente se K⁺ > 6,5 mmol/L ou alterações no ECG',
          medications: [
            {
              name: 'Gluconato de Cálcio 10%',
              dose: '10 mL',
              route: 'EV',
              frequency: 'Dose única (repetir se necessário)',
              notes: 'Estabilização de membrana cardíaca. Efeito imediato mas transitório.',
            },
            {
              name: 'Insulina Regular + Glicose',
              dose: '10 UI insulina + 50 mL glicose 50%',
              route: 'EV',
              frequency: 'Dose única',
              notes: 'Redistribuição de K⁺ para intracelular. Efeito em 15-30 min.',
            },
            {
              name: 'Resinas de troca (Sorcal)',
              dose: '15-30 g',
              route: 'VO ou retal',
              frequency: '6/6h',
              notes: 'Eliminação de K⁺. Efeito mais lento (horas).',
            },
          ],
        },
        {
          step: '6. Manejo de Hipocalcemia',
          description: 'Correção cautelosa apenas se sintomática',
          details: [
            'Hipocalcemia ASSINTOMÁTICA: NÃO repor (corrige com normalização do fósforo)',
            'Hipocalcemia SINTOMÁTICA (tetania, convulsões): repor com MENOR quantidade possível de cálcio',
            'Evitar reposição agressiva (risco de precipitação de fosfato de cálcio)',
          ],
        },
      ],
    },
    monitoring: [
      'Eletrólitos (K, P, Ca) a cada 4-6h nas primeiras 24-48h',
      'Ácido úrico e LDH a cada 6-12h',
      'Creatinina e ureia diariamente',
      'Débito urinário horário',
      'ECG se hipercalemia ou hipocalcemia sintomática',
    ],
    alerts: [
      '⚠️ RASBURICASE CONTRAINDICADA EM DEFICIÊNCIA DE G6PD',
      '⚠️ EVITAR BICARBONATO (aumenta precipitação de fosfato de cálcio)',
      '⚠️ NÃO REPOR CÁLCIO SE HIPOCALCEMIA ASSINTOMÁTICA',
      '⚠️ Considerar TSR precoce em hiperfosfatemia refratária ou LRA progressiva',
    ],
  },
  {
    id: 'hyperleukocytosis',
    title: 'LMA Hiperleucocitária',
    icon: '🔴',
    diagnosis: {
      title: 'Definição',
      criteria: [
        'Leucócitos > 100.000/mm³ em LMA',
        'Risco de leucostase (emergência médica)',
        'Manifestações: dispneia, hipoxemia, alteração neurológica, priapismo',
      ],
    },
    management: {
      title: 'Manejo da LMA Hiperleucocitária',
      steps: [
        {
          step: '1. Monitorização e Suporte',
          description: 'Medidas gerais de suporte',
          details: [
            'Oxigenoterapia precoce (manter SatO₂ > 92%)',
            'Controle rigoroso de balanço hídrico',
            'EVITAR transfusão de concentrado de hemácias (↑ Ht → ↑ viscosidade)',
            'Transfundir CH apenas se Hb < 7 g/dL e sintomático, com cautela',
            'Monitorar sinais de leucostase: dispneia, confusão mental, visão turva',
          ],
        },
        {
          step: '2. Hidratação e Profilaxia de SLT',
          description: 'Prevenção de Síndrome de Lise Tumoral',
          details: [
            'Hidratação vigorosa: 2,5-3 L/m²/dia (ajustar por função cardíaca/renal)',
            'Monitorização de diurese (meta > 100 mL/h)',
            'Alopurinol 600-800 mg/dia VO (baixo/intermediário risco)',
            'Rasburicase 0,2 mg/kg/dia EV (alto risco ou AU elevado)',
          ],
        },
        {
          step: '3. Monitorização Laboratorial Seriada',
          description: 'Vigilância de complicações',
          details: [
            'Eletrólitos: K, P, Ca, Mg (4/4h ou 6/6h)',
            'Ácido úrico e LDH (6/6h a 12/12h)',
            'Creatinina e ureia (diariamente)',
            'Coagulograma completo: TP, aPTT, fibrinogênio, D-dímero (detecção precoce de CIVD)',
            'Hemograma completo com contagem de plaquetas (2x/dia)',
          ],
        },
        {
          step: '4. Citorredução com Hidroxiureia',
          description: 'Droga de escolha para redução inicial de leucócitos',
          medications: [
            {
              name: 'Hidroxiureia',
              dose: '50-100 mg/kg/dia',
              route: 'VO',
              frequency: 'Dividido em 2-3 tomadas',
              notes: 'Objetivo: queda PROGRESSIVA dos leucócitos em 24-48h. Não usar em pacientes com leucostase GRAVE (preferir leucaférese). Monitorar leucócitos a cada 12h.',
            },
          ],
        },
        {
          step: '5. Leucaférese (Casos Selecionados)',
          description: 'Reservada para leucostase franca',
          details: [
            'Indicação: comprometimento respiratório ou neurológico GRAVE atribuível à hiperleucocitose',
            'SEMPRE como ADJUVANTE à quimioterapia/citorredução (não como tratamento isolado)',
            'Necessita acesso rápido a serviço de aférese',
            'Efeito transitório: iniciar QT definitiva o mais rápido possível',
          ],
        },
        {
          step: '6. Manejo de CIVD',
          description: 'Coagulação Intravascular Disseminada (comum em LMA M3)',
          medications: [
            {
              name: 'Crioprecipitado',
              dose: '1 unidade/10 kg',
              route: 'EV',
              frequency: 'Se fibrinogênio < 100 mg/dL',
              notes: 'Meta: fibrinogênio > 150 mg/dL',
            },
            {
              name: 'Plasma Fresco Congelado',
              dose: '10-15 mL/kg',
              route: 'EV',
              frequency: 'Se TP/aPTT prolongados',
              notes: 'Reposição de fatores de coagulação',
            },
            {
              name: 'Concentrado de Plaquetas',
              dose: '1 unidade/10 kg',
              route: 'EV',
              frequency: 'Se plaquetas < 20.000 ou sangramento',
              notes: 'Meta: plaquetas > 30.000-50.000 se CIVD ativa',
            },
          ],
        },
      ],
    },
    monitoring: [
      'Leucometria a cada 12h durante citorredução',
      'Sinais vitais e SatO₂ contínuos',
      'Exame neurológico seriado (leucostase cerebral)',
      'Coagulograma 2x/dia se CIVD',
      'Débito urinário horário',
    ],
    alerts: [
      '⚠️ EVITAR TRANSFUSÃO DE CH (aumenta viscosidade)',
      '⚠️ Leucostase é EMERGÊNCIA MÉDICA (risco de óbito em horas)',
      '⚠️ Leucaférese NÃO substitui quimioterapia definitiva',
      '⚠️ LMA M3 (promielocítica): alto risco de CIVD → iniciar ATRA imediatamente',
    ],
  },
  {
    id: 'myeloma-renal',
    title: 'Mieloma Múltiplo com Insuficiência Renal',
    icon: '🔵',
    management: {
      title: 'Protocolo de Emergência para Mieloma com LRA',
      steps: [
        {
          step: 'Quimioterapia de Resgate',
          description: 'Bortezomibe como droga de escolha (sem ajuste renal)',
          medications: [
            {
              name: 'Bortezomibe',
              dose: '1,3 mg/m²',
              route: 'SC',
              frequency: 'D1, D4, D8, D15 (ciclo de 21 dias)',
              notes: 'SEM AJUSTE RENAL. Pode ser usado mesmo em pacientes em diálise. Associar com Dexametasona 20-40 mg VO nos dias de Bortezomibe.',
            },
          ],
        },
        {
          step: 'Medidas de Suporte Renal',
          description: 'Manejo concomitante da insuficiência renal',
          details: [
            'Hidratação vigorosa (2-3 L/dia) se não houver sobrecarga',
            'Suspender AINEs, contraste iodado, aminoglicosídeos',
            'Corrigir hipercalcemia (comum em mieloma)',
            'Considerar plasmaférese se cadeias leves muito elevadas (> 1500 mg/L)',
            'Avaliar indicação de diálise (uremia, hipercalemia refratária, sobrecarga)',
          ],
        },
        {
          step: 'Manejo de Hipercalcemia',
          description: 'Frequente em mieloma e agrava função renal',
          medications: [
            {
              name: 'Hidratação com SF 0,9%',
              dose: '200-300 mL/h',
              route: 'EV',
              frequency: 'Contínuo',
              notes: 'Primeira medida. Ajustar por função cardíaca.',
            },
            {
              name: 'Ácido Zoledrônico',
              dose: '4 mg',
              route: 'EV',
              frequency: 'Dose única (infusão em 15 min)',
              notes: 'Ajustar dose se CrCl < 60. Evitar se CrCl < 30.',
            },
            {
              name: 'Calcitonina',
              dose: '4 UI/kg',
              route: 'SC ou IM',
              frequency: '12/12h',
              notes: 'Efeito rápido mas transitório. Usar enquanto aguarda efeito do bisfosfonato.',
            },
          ],
        },
      ],
    },
    monitoring: [
      'Creatinina e ureia diariamente',
      'Cálcio sérico diariamente',
      'Cadeias leves livres séricas (se disponível)',
      'Débito urinário',
      'Sinais de sobrecarga hídrica',
    ],
    alerts: [
      '⚠️ Bortezomibe NÃO necessita ajuste renal',
      '⚠️ EVITAR Lenalidomida em LRA grave (excreção renal)',
      '⚠️ Hipercalcemia agrava função renal → tratar agressivamente',
      '⚠️ Considerar plasmaférese se cadeias leves > 1500 mg/L',
    ],
  },
  {
    id: 'febrile-neutropenia',
    title: 'Neutropenia Febril',
    icon: '🌡️',
    diagnosis: {
      title: 'Critérios Diagnósticos',
      criteria: [
        'Temperatura oral > 38,3°C OU',
        'Duas leituras > 38°C em intervalo de 2 horas',
        'E neutrófilos absolutos < 500 células/mcL',
        'OU < 1000 células/mcL com queda esperada para < 500 em 48h',
      ],
    },
    management: {
      title: 'Manejo da Neutropenia Febril',
      steps: [
        {
          step: '1. Coleta de Culturas',
          description: 'ANTES de iniciar antibióticos',
          details: [
            '2 pares de hemoculturas (periférica + cateter, se presente)',
            'Cultura de urina (jato médio ou cateter)',
            'Cultura de outros focos suspeitos (escarro, fezes, lesões cutâneas)',
            'Swab nasal/orofaringe se sintomas respiratórios',
          ],
        },
        {
          step: '2. Antibioticoterapia Empírica',
          description: 'Iniciar IMEDIATAMENTE após coleta de culturas (meta: < 1h)',
          medications: [
            {
              name: 'Cefepima',
              dose: '2 g',
              route: 'EV',
              frequency: '8/8h',
              notes: 'Primeira escolha. Amplo espectro incluindo Pseudomonas.',
            },
            {
              name: 'Piperacilina-Tazobactam',
              dose: '4,5 g',
              route: 'EV',
              frequency: '6/6h',
              notes: 'Alternativa à Cefepima. PREFERÊNCIA se DCE reduzida (melhor ajuste renal).',
            },
            {
              name: 'Meropenem',
              dose: '2 g',
              route: 'EV',
              frequency: '8/8h',
              notes: 'Reservado para pacientes com colonização por ESBL ou infecção prévia por gram-negativo resistente.',
            },
          ],
        },
        {
          step: '3. Adicionar Vancomicina (se indicado)',
          description: 'Cobertura para gram-positivos',
          details: [
            'INDICAÇÕES: infecção relacionada a cateter, mucosite grave, pneumonia, hipotensão/choque, colonização conhecida por MRSA',
            'NÃO usar rotineiramente (risco de resistência)',
          ],
          medications: [
            {
              name: 'Vancomicina',
              dose: 'Ataque: 25-30 mg/kg (máx 2g) | Manutenção: 15-20 mg/kg',
              route: 'EV',
              frequency: '12/12h',
              notes: 'Ajustar por função renal. Monitorar nível sérico (vale: 15-20 mcg/mL).',
            },
          ],
        },
        {
          step: '4. Reavaliação em 48-72h',
          description: 'Ajustar antibióticos conforme evolução clínica e culturas',
          details: [
            'Afebril + neutrófilos em recuperação: manter ATB por 7 dias ou até neutrófilos > 500',
            'Febre persistente + culturas negativas: considerar antifúngico (ex: Caspofungina, Anfotericina B)',
            'Febre persistente + culturas positivas: ajustar ATB conforme antibiograma',
            'Piora clínica: escalar para Meropenem + Vancomicina + antifúngico',
          ],
        },
        {
          step: '5. Profilaxia Antifúngica (se neutropenia prolongada)',
          description: 'Considerar se neutropenia > 7 dias',
          medications: [
            {
              name: 'Fluconazol',
              dose: '400 mg',
              route: 'VO ou EV',
              frequency: '1x/dia',
              notes: 'Profilaxia primária. Não cobre Aspergillus.',
            },
            {
              name: 'Posaconazol',
              dose: '300 mg',
              route: 'VO',
              frequency: '1x/dia',
              notes: 'Profilaxia em alto risco (LMA, TMO). Cobre Aspergillus.',
            },
          ],
        },
        {
          step: '6. Fator Estimulador de Colônias (G-CSF)',
          description: 'Considerar em situações específicas',
          details: [
            'INDICAÇÕES: neutropenia febril de alto risco (MASCC score < 21), pneumonia, hipotensão, infecção fúngica invasiva, neutropenia prolongada esperada (> 10 dias)',
            'NÃO usar rotineiramente',
          ],
          medications: [
            {
              name: 'Filgrastim (G-CSF)',
              dose: '5 mcg/kg',
              route: 'SC',
              frequency: '1x/dia',
              notes: 'Iniciar 24-72h após término da QT. Manter até neutrófilos > 1000-1500.',
            },
          ],
        },
      ],
    },
    monitoring: [
      'Temperatura de 4/4h',
      'Hemograma diário (contagem de neutrófilos)',
      'Sinais vitais (PA, FC, FR) de 6/6h',
      'Exame físico diário (foco em mucosas, pele, cateter)',
      'Reavaliação clínica em 48-72h',
    ],
    alerts: [
      '⚠️ TEMPO É CRÍTICO: iniciar ATB em < 1 hora após diagnóstico',
      '⚠️ NÃO aguardar resultado de culturas para iniciar ATB',
      '⚠️ Vancomicina NÃO é rotina (usar apenas se indicação específica)',
      '⚠️ Febre persistente > 4-7 dias: considerar infecção fúngica invasiva',
      '⚠️ MASCC score < 21 = ALTO RISCO (considerar internação em CTI)',
    ],
  },
];
