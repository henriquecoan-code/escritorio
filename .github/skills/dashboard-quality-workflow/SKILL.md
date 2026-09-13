---
name: dashboard-quality-workflow
description: "Use para validar e rodar a suite de testes sob demanda (smoke tests Playwright, validacao de sintaxe, testes E2E e regras do Firestore). Use quando o usuario pedir explicitamente: 'testar', 'validar', 'rodar testes', 'fazer testes', 'smoke test' ou '/dashboard-quality-workflow'."
argument-hint: "Descreva o nivel ou tipo de teste desejado (smoke, validate, rules, e2e completo)."
user-invocable: true
---

# Fluxo de Qualidade e Testes Sob Demanda

## Quando usar
- Quando o usuário solicitar expressamente a execução de testes ou validações.
- Ao usar o comando `/dashboard-quality-workflow`.
- Antes de releases, deploys ou PRs caso o usuário queira rodar a validação geral.

## Procedimento
1. De acordo com o que foi solicitado:
   - **Validação e Smoke local**: `npm run validate`
   - **Apenas Smoke Playwright**: `npm run test:e2e:smoke:local`
   - **Regras do Firestore**: `npm run test:rules`
   - **E2E com fluxo real**: `npm run test:e2e:real`
2. Analisar os resultados e reportar:
   - Quantos testes passaram / falharam.
   - Detalhes de qualquer erro encontrado e sugestões de correção.

## Atalhos do projeto
- Validacao completa local: `npm run validate`
- Testes de regras de segurança: `npm run test:rules`
- Apenas testes smoke: `npm run test:e2e:smoke:local`
