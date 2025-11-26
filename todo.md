# Calculadora de Quimioterapia - TODO

## ✅ Status Atual do Projeto

**Versão:** 43dd6f47  
**Protocolos Implementados:** 43  
**Testes Passando:** 102/102  
**Features:** Cálculos, Ajustes, Toxicidade, ML, Dashboard, Emergência, Histórico DB, Impressão

---

## 🎯 Próximos Passos Prioritários

### Melhorias de UX Imediatas
- [ ] Implementar busca no histórico de pacientes (campo de busca por nome/CPF no PatientHistoryDB)
- [ ] Adicionar validação visual de campos obrigatórios (bordas vermelhas em creatinina, peso, altura vazios)
- [ ] Criar modal de histórico de prescrições por paciente (visualizar todas prescrições de um paciente específico)

### Funcionalidades Avançadas
- [ ] Implementar exportação PDF nativa (alternativa ao window.print)
- [ ] Adicionar modo offline completo (service worker com cache de protocolos)
- [ ] Criar sistema de notificações para alertas críticos
- [ ] Implementar auditoria de prescrições (log de modificações)

### Protocolos Pendentes
- [ ] Adicionar protocolos pediátricos (ALL IC-BFM 2009, GRAALL-2003/2005)
- [ ] Adicionar protocolos de mieloma avançados (Isa-KRd, D-VMP, D-Pd, Talquetamab)
- [ ] Adicionar TKIs de 3ª geração (Ponatinib, Acalabrutinib)

---

## ✅ Funcionalidades Implementadas

### Cálculos Fundamentais
- [x] Cálculo de Superfície Corporal (SC) - Fórmula de DuBois
- [x] Cálculo de DCE/eGFR - Fórmula CKD-EPI 2021
- [x] Formulário de entrada de dados do paciente (nome, idade, sexo, peso, altura)
- [x] Formulário de entrada de exames laboratoriais (creatinina, bilirrubinas, transaminases)
- [x] Campo de entrada para ECOG e comorbidades

### Ajustes Automáticos
- [x] Classificação semáforo de função renal (Verde/Amarelo/Vermelho)
- [x] Regras de ajuste renal (ADDIKD) por droga
- [x] Ajuste por ECOG + idade
- [x] Fator de correção global de dose
- [x] Dose máxima por droga (ex: Vincristina 2mg)
- [x] Ajuste por toxicidade CTCAE v5.0 (8 toxicidades)

### Validação de Dose Cumulativa
- [x] Validador de dose cumulativa para antraciclinas
- [x] Sistema de alertas progressivos (inicial, próximo do limite, limite atingido)
- [ ] Permitir cadastro de doses prévias do paciente

### Protocolos de Quimioterapia (43 implementados)

#### LMA/LMA RR
- [x] 7+3 (LMA Indução)
- [x] FLAG-Ida
- [x] HiDAC
- [x] Azacitidina + Venetoclax
- [x] SMILE (LMA/Linfoma NK/T)
- [x] Venetoclax monoterapia

#### LLA
- [x] ALL IC-BFM 2009 (LLA pediátrica)
- [x] GRAALL-2003/2005 (LLA adulto)
- [x] Hyper-CVAD Parte A
- [x] Hyper-CVAD Parte B

#### Linfomas
- [x] R-CHOP
- [x] R-ICE
- [x] R-DHAP
- [x] GDP
- [x] ABVD
- [x] DA-R-EPOCH
- [x] R-mini-CHOP
- [x] R-CVP
- [x] BR (Bendamustina + Rituximabe)
- [x] R-Pola-CHP (DLBCL 1ª linha)
- [x] R-CODOX-M (Burkitt)
- [x] R-IVAC (Burkitt alternado)
- [x] Brentuximabe Vedotina (Hodgkin/Linfoma T)
- [x] Epcoritamab (biespecífico CD20×CD3)

#### Mieloma Múltiplo
- [x] VRd (Bortezomibe + Revlimid + Dex)
- [x] DARA-VRd (Daratumumabe + VRd)
- [x] VCd (Bortezomibe + Ciclofosfamida + Dex)
- [x] D-VTD (Daratumumabe + Bortezomibe + Talidomida + Dex)
- [x] D-Rd (Daratumumabe + Revlimid + Dex)
- [x] D-Vd (Daratumumabe + Bortezomibe + Dex)
- [x] ISA-VRd (Isatuximabe + VRd)
- [x] Teclistamab (Mieloma refratário)
- [x] MEL200 (Condicionamento TMO)

#### LLC/LMC
- [x] FCR (Fludarabina + Ciclofosfamida + Rituximabe)
- [x] Ibrutinib (BTKi)
- [x] Imatinib (TKI - LMC)
- [x] Dasatinib (TKI - LMC 2ª linha)
- [x] Nilotinib (TKI - LMC 2ª linha)
- [x] Ruxolitinib (Mielofibrose)

#### Condicionamentos TMO
- [x] BuFlu MAC (Bussulfano + Fludarabina - mieloablativo)
- [x] BuFlu RIC (Bussulfano + Fludarabina - intensidade reduzida)

#### CAR-T e Imunoterapias
- [x] Orientações CAR-T (pré-infusão, infusão, manejo SLC/ICANS)

### Calculadoras Especializadas
- [x] Calculadora de Calvert para Carboplatina (Dose = AUC × (eGFR + 25))
- [x] Calculadora de Diluição e Tempo de Infusão (12 medicamentos com parâmetros CMI)
- [x] Calculadora de Ajuste por Toxicidade CTCAE v5.0
- [x] Predição de Toxicidade com Machine Learning (AUC-ROC 0.78/0.76)

### Profilaxias e Alertas
- [x] Profilaxia antiemética (classificação por risco emetogênico)
- [x] Esquema quádruplo (alto risco): Fosaprepitanto, Ondansetrona, Dexametasona, Olanzapina
- [x] Esquema moderado e baixo risco
- [x] Medicações de resgate (Metoclopramida, Lorazepam, Clorpromazina)
- [x] Alertas específicos (Tramadol×Ondansetrona, QT prolongado)
- [x] Profilaxias anti-infecciosas (Pneumocystis, antiviral, tromboprofilaxia)
- [x] Orientações para HD-MTX e mucosite oral

### Modo Emergência
- [x] Protocolo de Síndrome de Lise Tumoral (critérios Cairo-Bishop, hidratação, rasburicase)
- [x] Protocolo de LMA Hiperleucocitária (citorredução, leucaférese)
- [x] Protocolo de Mieloma com Insuficiência Renal
- [x] Protocolo de Neutropenia Febril (antibioticoterapia empírica <1h)
- [x] Botão 🚨 EMERGÊNCIA no cabeçalho

### Interface e Experiência do Usuário
- [x] Design premium e moderno
- [x] Interface responsiva
- [x] Seletor de protocolo e ciclo
- [x] Tabela de drogas com doses calculadas
- [x] Ajuste manual de dose (clique na dose)
- [x] Indicadores visuais (Máx, Calvert, AUC)
- [x] Profilaxias e alertas em destaque
- [x] Tema de cores médico/profissional

### Banco de Dados e Persistência
- [x] Feature web-db-user implementada
- [x] Schema de banco de dados (pacientes, prescrições, estatísticas, configurações)
- [x] API de pacientes (CRUD via tRPC)
- [x] API de prescrições (criar, listar, buscar)
- [x] API de estatísticas (protocolos mais usados, alertas)
- [x] API de configurações institucionais
- [x] Histórico de pacientes migrado para DB (PatientHistoryDB)
- [x] Salvamento automático de prescrições
- [x] Vincular QR code ao ID do banco
- [x] Painel de configurações institucionais (/settings)
- [x] Upload de logo com preview
- [x] Templates de cabeçalho/rodapé customizáveis

### Impressão e Exportação
- [x] Layout de impressão profissional (A4)
- [x] Geração de QR code para rastreabilidade
- [x] Cabeçalho institucional customizável
- [x] Formatação para prontuário eletrônico (TASY, MV, Philips)
- [x] Rodapé com data/hora e assinatura digital
- [x] Botão "Imprimir" visível no cabeçalho
- [x] Botão "Copiar prescrição formatada"

### Dashboard e Estatísticas
- [x] Dashboard de estatísticas (/dashboard)
- [x] Cards de resumo (prescrições, pacientes, protocolos, atividade)
- [x] Gráfico de barras (top 10 protocolos)
- [x] Gráfico de pizza (distribuição por patologia)
- [x] Gráfico de linha (tendências 30 dias)
- [x] Skeleton loading para melhor UX

### Machine Learning e IA
- [x] Modelo de Regressão Logística para predição de toxicidade
- [x] Predição de neutropenia G3-4 (AUC-ROC 0.78)
- [x] Predição de mucosite G3-4 (AUC-ROC 0.76)
- [x] Alertas preventivos baseados em probabilidade
- [x] Sugestões clínicas (G-CSF, ajuste de dose, profilaxias)
- [x] Visualização de fatores de risco (feature importance)
- [x] Métricas de performance do modelo

### Otimização e Performance
- [x] React.memo em componentes pesados (DrugsTable, PatientForm, ToxicityAssessment, ProphylaxisAlerts)
- [x] Lazy loading (PrintablePrescription, Settings, Dashboard)
- [x] Skeleton loading (Dashboard, Histórico, Tabela)
- [x] Paginação no histórico (10 por página)
- [x] Code splitting (Settings 3KB, Dashboard 4KB, PrintablePrescription 13KB)
- [x] Service worker para cache offline
- [x] Bundle otimizado (255KB gzip)

### Correções de Bugs
- [x] Corrigir erro de ref no DialogTrigger
- [x] Corrigir erro de ref no DialogOverlay usando forwardRef
- [x] Corrigir travamento ao selecionar Hyper-CVAD (useEffect → useMemo)
- [x] Adicionar meta tag manus-ignore para bloquear content_script
- [x] Corrigir import do PrintablePrescription (espaço no nome do arquivo)
- [x] Desabilitar HMR via WebSocket (hmr: false, usar polling)
- [x] Corrigir valores de creatinina/bilirrubina ao recuperar prescrição
- [x] Implementar normalização de valores legados (normalizeLabValue)
- [x] Corrigir schema: creatinina/bilirrubina para DECIMAL(6,2)
- [x] Corrigir schema: BSA/eGFR para DECIMAL(6,2)
- [x] Remover multiplicação por 100 ao salvar BSA/eGFR
- [x] Implementar migração automática de dados legados

### CI/CD e Testes
- [x] GitHub Actions configurado (.github/workflows/ci.yml)
- [x] Job de testes automatizados
- [x] Job de build
- [x] Job de lint/format
- [x] Badges de status no README
- [x] 102 testes passando (23 cálculos + 7 Calvert + 5 dose máxima + 16 diluição + 16 toxicidade + 11 ML + 16 normalização + 7 dose fixa + 1 auth)

---

## 📊 Métricas do Projeto

- **Protocolos:** 43 implementados (LMA, LLA, Linfomas, Hodgkin, Mieloma, LLC, LMC, TMO)
- **Testes:** 102/102 passando (100% cobertura de cálculos críticos)
- **Performance:** Bundle 255KB gzip, lazy loading implementado
- **ML:** AUC-ROC 0.78 (neutropenia), 0.76 (mucosite) - acima do critério 0.75
- **Database:** MySQL com DECIMAL para valores laboratoriais, migração automática de dados legados
- **Arquitetura:** Frontend limpo (tRPC), sem imports incorretos de servidor

---

## 🔧 Arquitetura Técnica

### Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** tRPC + Express
- **Database:** MySQL (Drizzle ORM)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **ML:** Logistic Regression (toxicity prediction)
- **Testing:** Vitest (102 tests)
- **CI/CD:** GitHub Actions

### Estrutura de Dados
- **Pacientes:** id, nome, idade, sexo, peso, altura, creatinina, bilirrubina, ECOG, comorbidades
- **Prescrições:** id, patientId, protocol, cycle, drugs[], bsa, egfr, toxicities, qrCode
- **Configurações:** institutionName, prescriber, logo, headerTemplate, footerTemplate

### Valores Laboratoriais
- **Formato:** DECIMAL(6,2) no banco de dados
- **Creatinina:** 0.5 - 15.0 mg/dL
- **Bilirrubina:** 0.1 - 30.0 mg/dL
- **BSA:** 0.50 - 3.00 m²
- **eGFR:** 5.00 - 150.00 mL/min/1.73m²
- **Migração:** Dados legados normalizados automaticamente (valores >20 divididos por 100)

---

## 📝 Documentação

- **README.md:** Documentação completa do projeto
- **AUDITORIA.md:** Relatório de auditoria de código
- **PLANO-APRIMORAMENTO.md:** Plano estratégico 18 meses
- **TODO.md:** Este arquivo (status e próximos passos)

---

## 🚀 Deployment

- **Plataforma:** Manus (https://3000-i14958hefa4356afxui52-97156c8a.manusvm.computer)
- **CI/CD:** GitHub Actions (testes + build + lint)
- **Monitoramento:** Dashboard de estatísticas integrado
- **Backup:** Checkpoints versionados (43dd6f47)

---

## 🎓 Referências Clínicas

- **CTCAE v5.0:** Common Terminology Criteria for Adverse Events
- **ADDIKD:** Ajustes de dose em insuficiência renal
- **NCCN Guidelines:** National Comprehensive Cancer Network
- **Cairo-Bishop:** Critérios para Síndrome de Lise Tumoral
- **CKD-EPI 2021:** Cálculo de eGFR sem raça
- **DuBois:** Fórmula de Superfície Corporal
- **Calvert:** Fórmula para Carboplatina

---

**Última atualização:** 26/11/2025  
**Versão:** 43dd6f47  
**Status:** ✅ Produção (102 testes passando)

### Campo de Busca no Seletor de Protocolos
- [x] Adicionar campo de busca no ProtocolSelector
- [x] Implementar filtro em tempo real por nome do protocolo
- [x] Manter funcionalidade de seleção existente
- [x] Testar busca com diferentes termos
