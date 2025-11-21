# Calculadora de Prescrição Quimioterápica

![CI/CD Pipeline](https://github.com/SEU_USUARIO/calculadora-quimioterapia/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-68%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![React](https://img.shields.io/badge/React-19-blue)

Sistema completo para cálculo e prescrição de protocolos de quimioterapia com foco em hematologia e transplante de medula óssea.

## 🚀 Funcionalidades

### Cálculos Automáticos
- **Superfície Corporal (SC)**: Fórmula de DuBois
- **Taxa de Filtração Glomerular (eGFR)**: CKD-EPI 2021
- **Ajustes de Dose**: Automáticos por função renal, hepática, ECOG e toxicidade CTCAE v5.0
- **Dose Máxima**: Respeita limites absolutos por droga (ex: Vincristina máx 2mg)
- **Calvert para Carboplatina**: Cálculo automático de dose por AUC

### 43 Protocolos Implementados
- **LMA**: 7+3, FLAG-Ida, HiDAC, Aza+Ven, SMILE
- **LLA**: ALL IC-BFM 2009 (pediátrica), GRAALL-2003/2005 (adulto), Hyper-CVAD A/B
- **Linfomas**: R-CHOP, R-ICE, R-DHAP, DA-R-EPOCH, R-mini-CHOP, R-CVP, BR, GDP, R-Pola-CHP, R-CODOX-M, R-IVAC
- **Hodgkin**: ABVD, Brentuximabe Vedotina
- **Mieloma Múltiplo**: VRd, DARA-VRd, VCd, D-Rd, D-Vd, D-VTD, ISA-VRd, Teclistamab
- **LLC**: FCR, Ibrutinib, Venetoclax
- **TKIs**: Imatinib, Dasatinib, Nilotinib (LMC)
- **Mielofibrose**: Ruxolitinib
- **TMO**: MEL200, BuFlu MAC, BuFlu RIC
- **Imunoterapias**: Epcoritamab, CAR-T (orientações completas)

### Profilaxias Automáticas
- **Antiemética**: Esquemas por risco emetogênico (Fosaprepitanto, Ondansetrona, Olanzapina)
- **Anti-infecciosa**: Pneumocystis, antiviral, antifúngica
- **Tromboprofilaxia**: Conforme protocolo
- **Alertas Específicos**: QT prolongado, Tramadol×Ondansetrona, fotossensibilidade

### Avaliação de Toxicidade CTCAE v5.0
- **Hematológicas**: Neutropenia, plaquetopenia, anemia
- **Não-hematológicas**: Neuropatia periférica, diarreia, mucosite oral, hepatotoxicidade, nefrotoxicidade
- **Ajuste Automático**: Fator de redução de dose calculado por grau

### Diluição e Infusão
- Cálculo automático de volume de diluição baseado em concentração máxima (CMI/HCPA)
- Velocidade de infusão (mL/h) e tempo total
- Alertas de compatibilidade (PVC, fotossensibilidade, equipos especiais)
- 12 medicamentos com parâmetros completos

### Histórico e Rastreabilidade
- **Banco de Dados PostgreSQL**: Persistência permanente de pacientes e prescrições
- **Doses Cumulativas**: Rastreamento automático de antraciclinas com alertas de cardiotoxicidade
- **QR Code**: Rastreabilidade completa de cada prescrição
- **Busca e Filtros**: Histórico completo por paciente

### Dashboard de Estatísticas
- **Visão Geral**: Total de prescrições, pacientes, protocolos e atividade recente
- **Protocolos Mais Prescritos**: Top 10 com gráfico de barras
- **Distribuição por Patologia**: Gráfico de pizza por indicação clínica
- **Tendências Temporais**: Gráfico de linha dos últimos 30 dias

### Exportação e Impressão
- **PDF Profissional**: Formatação médica completa
- **Modo de Impressão**: Layout A4 otimizado para prontuário eletrônico
- **Compatibilidade**: TASY, MV, Philips
- **Cabeçalho Customizável**: Logo e dados institucionais
- **Assinatura Digital**: Espaço para validação

### Configurações Institucionais
- Nome da instituição e logo
- Dados do prescritor (nome, CRM, especialidade)
- Templates de cabeçalho e rodapé customizáveis
- Salvamento automático no banco de dados

## 🛠️ Stack Tecnológica

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4 + shadcn/ui
- **Backend**: Express.js + tRPC 11
- **Banco de Dados**: PostgreSQL (MySQL/TiDB) + Drizzle ORM
- **Testes**: Vitest (68 testes passando)
- **CI/CD**: GitHub Actions (testes automatizados, lint, build)
- **Deploy**: Manus Platform

## 📊 Qualidade

- ✅ **68 testes unitários passando**
- ✅ **Cobertura completa de cálculos críticos**
- ✅ **TypeScript strict mode**
- ✅ **Otimizações de performance** (React.memo, lazy loading)
- ✅ **CI/CD automatizado** (testes, lint, build)

## 🚀 Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Aplicar migrations do banco de dados
pnpm db:push

# Rodar testes
pnpm test

# Iniciar servidor de desenvolvimento
pnpm dev

# Build para produção
pnpm build
```

## 📝 Roadmap

### Fase 1 (Concluída) ✅
- [x] 10 novos protocolos (LLA, Linfomas, Mieloma, TKIs, TMO)
- [x] Dashboard de estatísticas
- [x] CI/CD automatizado

### Fase 2 (Próximos 3 meses)
- [ ] Busca avançada de prescrições com filtros
- [ ] Sistema de favoritos e templates personalizados
- [ ] Exportação em lote (múltiplas prescrições em PDF único)
- [ ] Integração com prontuário eletrônico via API

### Fase 3 (6 meses)
- [ ] Calculadora de suporte nutricional oncológico
- [ ] Protocolos pediátricos expandidos
- [ ] Sistema de alertas inteligentes baseado em ML
- [ ] App mobile (React Native)

## 📄 Licença

Uso interno institucional. Todos os direitos reservados.

## 👥 Contribuindo

Este é um projeto interno. Para sugestões ou bugs, entre em contato com a equipe de desenvolvimento.

---

**Versão**: 5.0  
**Última atualização**: Janeiro 2025  
**Protocolos**: 43 implementados  
**Testes**: 68 passando
