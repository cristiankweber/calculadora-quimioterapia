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
