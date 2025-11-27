# Calculadora de Quimioterapia - TODO

## 📊 Status Atual do Projeto

**Versão:** 0f6162ce (última checkpoint)  
**Protocolos Implementados:** 43  
**Testes Passando:** 102/102 ✅  
**Features:** Database, Server, User Auth

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

### Protocolos Implementados (43 total)

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
- [ ] Autocomplete no campo de busca de protocolos (sugestões enquanto digita)
- [x] Histórico de prescrições por paciente (modal com timeline)

### Novos Protocolos (Média Prioridade)
- [ ] ALL IC-BFM 2009 (LLA)
- [ ] GRAALL-2003/2005 (LLA)
- [ ] R-Pola-CHP (DLBCL 1ª linha)
- [ ] R-CODOX-M (Burkitt)
- [ ] R-IVAC (Burkitt alternado)
- [ ] R-Clorambucil (LLC/Linfoma indolente)
- [ ] D-VTD (Daratumumabe + Bortezomibe + Talidomida + Dex)
- [ ] ISA-VRd (Isatuximabe + VRd)
- [ ] Isa-KRd (Isatuximabe + Carfilzomibe + Revlimid + Dex)
- [ ] D-VMP (Daratumumabe + Bortezomibe + Melfalano + Pred)
- [ ] D-Pd (Daratumumabe + Pomalidomida + Dex)
- [ ] BuFlu RIC (Bussulfano + Fludarabina - intensidade reduzida)
- [ ] Acalabrutinib (BTKi)
- [ ] Imatinib, Dasatinib, Nilotinib, Ponatinib (TKIs - LMC)
- [ ] Ruxolitinib (Mielofibrose)
- [ ] Teclistamab (Mieloma)
- [ ] Talquetamab (Mieloma)

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
- **Testes unitários:** 102 passando
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
