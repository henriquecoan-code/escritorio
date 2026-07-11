---
name: Dashboard Workflow Instruction
description: "Use ao editar UI do dashboard, integracao com Firebase, testes Playwright ou regras do Firestore neste repositorio."
applyTo:
  - index.html
  - scripts/**/*.js
  - tests/**/*.js
  - firestore.rules
  - styles/**/*.css
---

# Regras de workflow do repositorio

- Mantenha estaveis os IDs de elemento usados pelos testes, exceto quando a mudanca exigir novos seletores.
- Se seletores ou comportamento visivel ao usuario mudarem, atualize os testes correspondentes na mesma tarefa.
- Prefira edicoes pequenas e locais em vez de grandes refatoracoes.
- Mantenha autenticacao Firebase como gate obrigatorio para dados protegidos do dashboard.
- Nao use pastas de saida geradas como arquivos fonte de implementacao.

# Requisitos de validacao

- Rode npm run validate apos edicoes de codigo.
- Rode npm run test:rules ao alterar firestore.rules ou comportamento de permissao de dados.
- Relate o que foi executado e quaisquer riscos residuais.

# Notas do projeto

- A pagina principal de entrada e index.html.
- A logica principal de frontend esta em scripts/dashboard.js.
- O comportamento de tema esta em scripts/theme.js.
- A cobertura E2E fica em tests/e2e.
