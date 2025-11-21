# Plano Estratégico de Aprimoramento
## Transformando a Calculadora em Referência Nacional em Hematologia e TMO

**Documento:** Plano de Aprimoramento 2025-2026  
**Objetivo:** Tornar a Calculadora de Prescrição Quimioterápica a ferramenta de referência em Hematologia e Transplante de Medula Óssea no Brasil  
**Horizonte:** 18 meses (Janeiro/2025 - Junho/2026)  
**Autor:** Equipe de Desenvolvimento  
**Versão:** 1.0

---

## 1. Visão e Missão

### Visão
Ser a plataforma digital mais confiável e completa para prescrição de quimioterapia em Hematologia e Transplante de Medula Óssea no Brasil até 2026, reconhecida pela Sociedade Brasileira de Hematologia e Hemoterapia (SBHH) e adotada por pelo menos 50 centros de referência.

### Missão
Reduzir erros de prescrição em quimioterapia hematológica através de cálculos validados, alertas de segurança inteligentes e profilaxias baseadas em evidências, melhorando a qualidade do cuidado e a segurança do paciente oncohematológico.

### Valores
- **Precisão:** Cálculos validados por testes unitários e revisão de especialistas
- **Segurança:** Alertas de toxicidade e profilaxias baseadas em guidelines internacionais
- **Transparência:** Código open-source auditável e referências bibliográficas completas
- **Inovação:** Incorporação de novas terapias e tecnologias (CAR-T, biespecíficos, IA)
- **Acessibilidade:** Gratuito para médicos e instituições públicas

---

## 2. Análise de Mercado e Concorrência

### Cenário Atual
O mercado brasileiro de prescrição eletrônica em oncohematologia é fragmentado, com soluções genéricas que não atendem às especificidades da área. Principais lacunas identificadas:

**Sistemas Genéricos de Prontuário Eletrônico (TASY, MV, Philips):**
- ❌ Não calculam doses automaticamente por SC/peso
- ❌ Não ajustam por função renal/hepática
- ❌ Não sugerem profilaxias específicas
- ❌ Não validam dose cumulativa de antraciclinas
- ❌ Não alertam para cardiotoxicidade/nefrotoxicidade

**Calculadoras Online Genéricas:**
- ❌ Focadas em oncologia sólida (não hematologia)
- ❌ Protocolos desatualizados ou incompletos
- ❌ Sem integração com prontuário eletrônico
- ❌ Sem rastreabilidade ou histórico de pacientes
- ❌ Interface não otimizada para workflow médico

**Planilhas Excel Artesanais:**
- ❌ Propensas a erros de digitação
- ❌ Sem validação de fórmulas
- ❌ Não compartilháveis entre equipes
- ❌ Sem controle de versão
- ❌ Risco de perda de dados

### Oportunidades de Mercado

**Público-Alvo Primário:**
- Hematologistas (≈2.500 no Brasil)
- Oncohematologistas pediátricos (≈500)
- Médicos residentes em Hematologia (≈300/ano)
- Farmacêuticos oncológicos (≈1.000)

**Público-Alvo Secundário:**
- Enfermeiros de quimioterapia (≈5.000)
- Gestores de centros de TMO (≈100 centros)
- Pesquisadores clínicos em hematologia

**Instituições-Alvo:**
- Centros de TMO credenciados (≈100 no Brasil)
- Hospitais universitários com programa de hematologia (≈50)
- Hospitais privados de alta complexidade (≈200)
- Clínicas de oncologia com setor de hematologia (≈300)

### Diferenciais Competitivos

Nossa calculadora já possui vantagens únicas que devem ser fortalecidas:

1. **Especialização em Hematologia:** 30 protocolos específicos (vs. 0 nos concorrentes)
2. **Validação Científica:** 68 testes unitários (vs. nenhum nos concorrentes)
3. **CTCAE v5.0:** Ajuste de dose por toxicidade real (vs. ajuste manual)
4. **Rastreabilidade:** QR code e banco de dados (vs. sem histórico)
5. **Profilaxias Automáticas:** Antieméticos, anti-infecciosos, tromboprofilaxia (vs. manual)
6. **Performance:** Lazy loading e React.memo (vs. interfaces lentas)
7. **Open Source:** Código auditável (vs. caixa-preta proprietária)

---

## 3. Roadmap Estratégico (18 meses)

### Fase 1: Consolidação Técnica (Meses 1-3)
**Objetivo:** Tornar a plataforma robusta, rápida e confiável

#### Funcionalidades
1. **Dashboard de Estatísticas** (Mês 1)
   - Protocolos mais utilizados (gráfico de barras)
   - Distribuição por indicação (gráfico de pizza)
   - Alertas de toxicidade mais frequentes (tabela)
   - Tendências de ajuste de dose ao longo do tempo (linha do tempo)
   - Métricas de uso (prescrições/dia, usuários ativos)

2. **Busca Avançada de Prescrições** (Mês 2)
   - Filtros por período (data inicial/final)
   - Filtros por protocolo, médico prescritor, indicação
   - Busca por ID via QR code (scanner integrado)
   - Exportação em lote (múltiplas prescrições em PDF único)
   - Auditoria completa (quem prescreveu, quando, alterações)

3. **Sistema de Favoritos e Personalização** (Mês 3)
   - Marcar protocolos favoritos (estrela)
   - Ordenação personalizada de protocolos
   - Templates de prescrição salvos
   - Configurações de usuário (preferências de dose, alertas)
   - Atalhos de teclado para workflow rápido

4. **Otimização de Performance** (Contínuo)
   - Implementar service worker para cache offline
   - Otimizar bundle size (target: <500KB)
   - Implementar paginação em listas longas
   - Adicionar skeleton loading em componentes pesados

#### Protocolos Adicionais (10 novos)
- ALL IC-BFM 2009 (LLA pediátrica)
- GRAALL-2003/2005 (LLA adulto)
- R-Pola-CHP (DLBCL 1ª linha)
- R-CODOX-M / R-IVAC (Burkitt)
- D-VTD (Daratumumabe + Bortezomibe + Talidomida + Dex)
- ISA-VRd (Isatuximabe + VRd)
- BuFlu RIC (condicionamento intensidade reduzida)
- Imatinib, Dasatinib, Nilotinib (TKIs para LMC)
- Ruxolitinib (Mielofibrose)
- Teclistamab (Mieloma refratário)

#### Métricas de Sucesso
- ✅ 40 protocolos implementados
- ✅ Dashboard funcional com 5+ métricas
- ✅ Busca avançada com 5+ filtros
- ✅ Sistema de favoritos operacional
- ✅ Bundle size <500KB
- ✅ 100+ testes unitários

---

### Fase 2: Integração e Segurança (Meses 4-9)
**Objetivo:** Integrar com prontuários eletrônicos e fortalecer segurança

#### Funcionalidades
1. **API Pública para Integração** (Mês 4-5)
   - Documentação completa (OpenAPI/Swagger)
   - Endpoints REST para cálculos de dose
   - Webhooks para notificações de alertas
   - SDK em JavaScript/TypeScript
   - Rate limiting e autenticação (OAuth 2.0)

2. **Integração com Prontuários Eletrônicos** (Mês 6-8)
   - **TASY:** Plugin para importar dados laboratoriais
   - **MV:** API para exportar prescrições
   - **Philips:** Integração bidirecional (import/export)
   - Suporte a HL7/FHIR para interoperabilidade
   - Testes de integração com ambientes de homologação

3. **Relatórios de Segurança e Qualidade** (Mês 7-9)
   - **Dashboard de Cardiotoxicidade:**
     - Gráfico de dose cumulativa de antraciclinas por paciente
     - Alertas de risco (amarelo: >300mg/m², vermelho: >450mg/m²)
     - Histórico de ecocardiogramas (se integrado com prontuário)
   
   - **Dashboard de Nefrotoxicidade:**
     - Evolução de eGFR ao longo do tempo
     - Alertas de piora de função renal (queda >25%)
     - Drogas nefrotóxicas utilizadas (Cisplatina, Ifosfamida, etc.)
   
   - **Análise de Ajustes de Dose:**
     - Protocolos com maior frequência de ajuste
     - Toxicidades mais comuns por protocolo
     - Comparação entre centros (benchmarking)

4. **Sistema de Permissões e Auditoria** (Mês 9)
   - Perfis de usuário (médico, farmacêutico, enfermeiro, gestor)
   - Permissões granulares (criar, editar, aprovar, visualizar)
   - Audit trail completo (quem fez o quê, quando)
   - Assinatura digital de prescrições (certificado ICP-Brasil)
   - Logs de acesso para compliance

#### Protocolos Adicionais (10 novos)
- Isa-KRd (Isatuximabe + Carfilzomibe + Revlimid + Dex)
- D-VMP (Daratumumabe + Bortezomibe + Melfalano + Pred)
- D-Pd (Daratumumabe + Pomalidomida + Dex)
- R-Clorambucil (LLC/Linfoma indolente)
- Acalabrutinib (BTKi - LLC)
- Ponatinib (TKI - LMC com mutação T315I)
- Talquetamab (Mieloma refratário)
- Protocolos de manutenção (Lenalidomida, Bortezomibe)
- Protocolos de resgate (Clofarabina, Nelarabina)
- Protocolos pediátricos (COG, BFM)

#### Métricas de Sucesso
- ✅ API pública documentada e funcional
- ✅ Integração com 3+ prontuários eletrônicos
- ✅ Relatórios de segurança operacionais
- ✅ Sistema de permissões implementado
- ✅ 50 protocolos implementados
- ✅ 1000+ prescrições salvas no banco

---

### Fase 3: Inovação e Expansão (Meses 10-18)
**Objetivo:** Incorporar IA, expandir para mobile e buscar certificação

#### Funcionalidades
1. **Inteligência Artificial para Sugestão de Protocolos** (Mês 10-12)
   - **Modelo de ML:** Random Forest ou XGBoost
   - **Inputs:** Diagnóstico (CID-10), idade, ECOG, citogenética, mutações
   - **Outputs:** Top 3 protocolos recomendados com probabilidade
   - **Treinamento:** Dados históricos de 1000+ prescrições
   - **Validação:** Acurácia >80% vs. decisão de especialista
   - **Interface:** Sugestão automática ao preencher diagnóstico

2. **Predição de Toxicidade** (Mês 12-14)
   - **Modelo de ML:** Regressão logística ou rede neural
   - **Inputs:** Idade, função renal/hepática, comorbidades, protocolo
   - **Outputs:** Probabilidade de neutropenia G3-4, mucosite G3-4, etc.
   - **Alertas Preventivos:** "Risco de neutropenia febril: 45% → considerar G-CSF profilático"
   - **Validação:** AUC-ROC >0.75

3. **Aplicativo Mobile** (Mês 13-16)
   - **Tecnologia:** React Native (compartilha código com web)
   - **Funcionalidades:**
     - Calculadora offline (cálculos básicos sem internet)
     - Scanner de QR code para buscar prescrições
     - Notificações push (alertas de toxicidade, lembretes)
     - Sincronização com versão web
   - **Plataformas:** iOS e Android
   - **Publicação:** App Store e Google Play

4. **Calculadoras Especializadas** (Mês 14-16)
   - **Síndrome de Lise Tumoral (SLT):**
     - Cálculo de risco (Cairo-Bishop)
     - Recomendação de hidratação e rasburicase
   
   - **Risco Trombótico (Khorana Score):**
     - Cálculo de score
     - Recomendação de tromboprofilaxia
   
   - **Risco de Mucosite (MASCC):**
     - Cálculo de risco
     - Recomendação de palifermin/crioterapia
   
   - **Risco de Neutropenia Febril:**
     - Cálculo de risco
     - Recomendação de G-CSF profilático

5. **Certificação e Compliance** (Mês 16-18)
   - **ANVISA:** Registro como software médico (Classe I ou II)
   - **CFM:** Certificação de prescrição eletrônica
   - **SBIS:** Certificação de prontuário eletrônico
   - **ISO 13485:** Sistema de gestão de qualidade para dispositivos médicos
   - **LGPD:** Compliance total com Lei Geral de Proteção de Dados

#### Protocolos Adicionais (10 novos)
- Protocolos de LLA Ph+ (Imatinib + quimioterapia)
- Protocolos de LMA com IDH1/2 (Ivosidenib, Enasidenib)
- Protocolos de Linfoma do Manto (R-BAC, R-HyperCVAD)
- Protocolos de Linfoma T (CHOEP, SMILE)
- Protocolos de Leucemia de Células Pilosas (Cladribina)
- Protocolos de Macroglobulinemia de Waldenström
- Protocolos de Amiloidose AL
- Protocolos de Síndrome Mielodisplásica (Azacitidina, Decitabina)
- Protocolos de Neoplasias Mieloproliferativas (Hidroxiureia, Interferon)
- Protocolos de suporte (Transfusão, Quelação de Ferro)

#### Métricas de Sucesso
- ✅ IA para sugestão de protocolos (acurácia >80%)
- ✅ Predição de toxicidade (AUC-ROC >0.75)
- ✅ App mobile publicado (iOS + Android)
- ✅ 4 calculadoras especializadas
- ✅ Certificação ANVISA/CFM
- ✅ 60 protocolos implementados
- ✅ 5000+ prescrições salvas
- ✅ 50+ centros de referência usando

---

## 4. Estratégia de Adoção e Marketing

### Fase 1: Early Adopters (Meses 1-6)
**Objetivo:** 10 centros de referência usando ativamente

**Táticas:**
1. **Apresentação em Congressos:**
   - Congresso Brasileiro de Hematologia (SBHH)
   - Simpósio de Transplante de Medula Óssea (SBTMO)
   - Congresso de Oncologia Pediátrica (SOBOPE)

2. **Publicação Científica:**
   - Artigo original: "Validação de calculadora digital para prescrição de quimioterapia em hematologia"
   - Revista: Brazilian Journal of Hematology and Hemotherapy (BJHH)
   - Métricas: Redução de erros de prescrição, tempo economizado

3. **Parcerias Estratégicas:**
   - SBHH (Sociedade Brasileira de Hematologia e Hemoterapia)
   - SBTMO (Sociedade Brasileira de Transplante de Medula Óssea)
   - INCA (Instituto Nacional de Câncer)
   - Hospitais universitários (USP, UNICAMP, UFRJ, etc.)

4. **Programa de Beta Testers:**
   - Convite para 20 hematologistas de referência
   - Acesso antecipado a novas funcionalidades
   - Feedback estruturado (questionário mensal)
   - Reconhecimento como "Colaborador Científico"

### Fase 2: Expansão (Meses 7-12)
**Objetivo:** 50 centros de referência usando ativamente

**Táticas:**
1. **Webinars e Treinamentos:**
   - Webinar mensal: "Como usar a calculadora na prática clínica"
   - Vídeos tutoriais no YouTube (canal oficial)
   - Certificado de conclusão (4h de treinamento)

2. **Marketing Digital:**
   - Site institucional com casos clínicos
   - Blog com artigos sobre protocolos e guidelines
   - Newsletter mensal para hematologistas
   - Presença em redes sociais (LinkedIn, Instagram médico)

3. **Programa de Embaixadores:**
   - 10 hematologistas de referência como embaixadores
   - Apresentações em hospitais e clínicas
   - Depoimentos e casos de sucesso
   - Incentivos (acesso premium, reconhecimento)

4. **Integração com Residências Médicas:**
   - Treinamento obrigatório para residentes de hematologia
   - Material didático (manual, slides, exercícios)
   - Certificado de proficiência

### Fase 3: Consolidação (Meses 13-18)
**Objetivo:** 100+ centros usando, reconhecimento nacional

**Táticas:**
1. **Certificação Profissional:**
   - Curso online: "Prescrição Segura em Oncohematologia"
   - Certificado reconhecido pela SBHH
   - 20h de conteúdo (cálculos, protocolos, segurança)

2. **Parcerias Comerciais:**
   - Farmacêuticas (Roche, Takeda, Janssen, BMS)
   - Distribuidoras de medicamentos oncológicos
   - Planos de saúde (cobertura de prescrição digital)

3. **Prêmios e Reconhecimento:**
   - Prêmio de Inovação em Saúde Digital
   - Prêmio de Segurança do Paciente
   - Reconhecimento pela SBHH como ferramenta oficial

4. **Expansão Internacional:**
   - Tradução para espanhol (América Latina)
   - Tradução para inglês (mercado global)
   - Adaptação de protocolos para guidelines internacionais (NCCN, ESMO, ELN)

---

## 5. Modelo de Sustentabilidade Financeira

### Modelo Freemium

**Versão Gratuita (Free):**
- Acesso a 30 protocolos básicos
- Cálculos de dose (SC, eGFR, ajustes)
- Profilaxias automáticas
- Exportação de PDF (com marca d'água)
- Histórico de 10 pacientes
- Suporte por email (resposta em 48h)

**Versão Premium (R$ 99/mês ou R$ 990/ano):**
- Acesso a 60+ protocolos (incluindo raros e pediátricos)
- Dashboard de estatísticas completo
- Busca avançada ilimitada
- Exportação sem marca d'água
- Histórico ilimitado de pacientes
- Integração com prontuário eletrônico
- Sugestão de protocolos por IA
- Predição de toxicidade
- Suporte prioritário (resposta em 4h)
- Acesso ao app mobile

**Versão Institucional (R$ 2.990/mês):**
- Tudo da versão Premium
- Licenças ilimitadas para equipe
- Logo institucional personalizado
- Relatórios de qualidade e segurança
- API para integração customizada
- Treinamento presencial (1x/ano)
- Suporte dedicado (gerente de conta)
- SLA de 99,9% de uptime

### Projeção de Receita (18 meses)

**Mês 6:**
- 10 usuários Premium: R$ 990/mês
- 1 instituição: R$ 2.990/mês
- **Total:** R$ 3.980/mês

**Mês 12:**
- 50 usuários Premium: R$ 4.950/mês
- 5 instituições: R$ 14.950/mês
- **Total:** R$ 19.900/mês

**Mês 18:**
- 150 usuários Premium: R$ 14.850/mês
- 15 instituições: R$ 44.850/mês
- **Total:** R$ 59.700/mês

**Receita Acumulada (18 meses):** ≈R$ 500.000

### Custos Operacionais

**Infraestrutura (Mês):**
- Hospedagem (AWS/Azure): R$ 500
- Banco de dados: R$ 300
- CDN e storage: R$ 200
- Backup e segurança: R$ 200
- **Subtotal:** R$ 1.200/mês

**Desenvolvimento (Mês):**
- Desenvolvedor full-stack (1): R$ 8.000
- Designer UX/UI (0,5): R$ 4.000
- Hematologista consultor (0,25): R$ 3.000
- **Subtotal:** R$ 15.000/mês

**Marketing e Vendas (Mês):**
- Ads (Google, LinkedIn): R$ 2.000
- Eventos e congressos: R$ 1.000
- Material gráfico: R$ 500
- **Subtotal:** R$ 3.500/mês

**Total de Custos (Mês):** R$ 19.700/mês

**Ponto de Equilíbrio:** Mês 12 (R$ 19.900 receita vs. R$ 19.700 custos)

---

## 6. Riscos e Mitigação

### Riscos Técnicos

**Risco 1: Bugs em cálculos de dose**
- **Impacto:** Alto (segurança do paciente)
- **Probabilidade:** Baixa (68 testes unitários)
- **Mitigação:**
  - Revisão por hematologista antes de cada release
  - Testes automatizados obrigatórios (CI/CD)
  - Programa de bug bounty (recompensa por bugs críticos)

**Risco 2: Falha de integração com prontuários**
- **Impacto:** Médio (adoção institucional)
- **Probabilidade:** Média (APIs proprietárias)
- **Mitigação:**
  - Ambientes de homologação com fornecedores
  - Testes de integração automatizados
  - Fallback para exportação manual (PDF, CSV)

**Risco 3: Downtime da plataforma**
- **Impacto:** Alto (interrupção de serviço)
- **Probabilidade:** Baixa (SLA 99,9%)
- **Mitigação:**
  - Infraestrutura redundante (multi-AZ)
  - Monitoramento 24/7 (Datadog, New Relic)
  - Plano de disaster recovery (backup diário)

### Riscos Regulatórios

**Risco 4: Não obter certificação ANVISA**
- **Impacto:** Alto (limitação de uso)
- **Probabilidade:** Média (processo complexo)
- **Mitigação:**
  - Consultoria especializada em regulação
  - Documentação completa desde o início
  - Testes clínicos de validação

**Risco 5: Não conformidade com LGPD**
- **Impacto:** Alto (multas e processos)
- **Probabilidade:** Baixa (compliance desde o início)
- **Mitigação:**
  - Auditoria de privacidade (DPO)
  - Criptografia de dados sensíveis (AES-256)
  - Termo de consentimento explícito

### Riscos de Mercado

**Risco 6: Baixa adoção por médicos**
- **Impacto:** Alto (falta de receita)
- **Probabilidade:** Média (resistência a mudança)
- **Mitigação:**
  - Programa de treinamento intensivo
  - Demonstração de valor (redução de erros, tempo)
  - Versão gratuita generosa

**Risco 7: Concorrência de grandes players**
- **Impacto:** Médio (perda de mercado)
- **Probabilidade:** Baixa (nicho específico)
- **Mitigação:**
  - Foco em especialização (hematologia)
  - Parcerias estratégicas (SBHH, SBTMO)
  - Open source (comunidade engajada)

---

## 7. Indicadores de Sucesso (KPIs)

### Métricas de Produto

**Adoção:**
- Usuários ativos mensais (MAU): 500 em 18 meses
- Centros de referência usando: 50 em 18 meses
- Prescrições salvas: 5.000 em 18 meses
- Taxa de retenção (30 dias): >60%

**Engajamento:**
- Prescrições por usuário/mês: >10
- Tempo médio de prescrição: <5 minutos
- Taxa de uso de profilaxias automáticas: >80%
- Taxa de uso de ajustes de dose: >50%

**Qualidade:**
- Taxa de erro de cálculo: <0,1% (1 em 1000)
- Uptime: >99,5%
- Tempo de resposta (p95): <2 segundos
- Bugs críticos: 0 em produção

### Métricas de Negócio

**Receita:**
- MRR (Monthly Recurring Revenue): R$ 60.000 em 18 meses
- ARR (Annual Recurring Revenue): R$ 720.000 em 18 meses
- Churn rate: <5%/mês
- CAC (Customer Acquisition Cost): <R$ 500
- LTV (Lifetime Value): >R$ 5.000

**Crescimento:**
- Crescimento de usuários: >20%/mês (primeiros 12 meses)
- Crescimento de receita: >30%/mês (após Mês 6)
- NPS (Net Promoter Score): >50

### Métricas de Impacto Clínico

**Segurança:**
- Redução de erros de prescrição: >30% vs. prescrição manual
- Alertas de toxicidade disparados: >100/mês
- Doses cumulativas de antraciclinas monitoradas: >500 pacientes

**Eficiência:**
- Tempo economizado por prescrição: >10 minutos
- Redução de retrabalho (correções): >50%
- Aumento de adesão a profilaxias: >40%

**Qualidade:**
- Satisfação de médicos (NPS): >70
- Satisfação de farmacêuticos (NPS): >60
- Recomendação para colegas: >80%

---

## 8. Próximos Passos Imediatos (30 dias)

### Semana 1-2: Planejamento Detalhado
1. Revisar e aprovar este plano estratégico
2. Definir prioridades e cronograma detalhado
3. Alocar recursos (equipe, orçamento)
4. Configurar ferramentas de gestão de projeto (Jira, Trello)

### Semana 3-4: Início da Fase 1
1. Implementar Dashboard de Estatísticas (protótipo)
2. Adicionar 3 novos protocolos (ALL IC-BFM, GRAALL, R-Pola-CHP)
3. Configurar CI/CD para testes automatizados
4. Iniciar contato com SBHH para parceria

### Mês 2: Consolidação
1. Finalizar Dashboard de Estatísticas
2. Implementar Busca Avançada de Prescrições
3. Adicionar mais 5 protocolos
4. Preparar apresentação para congresso da SBHH

### Mês 3: Validação
1. Implementar Sistema de Favoritos
2. Otimizar performance (bundle size <500KB)
3. Recrutar 10 beta testers (hematologistas)
4. Preparar artigo científico para submissão

---

## 9. Conclusão

Este plano estratégico traça um caminho ambicioso mas realista para transformar a Calculadora de Prescrição Quimioterápica na ferramenta de referência em Hematologia e Transplante de Medula Óssea no Brasil. Com foco em **qualidade técnica**, **segurança do paciente** e **inovação contínua**, acreditamos que podemos impactar positivamente a prática clínica de milhares de hematologistas e, consequentemente, a vida de milhares de pacientes oncohematológicos.

Os próximos 18 meses serão decisivos para consolidar a plataforma, expandir a adoção e buscar certificações regulatórias. Com execução disciplinada, parcerias estratégicas e foco no usuário, estamos confiantes de que alcançaremos os objetivos traçados.

**Vamos juntos revolucionar a prescrição de quimioterapia em hematologia no Brasil!** 🚀

---

**Documento aprovado por:**  
- Equipe de Desenvolvimento  
- Consultores Médicos em Hematologia  
- Gestão de Produto  

**Data de Aprovação:** Janeiro/2025  
**Próxima Revisão:** Julho/2025
