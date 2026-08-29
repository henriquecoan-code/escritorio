# Roteiro de Teste Manual (15 min)

Objetivo: validar rapidamente os fluxos criticos que ainda nao estao totalmente cobertos pelos testes automatizados.

## Pre-condicoes

- Dependencias instaladas (`npm install`)
- Servidor local em execucao (`npm run serve`)
- Firestore e Auth ativos no projeto Firebase
- 2 usuarios de teste com email/senha
  - usuario-a@...
  - usuario-b@...

## Execucao Rapida (15 min)

### 1) Login e logout (2 min)

1. Abra `http://localhost:8000/index.html` e escolha **Dashboard** no painel inicial.
2. Tente login com senha invalida.
3. Tente login com credenciais validas.
4. Faça logout.

Resultado esperado:

- Erro amigavel para senha invalida.
- Com login valido, o dashboard carrega normalmente.
- Apos logout, a tela volta a exigir autenticacao.

### 2) CRUD ponta a ponta (4 min)

1. Com login valido, abra Registros.
2. Crie um novo registro com dados basicos.
3. Edite o mesmo registro (ex.: cliente/etapa).
4. Exclua o registro criado.
5. Recarregue a pagina apos cada acao principal.

Resultado esperado:

- Create persiste apos reload.
- Update persiste apos reload.
- Delete remove o item e ele nao retorna apos reload.

### 3) Busca, filtros e paginacao (3 min)

1. Digite um termo no campo de busca.
2. Aplique filtro por advogado/status.
3. Avance e volte paginas na listagem.

Resultado esperado:

- Busca retorna itens coerentes com o termo.
- Filtros restringem corretamente os resultados.
- Paginacao nao perde estado nem quebra a listagem.

### 4) Permissoes no estado atual (2 min)

1. Entre com usuario A e altere um registro.
2. Entre com usuario B e altere/deletar o mesmo registro.

Resultado esperado:

- No modelo atual, usuarios autenticados conseguem create/update/delete.
- Comportamento deve ser consciente e aceito ate a fase de endurecimento das rules.

### 5) Importador de dados (2 min)

1. Abra `scripts/import-firestore.html`.
2. Faça login.
3. Importe um arquivo pequeno `.json` ou `.xlsx`.
4. Rode exportacao em seguida.

Resultado esperado:

- Import conclui sem erro critico.
- Dados importados aparecem no dashboard.
- Export gera arquivo valido.

### 6) Regressao visual e responsividade (2 min)

1. Alterne tema claro/escuro.
2. Valide abas principais (Dashboard, Registros, Configuracoes).
3. Teste em largura mobile (DevTools, ex.: 390x844).

Resultado esperado:

- Sem sobreposicao de componentes.
- Sem texto cortado ou botoes inacessiveis.
- Navegacao principal utilizavel em desktop e mobile.

## Checklist de aprovacao

Marque todos antes de publicar:

- [ ] Login invalido e valido OK
- [ ] Logout OK
- [ ] Create/Update/Delete com persistencia apos reload
- [ ] Busca/Filtro/Paginacao OK
- [ ] Permissoes condizentes com regra atual
- [ ] Import/Export OK
- [ ] Layout desktop/mobile OK

## Quando bloquear release

Bloquear publicacao se houver qualquer item abaixo:

- Erro de runtime no console impedindo fluxo principal
- Falha de persistencia (cria/edita e perde apos reload)
- Exclusao inconsistente (item reaparece sem motivo)
- Quebra grave de layout que impede operacao
- Importacao com falha critica sem contorno
