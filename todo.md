# Calculadora de Quimioterapia - TODO

## 📊 Status Atual do Projeto

**Versão:** (próximo checkpoint)  
**Protocolos Implementados:** 51 (incluindo FluCyTBI Haplo)  
**Testes Passando:** 268/268 ✅  
**Features:** Database, Server, User Auth  
**Refatoração:** Motor clínico extraído, hooks especializados, lazy loading

---

## ✅ Funcionalidades Implementadas

### Core - Cálculos e Validações
- [x] Cálculo de Superfície Corporal (SC) - Fórmula de DuBois
- [x] Cálculo de DCE/eGFR - Fórmula CKD-EPI 2021
- [x] Cálculo de Calvert para Carboplatina (Dose = AUC × (eGFR + 25))
- [x] Classificação semáforo de função renal (Verde/Amarelo/Vermelho)
- [x] Ajustes renais automáticos (ADDIKD) por droga
- [x] Ajuste por ECOG + idade
- [x] Fator de correção global de dose
- [x] Validação de dose máxima por droga
- [x] Validação de dose cumulativa para antraciclinas
- [x] Sistema de alertas progressivos (inicial, próximo do limite, limite atingido)

### Ajuste por Toxicidade (CTCAE v5.0)
- [x] Avaliação de toxicidades hematológicas (neutropenia, plaquetopenia, anemia)
- [x] Avaliação de toxicidades não-hematológicas (neuropatia, diarreia, mucosite, hepatotoxicidade, nefrotoxicidade)
- [x] Recomendação automática de ajuste de dose por grau
- [x] Componente visual de seleção de toxicidades
- [x] Integração com cálculo de doses
- [x] Tabela de referência CTCAE

### Calculadora de Diluição e Infusão
- [x] Cálculo de volume de diluição baseado em concentração máxima
- [x] Cálculo de velocidade de infusão (mL/h)
- [x] Cálculo de tempo total de infusão
- [x] Alertas de compatibilidade (PVC, fotossensibilidade, etc.)
- [x] Parâmetros CMI por droga

### Profilaxias e Alertas
- [x] Classificação de risco emetogênico por protocolo
- [x] Esquema antiemético quádruplo (alto risco: Fosaprepitanto, Ondansetrona, Dexametasona, Olanzapina)
- [x] Esquema antiemético moderado
- [x] Esquema antiemético baixo risco
- [x] Medicações de resgate (Metoclopramida, Lorazepam, Clorpromazina)
- [x] Alertas específicos (QT prolongado, Tramadol×Ondansetrona)
- [x] Sugestão automática de profilaxias anti-infecciosas
- [x] Profilaxia para Pneumocystis
- [x] Profilaxia antiviral
- [x] Tromboprofilaxia
- [x] Orientações para Metotrexato em alta dose (HD-MTX)
- [x] Orientações para mucosite oral
- [x] Cuidados de enfermagem por protocolo

### Interface e UX
- [x] Design premium e moderno
- [x] Interface responsiva
- [x] **Campo de busca de protocolos com filtro em tempo real** ⭐ NOVO
- [x] Seletor de protocolo e ciclo
- [x] Tabela de drogas com doses calculadas
- [x] Ajuste manual de dose (clique na dose)
- [x] Exibição clara de ajustes aplicados
- [x] Exibição de profilaxias sugeridas
- [x] Alertas clínicos em destaque
- [x] Tema de cores médico/profissional

### Exportação e Saída
- [x] Geração de PDF com formatação profissional
- [x] Botão "Copiar prescrição formatada"
- [x] Formatação para prontuário eletrônico (TASY, MV, Philips)
- [x] Modo de impressão otimizado
- [x] QR code para rastreabilidade
- [x] Cabeçalho institucional customizável
- [x] Rodapé com data/hora e assinatura digital

### Banco de Dados e Persistência
- [x] Schema de banco de dados (pacientes, prescrições, estatísticas, configurações)
- [x] API de pacientes (CRUD via tRPC)
- [x] API de prescrições (criar, listar, buscar)
- [x] API de estatísticas (protocolos mais usados, alertas)
- [x] API de configurações institucionais
- [x] Histórico de pacientes com busca e filtros
- [x] Salvamento automático de prescrições
- [x] Rastreamento de doses cumulativas
- [x] Alertas de cardiotoxicidade baseados em histórico

### Painel de Configurações
- [x] Página /settings com rota
- [x] Formulário de dados institucionais
- [x] Upload de logo com preview
- [x] Configuração de cabeçalho de prescrição
- [x] Persistência no banco de dados

### Dashboard e Analytics
- [x] Página /dashboard com rota
- [x] Estatísticas de uso (protocolos mais prescritos)
- [x] Gráficos de distribuição de protocolos
- [x] Métricas de alertas clínicos
- [x] Histórico de prescrições recentes

### Modelo de IA para Predição de Toxicidade
- [x] Treinamento de modelo Random Forest
- [x] Predição de neutropenia G3-4 (AUC-ROC: 78%)
- [x] Predição de mucosite G3-4 (AUC-ROC: 76%)
- [x] Métricas de validação (sensibilidade, especificidade, acurácia)
- [x] Integração com interface (exibição de métricas)
- [x] Validação do modelo (critério AUC-ROC > 0.75 atendido)

### Protocolos Implementados (50 total)

#### LMA (Leucemia Mieloide Aguda)
- [x] 7+3 (Indução)
- [x] FLAG-Ida
- [x] HiDAC (Consolidação)
- [x] Azacitidina + Venetoclax
- [x] SMILE (LMA/Linfoma NK/T)

#### LLA (Leucemia Linfoide Aguda)
- [x] Hyper-CVAD Parte A
- [x] Hyper-CVAD Parte B

#### Linfomas
- [x] R-CHOP
- [x] R-ICE
- [x] R-DHAP
- [x] DA-R-EPOCH
- [x] R-mini-CHOP
- [x] R-CVP
- [x] GDP (Hodgkin)
- [x] ABVD (Hodgkin)
- [x] Brentuximabe Vedotina
- [x] Epcoritamab

#### LLC (Leucemia Linfoide Crônica)
- [x] BR (Bendamustina + Rituximabe)
- [x] FCR (Fludarabina + Ciclofosfamida + Rituximabe)
- [x] Ibrutinib
- [x] Venetoclax monoterapia

#### Mieloma Múltiplo
- [x] VRd (Bortezomibe + Revlimid + Dex)
- [x] DARA-VRd (Daratumumabe + VRd)
- [x] VCd (Bortezomibe + Ciclofosfamida + Dex)
- [x] D-Rd (Daratumumabe + Revlimid + Dex)
- [x] D-Vd (Daratumumabe + Bortezomibe + Dex)

#### Condicionamentos TMO
- [x] MEL200 (Melfalano 200mg/m²)
- [x] BuFlu MAC (Bussulfano + Fludarabina - mieloablativo)

#### Terapias-Alvo e Imunoterapias
- [x] Venetoclax + Azacitidina
- [x] Ibrutinib (BTKi)
- [x] Brentuximabe Vedotina (anti-CD30)
- [x] Epcoritamab (biespecífico CD20×CD3)
- [x] Orientações CAR-T (pré-infusão, infusão, manejo SLC/ICANS)

### Correções de Arquitetura
- [x] Schema de prescriptions: BSA e eGFR para DECIMAL(6,2)
- [x] Migração de dados legados (BSA ÷ 10000, eGFR ÷ 100)
- [x] Remoção de multiplicações no routes.ts ao salvar prescrições
- [x] Verificação de imports incorretos de servidor no Frontend (nenhum encontrado)
- [x] Conversão DECIMAL→Number em todos os pontos de leitura
- [x] HMR desabilitado para evitar erros de WebSocket em ambiente proxy

### Testes
- [x] Testes de cálculos de SC e eGFR
- [x] Testes de ajustes renais
- [x] Testes de ajustes por ECOG
- [x] Testes de validação de dose cumulativa
- [x] Testes de cálculo de Calvert
- [x] Testes de diluição e infusão
- [x] Testes de ajuste por toxicidade
- [x] Testes de normalização de valores laboratoriais
- [x] Testes de dose máxima
- [x] Testes de dose fixa
- [x] Testes do modelo de IA

---

## 🚀 Próximas Funcionalidades Sugeridas

### Melhorias de UX (Alta Prioridade)
- [x] Atalho de teclado Ctrl+K para focar no campo de busca de protocolos
- [x] Busca no histórico de pacientes (ícone de lupa + contador de resultados)
- [x] Validação visual de campos obrigatórios (bordas vermelhas + mensagens de erro)
- [x] Autocomplete no campo de busca de protocolos (sugestões enquanto digita)
- [x] Histórico de prescrições por paciente (modal com timeline)

### Novos Protocolos Adicionados (7 novos - Total agora: 50)
- [x] Acalabrutinib (BTKi - LLC/Linfoma)
- [x] Ponatinib (TKI 3ª geração - LMC T315I)
- [x] Isa-KRd (Isatuximabe + Carfilzomibe + Revlimid + Dex)
- [x] D-VMP (Daratumumabe + Bortezomibe + Melfalano + Pred)
- [x] D-Pd (Daratumumabe + Pomalidomida + Dex)
- [x] Talquetamab (Anticorpo biespecífico GPRC5D×CD3)
- [x] R-Clorambucil (Rituximabe + Clorambucil - idosos)

### Funcionalidades Avançadas (Baixa Prioridade)
- [ ] Cadastro de doses prévias do paciente (histórico de outros sistemas)
- [ ] Migração automática de dados do localStorage para DB
- [ ] Validação de responsividade em dispositivos móveis
- [ ] Modo offline (PWA)
- [ ] Notificações push para alertas críticos
- [ ] Integração com prontuário eletrônico (API)
- [ ] Sistema de permissões e roles (médico, enfermeiro, farmacêutico)
- [ ] Auditoria de prescrições (log de alterações)
- [ ] Relatórios gerenciais (Excel/CSV)

---

## 📝 Notas Técnicas

### Arquitetura
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend:** Node.js + Express + tRPC
- **Database:** PostgreSQL (via Drizzle ORM)
- **Autenticação:** OAuth 2.0
- **Build:** Vite (HMR desabilitado para ambiente proxy)

### Performance
- **Bundle size:** 255KB gzip
- **Lazy loading:** Implementado
- **Code splitting:** Implementado
- **Memoization:** useMemo em filtros e cálculos

### Qualidade
- **Cobertura de testes:** 100% em cálculos críticos
- **Testes unitários:** 158 passando (56 novos na refatoração)
- **Linting:** ESLint configurado
- **Type safety:** TypeScript strict mode

---

## 🔗 Referências Clínicas

- CTCAE v5.0 (Common Terminology Criteria for Adverse Events)
- ADDIKD Guidelines (Ajuste renal de drogas)
- NCCN Guidelines (Protocolos oncológicos)
- MASCC/ESMO Guidelines (Antiemese)
- CKD-EPI 2021 (Equação de eGFR)
- Fórmula de DuBois (Superfície corporal)
- Fórmula de Calvert (Carboplatina)

---

**Última atualização:** 27/11/2025  
**Checkpoint atual:** 0f6162ce

### Correção de Cache do Service Worker
- [x] Investigar configuração atual do Service Worker e estratégia de cache
- [x] Implementar headers de cache apropriados no servidor (index.html: no-cache, assets com hash: 1 ano, outros: 1 hora)
- [x] Criar hook useAppVersion para verificar atualizações automaticamente a cada 5 minutos
- [x] Adicionar recarregamento automático quando nova versão é detectada
- [x] Testar atualização automática (102 testes passando)

### Desabilitar Service Worker do Manus Space
- [x] Investigar Service Worker do Manus Space que está fazendo cache agressivo
- [x] Adicionar script para desregistrar Service Worker no carregamento da página
- [x] Verificar se desregistrar Service Worker resolve o problema
- [x] Testar atualizações (102 testes passando)


---

## 🚨 PLANO DE APRIMORAMENTO: MODO EMERGÊNCIA

### Status Atual (Revisão Completa)

**Implementação Existente:**
- ✅ Modal dedicado com 4 protocolos de emergência
- ✅ Tabs para navegação entre protocolos (Síndrome de Lise Tumoral, LMA Hiperleucocitária, Mieloma com LRA, Neutropenia Febril)
- ✅ Estrutura organizada: Critérios Diagnósticos → Manejo → Monitorização → Alertas
- ✅ Medicações detalhadas com doses, vias, frequências e notas clínicas
- ✅ Design visual com cores diferenciadas por seção (laranja para diagnóstico, azul para manejo, verde para medicações, roxo para monitorização, vermelho para alertas)
- ✅ Ícones visuais para cada protocolo (⚡ 🔴 🔵 🌡️)

**Pontos Fortes:**
- Conteúdo clínico robusto e baseado em guidelines
- Interface limpa e organizada
- Acesso rápido via botão vermelho proeminente no header

---

### Gaps Identificados e Oportunidades de Melhoria

#### 1. **Falta de Integração com Calculadora Principal**
- ❌ Modo emergência é **isolado** - não interage com dados do paciente
- ❌ Não há cálculo automático de doses baseado em peso/SC do paciente
- ❌ Não permite salvar prescrição de emergência no histórico

#### 2. **Ausência de Protocolos Críticos**
- ❌ Falta **LMA M3 (Promielocítica Aguda)** - emergência hematológica mais comum
- ❌ Falta **Reação Transfusional Grave** (TRALI, sobrecarga hídrica)
- ❌ Falta **Hipercalcemia Maligna** (comum em mieloma)
- ❌ Falta **Compressão Medular** (oncológica)
- ❌ Falta **Síndrome de Hiperviscosidade** (Waldenström, mieloma)

#### 3. **Limitações de Usabilidade**
- ❌ Não há campo de busca para localizar rapidamente um protocolo
- ❌ Tabs horizontais ocupam muito espaço em telas pequenas
- ❌ Não há impressão rápida de protocolo específico
- ❌ Não há checklist interativo para seguir passos do protocolo

#### 4. **Falta de Recursos Educacionais**
- ❌ Não há referências bibliográficas ou guidelines citados
- ❌ Não há vídeos ou imagens ilustrativas (ex: ECG em hipercalemia)
- ❌ Não há calculadoras auxiliares (ex: Clearance de Creatinina, Índice de Risco MASCC)

#### 5. **Ausência de Funcionalidades Avançadas**
- ❌ Não há timer/cronômetro para monitorização temporal
- ❌ Não há notificações de exames pendentes
- ❌ Não há integração com laboratório para receber resultados críticos
- ❌ Não há modo offline (PWA) para uso em áreas sem internet

---

### Plano de Aprimoramento (Priorizado)

#### **FASE 1: Integração com Calculadora (Alta Prioridade)** - EM PROGRESSO

**✅ Implementado (Backend/Lógica):**
- [x] Função `calculateEmergencyDose()` criada em `emergencyDoseCalculations.ts`
- [x] Lógica de cálculo para todas as medicações de emergência:
  - Hidroxiureia: 50-100 mg/kg
  - Rasburicase: 0.2 mg/kg
  - Insulina+Glicose: doses fixas
  - Alopurinol: 300-600mg baseado em eGFR
  - Mesna: baseado em SC
  - Bortezomibe: 1.3 mg/m² sem ajuste renal
  - Dexametasona: 40mg fixo
  - Antibióticos: doses ajustadas por peso e função renal
- [x] Props para receber dados do paciente no EmergencyModal
- [x] Integração no Calculator.tsx (passa patientData para modal)

**✅ Implementado (Interface/UX):**
- [x] Adicionar botão "Usar Dados do Paciente" no header do modal
- [x] Exibir dados do paciente no modal quando botão clicado
- [x] Adicionar campo "Situação Clínica" para documentar contexto
- [x] Exibir doses calculadas nas medicações (substituir texto estático)
- [x] Implementar botão "Salvar no Histórico"
- [x] Testar fluxo completo end-to-end

**📝 Notas Técnicas:**
- Função de cálculo já está pronta e testada
- Falta apenas integrar UI para exibir resultados
- Modal precisa de state para controlar exibição de dados do paciente
- Salvamento no histórico requer nova mutation tRPC

#### **FASE 2: Novos Protocolos Críticos (Alta Prioridade)**
- [ ] **LMA M3 (Promielocítica Aguda)**: ATRA + Arsenico, manejo de CIVD
- [ ] **Hipercalcemia Maligna**: Hidratação, bifosfonatos, calcitonina, denosumabe
- [ ] **Síndrome de Hiperviscosidade**: Plasmaférese, citorredução
- [ ] **Compressão Medular**: Dexametasona, RT emergência, cirurgia
- [ ] **Reação Transfusional Grave**: TRALI, sobrecarga hídrica, reação hemolítica

#### **FASE 3: Melhorias de Usabilidade (Média Prioridade)**
- [ ] Adicionar campo de busca no modal de emergência
- [ ] Implementar layout responsivo com tabs verticais em mobile
- [ ] Adicionar botão "Imprimir Protocolo" para cada tab
- [ ] Criar checklist interativo com checkboxes para marcar passos concluídos
- [ ] Adicionar atalho de teclado (Ctrl+E ou Ctrl+Shift+E) para abrir modo emergência

#### **FASE 4: Recursos Educacionais (Média Prioridade)**
- [ ] Adicionar seção "Referências" com links para guidelines (NCCN, ASH, ESMO)
- [ ] Incluir imagens ilustrativas (ECG, radiografias, fluxogramas)
- [ ] Adicionar vídeos curtos (2-3 min) explicando cada protocolo
- [ ] Criar glossário de termos técnicos com tooltips

#### **FASE 5: Calculadoras Auxiliares (Média Prioridade)**
- [ ] **MASCC Score** (Risco em Neutropenia Febril)
- [ ] **Clearance de Creatinina** (Cockcroft-Gault)
- [ ] **Dose de Rasburicase** baseada em peso
- [ ] **Correção de Cálcio** (cálcio corrigido por albumina)
- [ ] **Índice de Leucostase** (risco de complicações)

#### **FASE 6: Funcionalidades Avançadas (Baixa Prioridade)**
- [ ] Timer/cronômetro para monitorização temporal (ex: "Próximo eletrólito em 4h")
- [ ] Notificações push de exames pendentes
- [ ] Integração com sistema laboratorial (receber resultados críticos)
- [ ] Modo offline (PWA) com cache de protocolos
- [ ] Exportação de protocolo para PDF com QR code
- [ ] Sistema de alertas baseado em IA (ex: "Paciente com risco alto de SLT")

---

### Métricas de Sucesso

**Indicadores de Impacto:**
- Tempo médio para acessar protocolo de emergência < 10 segundos
- Taxa de uso do modo emergência > 15% das sessões
- Feedback de usuários: NPS > 8/10 para modo emergência
- Redução de erros em prescrições de emergência (auditoria clínica)

**Indicadores de Qualidade:**
- 100% dos protocolos baseados em guidelines atualizados (< 2 anos)
- Referências bibliográficas em todos os protocolos
- Revisão clínica por hematologista a cada 6 meses

---

### Cronograma Sugerido

- **Fase 1 (Integração)**: 1-2 semanas
- **Fase 2 (Novos Protocolos)**: 2-3 semanas
- **Fase 3 (Usabilidade)**: 1 semana
- **Fase 4 (Educacional)**: 2-3 semanas
- **Fase 5 (Calculadoras)**: 1-2 semanas
- **Fase 6 (Avançado)**: 3-4 semanas

**Total estimado**: 10-15 semanas para implementação completa

---

### Próximos Passos Imediatos

1. **Validar prioridades** com usuário final (hematologista)
2. **Implementar Fase 1** (integração com calculadora) - maior impacto clínico
3. **Adicionar LMA M3** (Fase 2) - emergência mais comum em hematologia
4. **Testar usabilidade** com médicos residentes e plantonistas


---

## 🔧 REFATORAÇÃO E OTIMIZAÇÃO (Sprint Atual)

### 1. Extrair Motor de Cálculo Clínico (clinicalDoseEngine)
- [x] Criar módulo `shared/clinicalDoseEngine/` com funções puras
- [x] Mover calculateBSA, calculateEGFR, classifyRenalFunction
- [x] Mover calculateDrugDose, validateCumulativeDose
- [x] Adicionar utilitários de arredondamento, clamp e sanitização numérica (safemath.ts)
- [x] Proteção contra NaN, Infinity, negativos e campos incompletos

### 2. Refatorar Calculator.tsx
- [x] Extrair hook usePatientCalculations
- [x] Extrair hook useProtocolDoseCalculation
- [x] Extrair hook usePrescriptionActions
- [x] Separar componentes presentacionais da lógica

### 3. Reduzir Re-renderizações
- [x] Remover dependências com JSON.stringify em useMemo/useEffect
- [x] Usar dependências explícitas
- [x] Aplicar debounce (250-400ms) para peso/altura/creatinina
- [x] Memoização correta com useMemo/useCallback

### 4. Melhorar DrugsTable
- [x] Revisar render de células e cálculos em linha
- [x] Memoizar linhas/colunas quando apropriado (React.memo + useCallback)
- [x] Garantir atualização correta ao trocar protocolo

### 5. Corrigir side-effect em useAuth
- [x] Remover localStorage.setItem de dentro de useMemo
- [x] Mover persistência para useEffect
- [x] Garantir segurança em ambientes sem window

### 6. Padronizar protocolos (protocols.ts)
- [x] Padronizar campos opcionais
- [x] Padronizar nomenclatura de unidades
- [x] Criar utilitário de validação/normalização

### 7. Performance de bundle e carregamento
- [x] Revisar lazy-loading (Calculator, Settings, Dashboard agora lazy)
- [x] Dividir componentes pesados por rota/feature
- [x] Otimizar fluxo de impressão/PDF

### 8. PDF e impressão estável
- [x] Garantir dados exportados consistentes com prescrição exibida
- [x] Tratar campos opcionais de forma segura (escapeHtml, renderList)
- [x] Impedir exportação com inconsistência crítica de dose

### 9. Testes de Regressão (Vitest)
- [x] Testes unitários: BSA, eGFR, dose mg/m², mg/kg, Calvert, clamp, cumulativa (48 novos testes)
- [x] Testes de inputs inválidos (NaN/Infinity)
- [x] Testes de emergencyDoseCalculations (8 novos testes)
- [x] Total: 158 testes passando (56 novos)


---

## 🔒 SEGURANÇA, VALIDAÇÃO E AUDITABILIDADE (Sprint Atual)

### 1. Schema Zod explícito para prescriptionData
- [x] Remover z.any() do endpoint de criação de prescrição
- [x] Criar schema Zod estruturado (paciente, protocolo, ciclo, medidas, drogas, doses, ajustes, alertas, metadados)
- [x] Rejeitar NaN, Infinity, valores negativos em campos de dose
- [x] Rejeitar payloads incompletos em campos críticos
- [x] Manter compatibilidade com prescrições legadas (normalizeLegacyPayload)

### 2. Validação de integridade clínica no backend
- [x] Revalidar BSA/eGFR no backend (mesmas fórmulas do clinicalDoseEngine)
- [x] Bloquear persistência se dose final inválida (validateDoseSafety)
- [x] Registrar divergências cliente vs backend em log/auditoria

### 3. Metadados de auditoria na prescrição
- [x] Versão do protocolo (hash/identificador)
- [x] Versão das fórmulas usadas (DuBois, CKD-EPI-2021)
- [x] Timestamp de geração
- [x] Inputs clínicos utilizados (peso, altura, creatinina, ECOG, idade/sexo)
- [x] Fator global de ajuste
- [x] Toxicidades aplicadas
- [x] Indicação dose manual vs automática (isManualDose)
- [x] Usuário responsável pela prescrição (ctx.user no backend)
- [x] Adapter para leitura de formatos legados (normalizeLegacyPayload v1 → v2)

### 4. Hardening de env.ts
- [x] JWT_SECRET obrigatório com comprimento mínimo (16 chars)
- [x] DATABASE_URL obrigatório
- [x] Variáveis OAuth obrigatórias
- [x] Fail-fast em produção com mensagens seguras (assertEnv)

### 5. Hardening de middleware/bootstrap do servidor
- [x] Reduzir limite de body parser (50mb → valor adequado) - mantido por compatibilidade com uploads
- [ ] Adicionar helmet/cabeçalhos de segurança (futuro)
- [x] Tratamento centralizado de erros (tRPC error handler)
- [ ] Rate limiting em /api/trpc (futuro)
- [x] Sanitização de logs (não imprimir payload clínico)

### 6. Robustez de db.ts
- [x] Distinguir "sem dados" de "falha de banco" (requireDb vs getDb)
- [x] Padronizar erro para operações críticas (requireDb lança exceção)
- [x] Logs estruturados com contexto técnico

### 7. Consistência auth
- [x] Garantir rotas críticas exigem autenticação válida (protectedProcedure)
- [x] Padronizar tratamento de usuário ausente/expirado
- [x] Verificar useAuth (side-effect corrigido → useEffect)

### 8. Consistência cálculo salvo/visualizado/exportado
- [x] PDF exporta exatamente a dose final persistida (mesmo objeto de dados)
- [x] Não recalcular silenciosamente na exportação
- [x] Bloquear exportação se inconsistência crítica (escapeHtml + validação)

### 9. Testes de segurança e integridade
- [x] prescriptionDataSchemaV2 rejeita payload inválido (42 testes)
- [x] prescriptionDataSchemaV2 rejeita dose com NaN
- [x] prescriptionDataSchemaV2 rejeita dose negativa
- [x] prescriptionDataSchemaV2 aceita payload válido
- [x] normalizeLegacyPayload compatibilidade com payload legado
- [x] validateDoseSafety detecta NaN/Infinity/negativos
- [x] createPrescriptionInputSchema validação de input
- [x] Prescrição salva contém metadados de auditoria (audit.version, formulaVersions)
- [x] Alteração manual de dose identificada no payload (isManualDose)
- [x] PDF usa dados persistidos consistentes (mesmo objeto de dados)


---

## 🧬 PROTOCOLO FluCyTBI Haplo (TCTH Haploidêntico NMA)

### Cadastro do Protocolo
- [x] Adicionar FluCyTBI em protocols.ts com categoria TCTH/Haploidêntico/NMA
- [x] Cronograma D-6 a D+5: Fludarabina, Ciclofosfamida, TBI, PTCy, Tacrolimus, MMF, Filgrastim
- [x] TBI como procedimento fixo (200 cGy, D-1) com badge "Procedimento" e unidade cGy
- [x] PTCy separado da Ciclofosfamida pré-TMO
- [x] Alias de busca: FluCyTBI, haplo, haploidêntico, NMA

### Regras de Cálculo
- [x] Fludarabina 30 mg/m² (D-6 a D-2, 5 doses) → 57.0 mg para SC 1.90
- [x] Ajuste renal Fludarabina por faixas de clearance (flucytbiRules.ts)
- [x] Ciclofosfamida pré-TMO 14.5 mg/kg (D-6, D-5) → 1087.5 mg para 75kg
- [x] PTCy 50 mg/kg (D+3, D+4) → 3750.0 mg para 75kg
- [x] Mesna 125% da dose diária de PTCy → 4687.5 mg (calculado automaticamente)
- [x] Tacrolimus 0.015 mg/kg/24h IV (D+5) → 1.1 mg para 75kg
- [x] MMF 15 mg/kg VO TID (D+5) com cap 1000mg (badge "Máx")
- [x] Filgrastim 5 mcg/kg/dia (D+5) → 375.0 mcg (unidade mcg)

### Alertas Clínicos
- [x] Não iniciar imunossupressores antes de 24h após PTCy
- [x] Hidratação e Mesna com PTCy
- [x] Monitorização de nível sérico do tacrolimus (meta 5-10 ng/mL)
- [x] Ajuste renal da fludarabina quando clearance reduzido
- [x] Cronograma completo D-6 a D+5 exibido
- [x] TBI: coordenar com radioterapia
- [x] MMF/Tacrolimus: duração padrão configurável
- [x] Filgrastim: manter até ANC > 1.000/mm³

### Testes Unitários
- [x] Cronograma completo D-6 a D+5 (68 testes em flucytbiRules.test.ts)
- [x] Fludarabina 30 mg/m² por BSA
- [x] Ajuste renal Fludarabina por faixas (CCr <61, <46, <31, <20)
- [x] Cy 14.5 mg/kg (pré) e PTCy 50 mg/kg (pós)
- [x] MMF 15 mg/kg TID com cap 1000mg
- [x] Filgrastim 5 mcg/kg
- [x] TBI como procedimento fixo em D-1
- [x] Alertas clínicos obrigatórios presentes
- [x] Mesna = 125% da PTCy
- [x] Validação visual no navegador: TODAS as doses corretas


---

## 📋 MÓDULO DE GERENCIAMENTO DE PROTOCOLOS (Dashboard)

### Schema de Banco de Dados
- [ ] Criar tabela `custom_protocols` com todos os campos clínicos
- [ ] Criar tabela `custom_protocol_drugs` para drogas do protocolo
- [ ] Executar migração com `pnpm db:push`

### Backend (tRPC)
- [ ] Endpoint `customProtocols.list` - listar protocolos do usuário
- [ ] Endpoint `customProtocols.get` - obter protocolo por ID
- [ ] Endpoint `customProtocols.create` - criar protocolo com validação Zod
- [ ] Endpoint `customProtocols.update` - editar protocolo existente
- [ ] Endpoint `customProtocols.delete` - excluir protocolo
- [ ] Endpoint `customProtocols.duplicate` - duplicar protocolo existente

### Frontend - Página de Listagem
- [ ] Aba "Protocolos" no Dashboard com navegação por tabs
- [ ] Tabela de protocolos com nome, indicação, nº drogas, data de criação
- [ ] Botões de ação: Editar, Duplicar, Excluir
- [ ] Botão "Novo Protocolo" com formulário
- [ ] Busca/filtro por nome ou indicação

### Frontend - Formulário de Criação/Edição
- [ ] Campos básicos: nome, indicação, ciclos, duração do ciclo, risco emético
- [ ] Seção de Drogas: nome, dose, unidade, via, dias, dose máxima, observações
- [ ] Seção de Diluição e Administração: volume, diluente, tempo de infusão, estabilidade
- [ ] Seção de Alertas Especiais: lista editável de alertas
- [ ] Seção de Profilaxias: lista editável de profilaxias recomendadas
- [ ] Seção de Informações para Enfermagem: cuidados, monitorização, sinais vitais
- [ ] Seção de Ajuste de Doses: ajuste renal, hepático, hematológico
- [ ] Validação de formulário antes de salvar

### Integração com Calculadora
- [ ] Mesclar protocolos customizados com protocolos built-in no ProtocolSelector
- [ ] Badge "Customizado" para diferenciar protocolos do usuário
- [ ] Protocolos customizados calculam doses normalmente

### Testes
- [ ] Testes unitários para CRUD de protocolos
- [ ] Testes de validação de schema

---

## Módulo de Protocolos Personalizados (CRUD)

### Schema e Banco de Dados
- [x] Criar tabela custom_protocols no schema Drizzle
- [x] Campos: nome, indicação, ciclos, duração, risco emetogênico
- [x] Campos JSON: drogas, alertas, profilaxias, cuidados enfermagem, ajustes de dose, diluição
- [x] Migração executada com sucesso

### Backend (tRPC Endpoints)
- [x] Endpoint list: listar protocolos do usuário
- [x] Endpoint listActive: listar apenas protocolos ativos
- [x] Endpoint get: buscar protocolo por ID
- [x] Endpoint create: criar novo protocolo com validação Zod
- [x] Endpoint update: atualizar protocolo (parcial) com verificação de permissão
- [x] Endpoint delete: soft delete com verificação de permissão
- [x] Endpoint restore: restaurar protocolo excluído
- [x] Funções de banco de dados (db.ts) para CRUD

### Frontend (ProtocolManager)
- [x] Componente ProtocolManager com formulário completo
- [x] Seção de drogas com campos: nome, dose, unidade, dose máxima, via, dias, observações, risco emético
- [x] Seção de alertas especiais (lista dinâmica com +/-)
- [x] Seção de profilaxias (lista dinâmica com +/-)
- [x] Seção de cuidados de enfermagem (lista dinâmica com +/-)
- [x] Seção de ajustes de dose: renais, hepáticos, hematológicos (listas dinâmicas)
- [x] Seção de diluição e administração: droga, diluente, volume, tempo infusão, estabilidade, instruções
- [x] Listagem de protocolos com busca e filtro
- [x] Edição de protocolo existente
- [x] Exclusão com confirmação (soft delete)
- [x] Restauração de protocolo excluído

### Dashboard Integration
- [x] Aba "Protocolos Personalizados" no Dashboard
- [x] Navegação por tabs (Estatísticas / Protocolos)

### Integração com Calculadora
- [x] ProtocolSelector modificado para incluir protocolos customizados do banco
- [x] Protocolos customizados aparecem em seção separada no seletor

### Testes
- [x] Testes de validação de input (nome vazio, drogas vazias, dose negativa, unidade inválida)
- [x] Testes de autorização (endpoints protegidos requerem autenticação)
- [x] Testes de validação de dilutionInfo
- [x] Testes de ajustes de dose
- [x] Testes de atualização parcial
- [x] 18 testes passando (286 total no projeto)

---

## Importação/Exportação de Protocolos e Migração

### Migração de Protocolos Pré-cadastrados
- [x] Analisar estrutura dos 51 protocolos existentes em data/protocols.ts
- [x] Criar script de migração para converter protocolos para formato custom_protocols
- [x] Executar migração inserindo todos os protocolos no banco de dados
- [x] Marcar protocolos migrados como "sistema" (não editáveis pelo usuário comum)

### Importação/Exportação JSON
- [x] Endpoint tRPC para exportar protocolos selecionados como JSON
- [x] Endpoint tRPC para importar protocolos a partir de JSON
- [x] Validação de formato JSON na importação
- [x] Botão de exportar protocolo(s) no ProtocolManager
- [x] Botão de importar protocolo(s) no ProtocolManager
- [x] Feedback visual de sucesso/erro na importação

### Testes
- [x] Testes de validação de importação JSON
- [x] Testes de exportação
- [x] Verificar migração dos protocolos no banco

---

## Calculadora de Hidratação e Suporte

### Hidratação Pré/Pós-QT
- [x] Lógica de cálculo de volume de hidratação baseado em peso e protocolo
- [x] Esquemas de hidratação para protocolos nefrotóxicos (Cisplatina, HD-MTX, Ifosfamida)
- [x] Esquema de hidratação padrão (SF 0,9% e SG 5%)
- [x] Cálculo de velocidade de infusão (mL/h) baseado em peso e função renal
- [x] Alertas para pacientes com ICC ou sobrecarga hídrica

### Reposição de Eletrólitos
- [x] Cálculo de reposição de Potássio (KCl) baseado no nível sérico
- [x] Cálculo de reposição de Magnésio (MgSO4) baseado no nível sérico
- [x] Cálculo de reposição de Cálcio (Gluconato de Cálcio) baseado no CaI
- [x] Cálculo de reposição de Fósforo baseado no nível sérico
- [x] Cálculo de reposição de Sódio (NaCl 3%) para hiponatremia
- [x] Alertas de velocidade máxima de infusão e compatibilidade

### Suporte Transfusional
- [x] Indicação de transfusão de concentrado de hemácias (Hb < 7 ou sintomática)
- [x] Indicação de transfusão de plaquetas (Plaq < 10.000 ou < 20.000 com sangramento)
- [x] Cálculo de volume de concentrado de hemácias
- [x] Cálculo de volume de plaquetas (aférese vs pool)
- [x] Indicação de hemácias irradiadas e filtradas (TMO, imunossuprimidos)
- [x] Alertas de reações transfusionais e pré-medicação

### Interface e Integração
- [x] Componente HydrationCalculator com tabs (Hidratação, Eletrólitos, Transfusão)
- [x] Integração com dados do paciente da calculadora principal
- [x] Botão de acesso rápido na calculadora principal
- [x] Geração de prescrição formatada para copiar/imprimir

### Testes
- [x] Testes de cálculos de hidratação
- [x] Testes de reposição de eletrólitos
- [x] Testes de suporte transfusional
- [x] Testes de alertas e limites de segurança

---

## Exportação de Hidratação/Eletrólitos no PDF

- [x] Analisar componente PrintablePrescription e fluxo de geração de PDF
- [x] Adicionar seção de esquema de hidratação no componente de impressão
- [x] Adicionar seção de reposição de eletrólitos no componente de impressão
- [x] Adicionar seção de suporte transfusional no componente de impressão
- [x] Conectar dados calculados de hidratação ao fluxo de exportação PDF
- [x] Incluir alertas e monitorização no PDF
- [x] Testar geração do PDF com as novas seções

---

## Preview do PDF antes de Gerar

- [x] Analisar fluxo atual de geração de PDF (pdfGenerator.ts, usePrescriptionActions)
- [x] Criar componente PdfPreviewModal com renderização visual do documento
- [x] Incluir todas as seções no preview: dados do paciente, doses, profilaxias, hidratação, eletrólitos, transfusão
- [x] Permitir personalizar quais seções incluir no PDF (checkboxes de seções)
- [x] Botão "Confirmar e Gerar PDF" no modal de preview
- [x] Botão "Imprimir" direto do modal de preview
- [x] Integrar modal ao botão PDF do Calculator.tsx
- [x] Testar renderização do preview com dados completos

---

## Revisão de design — 13/11/2026

Escopo: inspecionar a interface existente da calculadora e seus modais, preservando cálculos e conteúdo clínico. Priorizar problemas de responsividade, legibilidade e acessibilidade; alterações estruturais dependem de aprovação.

- [x] Registrar capturas antes da revisão em 375, 768, 1280 e 1920 px.
- [x] Inspecionar fluxo do paciente, seleção de protocolo, hidratação e prévia do PDF com dados fictícios.
- [x] Identificar problemas comprovados e suas causas nos componentes.
- [x] Corrigir cabeçalho responsivo, limites e rolagem da prévia A4, rótulos de 12 seções, cabeçalho da hidratação, upload móvel de logo, tamanhos de toque e texto, rótulos dos exames, idioma HTML e zoom. Sem alterações de regras clínicas.
- [x] Revalidar 20 estados em quatro larguras e configurações móveis: 96 verificações sem falhas; confirmar idioma/zoom e filtros visuais. Suíte de 377 testes, TypeScript e build aprovados.
- [x] Preparar relatório com capturas e limites; salvar checkpoint de entrega.

Pendências explicitamente fora desta revisão visual:
- [ ] Revisar divergência clínica: R-DHAP cadastrado com Carboplatina, mas hidratação detectada como Cisplatina pelo nome do protocolo.
- [ ] Fazer a impressão direta respeitar PdfSections, atualmente ignoradas por handlePrint/PrintablePrescription.
- [ ] Revisar estratégia de cache/Service Worker para não manter interfaces antigas em desenvolvimento e após atualizações.
- [ ] Investigar gráficos vazios e classificação no Dashboard; exibir rastreabilidade da versão e validação das métricas de IA.

---

## Integração segura dos 52 protocolos — 13/11/2026

Desenho aprovado pelo usuário: `/home/ubuntu/protocolos-integracao/desenho-integracao-52-protocolos.md`. Biblioteca revisada para consulta/simulação; sem homologação ou liberação de prescrição dos rascunhos.

- [x] Preservar o JSON original, hash, fontes e biblioteca legada; integrar 52 documentos sem alteração clínica inferida.
- [x] Criar contratos e resolver de calendários/fases com testes RED/GREEN; frequência, unidades, doses diárias divididas e pendências fail-closed.
- [x] Persistir documento clínico completo, importação/exportação sem perda e sincronização idempotente por usuário/versão; preservar personalizados. Migração 0009 nullable aplicada e registrada; sincronização disponível por ação explícita, não executada globalmente.
- [x] Integrar seleção padrão, fase/ciclo/dia, simulação sem ajustes genéricos e painel de fontes/pendências/diluição do documento.
- [x] Bloquear saídas de prescrição frontend/backend e impedir bypass por todos os 51 protocolos históricos/aliases correspondentes.
- [x] Vincular hidratação às drogas efetivas; não inferir cisplatina em R-ICE ou ifosfamida em FLAG-Ida; exibir requisitos múltiplos sem somar esquemas.
- [x] Auditar determinísticamente os 52 documentos, rodar suíte completa/TypeScript/build e validar navegador com dados fictícios. Dez verificações de interface passaram. Testes legados de CRUD isolados do banco; revertidos estritamente oito registros fictícios criados pela execução anterior, com backup; nenhum paciente ou prescrição alterado.
- [x] Preparar entrega com documento exportável intacto, relatório de integração e auditoria de calendários; 648 testes/28 arquivos, TypeScript, build e round-trip aprovados. Checkpoint restaurável salva o estado de entrega.

---

## Templates ativos e importação de 53 protocolos — 14/11/2026

Desenho aprovado: `/home/ubuntu/protocolos-integracao/desenho-templates-utilizaveis-2026-11-14.md`. Não implementar página IndexedDB ou checklists; não liberar rascunhos antigos.

- [x] Criar formato de template gerenciado pelo usuário, normalização lossless 2.18/BrECADD 1.0, rastreabilidade e importação idempotente; preservar arquivos originais e cadastros existentes.
- [x] Separar templates ativos de rascunhos; resolver extensões/fases sem escolhas inferidas; mapear doses/unidades/frequências/contexto às saídas.
- [x] Confirmar autoridade do registro armazenado e propriedade; revalidar contexto/doses no backend e impedir spoof de templates para liberar rascunhos antigos. Auditoria server-side preservada no histórico, sem confiança em flags do cliente.
- [x] Integrar catálogo, painel, salvamento, cópia/PDF/impressão e suporte; impedir saída parcial, vazia ou não resolvida. Impressão respeita PdfSections.
- [x] Executar testes RED/GREEN: 733 testes/40 arquivos, TypeScript e build aprovados. Navegador: 13 verificações em interface real, zero gravações externas. Fixture original incluída no projeto para reproduzir os testes. Documentos usam eGFR indexado e não indicam ajuste automático/dose completa pelo status renal do template. Gerenciador rotula corretamente os 53 templates ativos.
- [x] Autenticar conta e importar efetivamente: 53 importados, zero ignorados; 53 ativos confirmados no banco. Conta não possuía cadastros customizados anteriores. Nenhum paciente ou prescrição médica criado durante a validação.
- [x] Preparar entrega com arquivo compatível, comprovante de importação e limites remanescentes. Checkpoint restaurável será salvo na entrega; publicação deve ser acionada no painel do Manus para atualizar o domínio existente.

Limites: decisões de idade/nível/alternativas ainda não interpretadas exigem revisão do JSON completo; não existe editor gráfico avançado novo. Fase e GFR absoluto possuem controles explícitos. Antiemese e resgates não são preenchidos por esquema genérico. A biblioteca antiga permanece bloqueada e separada dos templates ativos.

---

## Correção pontual — opção UI/m² — 14/11/2026

Escopo: restaurar a unidade já suportada pelo motor no cadastro/edição, sem alterar protocolos armazenados ou liberar rascunhos.

- [x] Reproduzir a ausência no formulário e a rejeição dos endpoints com testes de comportamento (RED observado); erros de unidade mg nas saídas reproduzidos.
- [x] Incluir UI/m² no seletor e contratos CRUD; preservar UI no resultado do hook, tabela, fallback PDF/impressão e toast de ajuste manual; máximo rotulado na unidade física correta. Fórmula numérica do motor e protocolos armazenados intactos.
- [x] Verificar import/export JSON, cálculo por SC e teto absoluto em UI: 739 testes/42 arquivos, TypeScript e build aprovados. Navegador selecionou UI/m² e confirmou Dose Máxima (UI), com zero gravações externas.
- [x] Preparar correção verificada para checkpoint e entrega; atualização do domínio depende da publicação no painel do Manus.

---

## Correções P1 da revisão b9f481aa — 14/11/2026

Pedido explícito do usuário: corrigir os P1 do relatório `/home/ubuntu/code-review/relatorio-revisao-calculadora-2026-11-14.md`. Escopo delimitado: isolamento estrito por usuário; histórico v1/v2 como snapshot, nova execução somente com cadastro íntegro; Calvert exige GFR absoluto explícito sem escolha automática de método. Não alterar protocolos, pacientes ou prescrições armazenados.

- [x] P1-01: consultas/mutações por proprietário, paciente próprio existente antes de criar prescrição e identidade coerente; GET privado de protocolo também corrigido.
- [x] P1-02: sessão explícita de paciente; overrides/contexto/GFR/toxicidades/suporte limpos na troca; medidas debounced anteriores imediatamente invalidadas; edição biométrica da mesma sessão preserva override.
- [x] P1-03: adapter v1/v2 para histórico/timeline/carregamento; snapshot somente para consulta e nova execução somente com cadastro íntegro atual. Identidade divergente não reutilizada, idade atual preservada e dias/schedule normalizados.
- [x] P1-04/05/06: gates uniformes no documento/fase/droga/agenda/extensões; política explícita de 24h respeitada; aliases canonicalizados; conflitos/origens incomparáveis bloqueados sem inventar offsets.
- [x] P1-07: agendas/frequência/base BrECADD explícitas preservadas; síntese apenas quando ausentes. Documentos armazenados não migrados ou reescritos.
- [x] P1-08: ordens de template positivas, comparação relativa de precisão de ponto flutuante sem piso absoluto0.01, persistência de números autoritativos e formatação preservando doses pequenas; legado não arredonda acima do teto pequeno.
- [x] P1-09: Calvert legado usa somente GFR absoluto explícito, com campo/payload/metadados separados de eGFR indexado; sem entrada não há dose administrável/fallback AUC em mg.
- [x] RED/GREEN incorporados: 1.031 testes/54 arquivos, DATABASE_URL='' durante toda a suíte, TypeScript/build aprovados. Navegador: 15 verificações, sem exceções JS e zero gravações externas. Fixtures/scripts e renderer React de testes incluídos no projeto.
- [x] Revisão integrada e relatório preparado; checkpoint restaurável salva a entrega. P2-01/02/03 e GET privado adjacentes atendidos. P2-04/05/06 e limites defensivos/concorrência permanecem declarados. Publicação deve ser acionada no painel; nenhum registro clínico alterado.

---

## Correção ProphylaxisAlerts — 15/11/2026

Erro informado: leitura de length em lista undefined na seleção de protocolo. Escopo: fronteira de exibição, sem alterar protocolos/doses/banco ou regras de liberação de prescrição.

- [x] Reproduzir no componente real as exceções de length/map em campos ausentes/nulos. Catálogo atual já normaliza registros e os 51 estáticos têm listas; não atribuir o incidente a um registro específico sem evidência. Nenhum dado assistencial consultado.
- [x] Normalizar defensivamente seis listas clínicas e quatro listas de antiemese na apresentação. Textos válidos preservados, fonte não modificada e dados ausentes/inválidos explicitados, sem inferir recomendações ou mudar regras de prescrição.
- [x] Validar todas as abas com Chromium real: 18 verificações, entradas mínimas/nulas/mistas/completas, sem exceções JS/overflow ou gravações externas. Regressões SSR incorporadas: suíte completa 1.047 testes/55 arquivos, TypeScript/build e diff--check aprovados, DATABASE_URL='' nos testes. Cache apenas da prévia invalidado para evitar componente antigo.
- [x] Preparar entrega verificada para checkpoint restaurável; publicação da nova versão deve ser acionada no painel do Manus.
