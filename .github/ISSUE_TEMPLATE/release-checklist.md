---
name: Release checklist (manual)
about: Checklist rapido antes de publicar o dashboard
title: "release: checklist pre-publicacao"
labels: ["release", "qa"]
assignees: []
---

## Contexto

- Ambiente alvo: <!-- local / producao -->
- Versao/commit: <!-- hash ou tag -->
- Responsavel pela validacao: <!-- nome -->

## Checklist rapido (15 min)

- [ ] Login invalido mostra erro amigavel
- [ ] Login valido libera acesso ao dashboard
- [ ] Logout volta a exigir autenticacao
- [ ] Create persiste apos reload
- [ ] Update persiste apos reload
- [ ] Delete remove e nao reaparece apos reload
- [ ] Busca retorna resultados coerentes
- [ ] Filtros (advogado/status) funcionam
- [ ] Paginacao avanca e volta sem quebrar estado
- [ ] Permissoes condizentes com regra atual (usuarios autenticados podem create/update/delete)
- [ ] Importacao via scripts/import-firestore.html concluida sem erro critico
- [ ] Exportacao gera arquivo valido
- [ ] Tema claro/escuro funcionando
- [ ] Layout utilizavel em desktop e mobile

## Evidencias

- Capturas/logs relevantes:
  - <!-- opcional -->

## Resultado final

- [ ] Aprovado para publicar
- [ ] Bloqueado

Se bloqueado, descreva o motivo e a acao corretiva:

<!-- descreva aqui -->

## Referencia

Roteiro completo: TESTE_MANUAL_15MIN.md
