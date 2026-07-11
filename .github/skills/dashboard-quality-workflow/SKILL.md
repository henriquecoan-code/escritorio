---
name: dashboard-quality-workflow
description: "Use para validar mudancas no dashboard, fluxos de autenticacao/dados no Firebase, testes Playwright smoke/real, regras do Firestore e gates de seguranca para release. Palavras-chave: validar, smoke, e2e, regras, firebase, dashboard."
argument-hint: "Descreva a mudanca e o nivel de validacao necessario (rapido, padrao, release)."
user-invocable: true
---

# Fluxo de Qualidade do Dashboard

## Quando usar
- Qualquer mudanca de UI ou comportamento nas paginas do dashboard.
- Qualquer mudanca envolvendo auth Firebase, sync com Firestore ou regras.
- Antes de abrir PR ou executar checklist de release.

## Procedimento
1. Confirme as areas impactadas:
   - Estrutura principal da app e abas.
   - Overlay de autenticacao e fluxo de sessao.
   - Barra de sincronizacao e estados de carregamento do Firestore.
2. Rode o gate rapido de qualidade local:
   - npm run validate
3. Se regras de dados mudaram ou o risco for medio/alto:
   - npm run test:rules
4. Se fluxo de auth ou CRUD mudou:
   - npm run test:e2e:real (com variaveis de ambiente configuradas)
5. Reporte o resultado como:
   - o que mudou
   - o que foi testado
   - riscos residuais

## Guardrails
- Nao edite artefatos gerados como fonte de verdade.
- Mantenha estaveis os seletores usados pelos testes quando possivel.
- Se seletores precisarem mudar, atualize testes na mesma tarefa.
- Mantenha padrao de seguranca: autenticacao obrigatoria para acesso aos dados.

## Atalhos do projeto
- Validacao unificada: npm run validate
- Testes de regras: npm run test:rules
- Apenas smoke: npm run test:e2e:smoke:local
