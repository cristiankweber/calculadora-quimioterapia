# Calculadora de Quimioterapia - TODO

## Funcionalidades Principais

### Cálculos Fundamentais
- [x] Implementar cálculo de Superfície Corporal (SC) - Fórmula de DuBois
- [x] Implementar cálculo de DCE/eGFR - Fórmula CKD-EPI 2021
- [x] Criar formulário de entrada de dados do paciente (nome, idade, sexo, peso, altura)
- [x] Criar formulário de entrada de exames laboratoriais (creatinina, bilirrubinas, transaminases)
- [x] Criar campo de entrada para ECOG e comorbidades

### Ajustes Automáticos
- [x] Implementar classificação semáforo de função renal (Verde/Amarelo/Vermelho)
- [x] Implementar regras de ajuste renal (ADDIKD) por droga
- [x] Implementar ajuste por ECOG + idade
- [x] Implementar fator de correção global de dose

### Validação de Dose Cumulativa
- [x] Implementar validador de dose cumulativa para antraciclinas
- [x] Criar sistema de alertas progressivos (inicial, próximo do limite, limite atingido)
- [ ] Permitir cadastro de doses prévias do paciente

### Protocolos de Quimioterapia
- [x] Implementar estrutura de dados para protocolos
- [x] Adicionar protocolo: 7+3 (LMA Indução)
- [x] Adicionar protocolo: FLAG-Ida
- [x] Adicionar protocolo: HiDAC
- [x] Adicionar protocolo: Azacitidina + Venetoclax
- [ ] Adicionar protocolo: Hyper-CVAD Parte A
- [ ] Adicionar protocolo: Hyper-CVAD Parte B
- [x] Adicionar protocolo: R-CHOP
- [ ] Adicionar protocolo: R-ICE
- [x] Adicionar protocolo: ABVD
- [x] Adicionar protocolo: MEL200
- [ ] Adicionar protocolo: DARA-VRd
- [ ] Adicionar protocolo: VRd
- [ ] Adicionar mais protocolos conforme banco de dados

### Profilaxia Antiemética
- [x] Implementar classificação de risco emetogênico por protocolo
- [x] Implementar esquema quádruplo (alto risco)
- [x] Implementar esquema moderado
- [x] Implementar esquema baixo risco
- [x] Adicionar medicações de resgate
- [x] Implementar alertas específicos (Tramadol×Ondansetrona, QT prolongado, etc.)

### Profilaxias por Protocolo
- [x] Implementar sugestão automática de profilaxias anti-infecciosas
- [x] Implementar sugestão de profilaxia para Pneumocystis
- [x] Implementar sugestão de profilaxia antiviral
- [x] Implementar sugestão de tromboprofilaxia

### Cuidados Especiais
- [x] Implementar orientações para Metotrexato em alta dose (HD-MTX)
- [x] Implementar orientações para mucosite oral
- [x] Adicionar cuidados de enfermagem por protocolo

### Interface e Experiência do Usuário
- [x] Criar design premium e moderno
- [x] Implementar interface responsiva
- [x] Criar seletor de protocolo e ciclo
- [x] Exibir tabela de drogas com doses calculadas
- [x] Mostrar ajustes aplicados de forma clara
- [x] Exibir profilaxias sugeridas
- [x] Exibir alertas clínicos em destaque
- [x] Implementar tema de cores médico/profissional

### Exportação e Saída
- [ ] Implementar exportação para PDF
- [x] Implementar botão "Copiar prescrição formatada"
- [x] Formatar prescrição para prontuário eletrônico
- [x] Incluir todas as informações relevantes na exportação

### Testes e Validação
- [x] Testar cálculos de SC e eGFR
- [x] Testar ajustes renais
- [x] Testar ajustes por ECOG
- [x] Testar validação de dose cumulativa
- [ ] Testar exportação de prescrição
- [ ] Validar responsividade em dispositivos móveis

### Correções e Melhorias Solicitadas
- [x] Ajustar layout do botão no PatientForm (estava quase fora do dashboard)
- [x] Permitir ajuste manual de dose na tabela para arredondar valores
- [x] Corrigir ortografia: Allopurinol → Alopurinol
- [x] Adicionar colírio de Dexametasona nas profilaxias (já estava presente nos protocolos FLAG-Ida e HiDAC)

### Próximos Passos - Novas Funcionalidades

#### Exportação PDF
- [x] Implementar geração de PDF com formatação profissional
- [x] Adicionar cabeçalho com logo e informações institucionais
- [x] Incluir todas as seções da prescrição no PDF
- [x] Adicionar rodapé com data/hora e identificação do sistema

#### Sistema de Histórico de Pacientes
- [x] Criar estrutura de dados para histórico de pacientes
- [x] Implementar salvamento local (localStorage) de pacientes
- [x] Criar interface para buscar e carregar pacientes salvos
- [x] Implementar rastreamento de doses cumulativas
- [x] Adicionar alertas de cardiotoxicidade baseados em histórico
- [x] Permitir edição e exclusão de registros históricos

#### Protocolos Adicionais
- [x] Adicionar protocolo Hyper-CVAD Parte A
- [x] Adicionar protocolo Hyper-CVAD Parte B
- [x] Adicionar protocolo R-ICE
- [x] Adicionar protocolo VRd (Mieloma Múltiplo)
- [x] Adicionar protocolo DARA-VRd (Mieloma Múltiplo)

### Novas Melhorias Solicitadas

#### Dose Máxima
- [x] Adicionar campo maxDose no tipo Drug
- [x] Implementar lógica para respeitar dose máxima nos cálculos
- [x] Adicionar indicador visual quando dose máxima for aplicada
- [x] Atualizar testes para validar dose máxima

#### Novos Protocolos
- [ ] Adicionar protocolo SMILE (LMA/Linfoma)
- [x] Adicionar protocolo GDP (Linfoma de Hodgkin)
- [x] Adicionar protocolo R-DHAP (Linfoma)
- [x] Adicionar protocolo DA-R-EPOCH (Linfoma)
- [x] Adicionar protocolo R-mini-CHOP (Linfoma)
- [x] Adicionar protocolo R-CVP (Linfoma)
- [x] Adicionar protocolo BR (LLC/NHL)
- [ ] Adicionar protocolo FCR (LLC)
- [ ] Adicionar mais protocolos conforme banco de dados

### Correções
- [x] Corrigir erro de ref no DialogTrigger do PatientHistory
- [x] Corrigir erro de ref no DialogOverlay usando forwardRef

### Calculadora de Calvert para Carboplatina
- [x] Implementar fórmula de Calvert: Dose (mg) = AUC × (eGFR + 25)
- [x] Atualizar função calculateDrugDose para suportar cálculo AUC
- [x] Adicionar protocolos com Carboplatina (R-ICE, R-DHAP, GDP)
- [x] Criar testes para validar cálculo de Calvert
- [x] Adicionar indicador visual para doses calculadas por AUC

### Calculadora de Diluição e Tempo de Infusão
- [x] Criar estrutura de dados com parâmetros CMI por droga
- [x] Implementar cálculo de volume de diluição baseado em concentração máxima
- [x] Implementar cálculo de velocidade de infusão (mL/h)
- [x] Implementar cálculo de tempo total de infusão
- [x] Criar componente visual para exibir informações de diluição
- [x] Adicionar alertas de compatibilidade (PVC, fotossensibilidade, etc.)
- [x] Criar testes para validar cálculos de diluição

### Implementar Mais Protocolos do Banco de Dados

#### Protocolos de LMA/LMA RR
- [x] SMILE (LMA/Linfoma NK/T)

#### Protocolos de LLA
- [ ] ALL IC-BFM 2009
- [ ] GRAALL-2003/2005

#### Protocolos de Linfomas
- [ ] R-Pola-CHP (DLBCL 1ª linha)
- [ ] R-CODOX-M (Burkitt)
- [ ] R-IVAC (Burkitt alternado)
- [ ] R-Clorambucil (LLC/Linfoma indolente)

#### Protocolos de Mieloma Múltiplo
- [x] VCd (Bortezomibe + Ciclofosfamida + Dexametasona)
- [ ] D-VTD (Daratumumabe + Bortezomibe + Talidomida + Dex)
- [ ] ISA-VRd (Isatuximabe + VRd)
- [ ] Isa-KRd (Isatuximabe + Carfilzomibe + Revlimid + Dex)
- [ ] D-VMP (Daratumumabe + Bortezomibe + Melfalano + Pred)
- [x] D-Rd (Daratumumabe + Revlimid + Dex)
- [x] D-Vd (Daratumumabe + Bortezomibe + Dex)
- [ ] D-Pd (Daratumumabe + Pomalidomida + Dex)

#### Condicionamentos TMO
- [x] BuFlu MAC (Bussulfano + Fludarabina - mieloablativo)
- [ ] BuFlu RIC (Bussulfano + Fludarabina - intensidade reduzida)

#### LLC/LMC
- [x] FCR (Fludarabina + Ciclofosfamida + Rituximabe)
- [ ] Ibrutinib (BTKi)
- [ ] Acalabrutinib (BTKi)
- [ ] Imatinib (TKI)
- [ ] Dasatinib (TKI)
- [ ] Nilotinib (TKI)
- [ ] Ponatinib (TKI)
- [ ] Ruxolitinib (Mielofibrose)

#### Imunoterapias
- [ ] Epcoritamab (Linfoma)
- [ ] Brentuximabe Vedotina (Hodgkin/Linfoma T)
- [ ] Teclistamab (Mieloma)
- [ ] Talquetamab (Mieloma)

### Terapias-Alvo e Imunoterapias Modernas
- [x] Ibrutinib (BTKi - LLC/Linfoma do manto)
- [x] Venetoclax monoterapia (BCL-2i - LMA/LLC)
- [x] Venetoclax + Azacitidina (LMA não elegível para QT intensiva)
- [x] Brentuximabe Vedotina (anti-CD30 - Hodgkin/Linfoma T)
- [x] Epcoritamab (biespecífico CD20×CD3 - Linfoma B)
- [x] Orientações CAR-T (pré-infusão, infusão, manejo SLC/ICANS)

### Calculadora de Ajuste por Toxicidade CTCAE
- [x] Criar estrutura de dados com graus CTCAE v5.0
- [x] Implementar avaliação de toxicidades hematológicas (neutropenia, plaquetopenia, anemia)
- [x] Implementar avaliação de toxicidades não-hematológicas (neuropatia, diarreia, mucosite, hepatotoxicidade, nefrotoxicidade)
- [x] Criar lógica de recomendação de ajuste de dose por grau
- [x] Criar componente visual de seleção de toxicidades
- [x] Integrar ajuste de toxicidade com cálculo de doses
- [x] Adicionar tabela de referência CTCAE
- [x] Criar testes para validar ajustes

### Ajustes de Antieméticos
- [x] Atualizar esquema de alto risco (Fosaprepitanto 150mg, Ondansetrona 8/8h, Dexametasona, Olanzapina)
- [x] Atualizar esquema moderado (Ondansetrona 8/8h, Dexametasona, Olanzapina D2-4)
- [x] Atualizar esquema baixo risco
- [x] Atualizar medicações de resgate (Metoclopramida, Lorazepam, Clorpromazina)
- [x] Adicionar alertas específicos (QT prolongado, Tramadol×Ondansetrona)

### Modo de Impressão Otimizado
- [x] Criar layout de impressão simplificado e profissional
- [x] Implementar geração de QR code para rastreabilidade
- [x] Adicionar cabeçalho institucional customizável
- [x] Criar formatação específica para prontuário eletrônico
- [x] Garantir compatibilidade com TASY, MV, Philips
- [x] Adicionar rodapé com data/hora e assinatura digital

### Banco de Dados e Persistência
- [x] Adicionar feature web-db-user ao projeto
- [x] Criar schema de banco de dados (pacientes, prescrições, estatísticas, configurações)
- [x] Implementar API de pacientes (CRUD)
- [x] Implementar API de prescrições (criar, listar, buscar)
- [x] Implementar API de estatísticas (protocolos mais usados, alertas)
- [x] Implementar API de configurações institucionais
- [x] Migrar histórico de pacientes de localStorage para DB
  - [x] Atualizar PatientHistory para usar tRPC
  - [ ] Migrar dados existentes do localStorage (usuário pode fazer manualmente)
  - [x] Remover dependência de localStorage (novo componente PatientHistoryDB criado)
- [ ] Implementar salvamento automático de prescrições
  - [x] Integrar tRPC no Calculator
  - [x] Ajustar schema do banco de dados
  - [x] Implementar função de salvamento no Calculator
  - [x] Salvar prescrição ao gerar
  - [x] Vincular QR code ao ID do banco
- [ ] Criar painel de configurações institucionais
  - [x] Criar página /settings com rota
  - [x] Criar componente de navegação para settings (botão no Calculator)
  - [x] Implementar formulário de dados institucionais
  - [x] Implementar upload de logo com preview
  - [x] Implementar campos de templates de cabeçalho/rodapé
  - [x] Integrar configurações com PrintablePrescription
  - [x] Salvar configurações no banco de dados
  - [x] Carregar configurações ao iniciar aplicação
- [ ] Criar testes para APIs
- [ ] Validar persistência e recuperação de dados

### Correção do Modo de Impressão
- [x] Verificar se PrintablePrescription está sendo renderizado
- [x] Corrigir exibição do componente de impressão
- [x] Adicionar botão de impressão visível
- [x] Testar geração de QR code
- [x] Validar layout de impressão A4


### Correção de Travamento de Protocolos
- [x] Identificar causa raiz: useEffect com selectedProtocol (objeto) causando loop infinito
- [x] Aplicar correção cirúrgica: usar selectedProtocol?.id (string) nas dependências do useEffect
- [x] Problema persiste: HiDAC ainda trava - investigar outras dependências instáveis (calculatedValues, toxicities)
- [x] Aplicar correção completa: estabilizar TODAS as dependências usando valores primitivos
- [x] CAUSA RAIZ REAL IDENTIFICADA: ProtocolSelector usando value="" (string vazia) no ShadUI Select
- [x] Aplicar correção definitiva no ProtocolSelector:
  - Usar value={selectedProtocol ? selectedProtocol.id : undefined}
  - Adicionar proteção: if (protocol && protocol.id !== selectedProtocol?.id)
  - Memoizar lista de protocolos com useMemo
- [x] Problema AINDA persiste após todas as correções - adicionar logs de debug detalhados
- [x] LOOP IDENTIFICADO NOS LOGS: Component render START + useEffect 1 em loop infinito
- [x] CAUSA RAIZ FINAL: PrintablePrescription sendo renderizado inteiro ao selecionar protocolo (componente pesado)
- [ ] Implementar React.lazy para PrintablePrescription
- [ ] Renderizar PrintablePrescription apenas quando usuário clicar em Imprimir (useState)
- [ ] Testar seleção de todos os protocolos (deve ser instantânea)
- [ ] Validar funcionalidade de impressão


### Correção de Travamento em Produção
- [x] Adicionar meta tag `<meta name="manus-ignore" content="true">` no index.html
- [x] Salvar checkpoint (versão 3c26de0e)
- [ ] Republicar aplicação para aplicar correção

### Correção de Import do PrintablePrescription
- [x] Verificar nome correto do arquivo (tinha espaço: PrintablePrescrip tion.tsx)
- [x] Renomear arquivo para PrintablePrescription.tsx (sem espaço)
- [x] Corrigir import no Calculator.tsx
- [ ] Salvar checkpoint e republicar


## Revisão Completa e Otimização (Nova Fase)

### Auditoria de Código
- [ ] Revisar todos os componentes principais (Calculator, PatientForm, DrugsTable, etc.)
- [ ] Identificar gargalos de performance
- [ ] Verificar erros de TypeScript e linting
- [ ] Analisar bundle size e imports desnecessários

### Correções e Otimizações
- [ ] Corrigir erros identificados
- [ ] Otimizar re-renders com React.memo
- [ ] Melhorar memoização de cálculos pesados
- [ ] Reduzir bundle size removendo dependências não utilizadas

### Testes e Validação
- [ ] Executar suite de testes completa
- [ ] Testar todos os 30 protocolos
- [ ] Validar cálculos de doses
- [ ] Verificar funcionalidade de impressão

### Plano de Aprimoramento Estratégico
- [ ] Criar roadmap para tornar a calculadora referência em hematologia
- [ ] Definir features prioritárias para TMO (Transplante de Medula Óssea)
- [ ] Planejar integração com guidelines internacionais (NCCN, ESMO, EBMT)
- [ ] Documentar próximos passos


## Protocolos Adicionais - Fase 1 (Janeiro/2025)

### Protocolos de LLA
- [x] ALL IC-BFM 2009 (LLA pediátrica)
- [x] GRAALL-2003/2005 (LLA adulto)

### Protocolos de Linfoma
- [x] R-Pola-CHP (DLBCL 1ª linha)
- [x] R-CODOX-M (Burkitt)
- [x] R-IVAC (Burkitt alternado)

### Protocolos de Mieloma Múltiplo
- [x] D-VTD (Daratumumabe + Bortezomibe + Talidomida + Dex)
- [x] ISA-VRd (Isatuximabe + VRd)
- [x] Teclistamab (Mieloma refratário)

### Condicionamentos TMO
- [x] BuFlu RIC (Bussulfano + Fludarabina - intensidade reduzida)

### TKIs e Terapias-Alvo
- [x] Imatinib (LMC)
- [x] Dasatinib (LMC 2ª linha)
- [x] Nilotinib (LMC 2ª linha)
- [x] Ruxolitinib (Mielofibrose)

### Dashboard de Estatísticas
- [x] Criar schema de banco para estatísticas agregadas
- [x] Implementar APIs tRPC para buscar estatísticas
- [x] Criar componentes de gráficos (protocolos mais prescritos, distribuição por patologia)
- [x] Criar componente de gráfico de tendências temporais
- [x] Criar componente de alertas de toxicidade mais frequentes
- [x] Implementar página /dashboard com visualizações
- [x] Adicionar navegação para dashboard no cabeçalho
- [x] Testar dashboard com dados reais

### CI/CD e Testes Automatizados
- [x] Criar arquivo .github/workflows/ci.yml
- [x] Configurar job de testes automatizados
- [x] Configurar job de build
- [x] Configurar job de lint/format
- [x] Adicionar badges de status no README
- [x] Testar pipeline completo
