# Histórico de Melhorias — OB Dashboard Rede

**Projeto:** Oliveira & Benedet — Dashboard de Contratos  
**Data:** Abril 2026  
**Stack:** HTML + CSS + JS (vanilla) + Firebase Firestore + Firebase Auth

## Atualizacao complementar (Junho 2026)

### Backup automatico (GitHub Actions)

- Workflow dedicado para backup diario/manual do Firestore
- Arquivo exportado, comprimido e criptografado (AES-256)
- Retencao automatica de 7 dias para artefatos
- Atualizacao das actions para versoes compativeis com Node 24

### Endurecimento do importador

- Remocao da acao destrutiva de "limpar colecao"
- Reautenticacao obrigatoria (usuario e senha) para:
  - Importar
  - Exportar backup
  - Renumerar

### Auditoria de operacoes

- Registro de historico em `meta/importAudit` contendo:
  - quem executou (`uid` e `email`)
  - o que executou (`action`)
  - quando executou (`at`)
  - detalhes da operacao (`details`)
- Politica de limite: manter os ultimos 300 eventos

### Sugestao registrada

- Adicionar botao "Ver historico" no `import-firestore.html` para consulta da auditoria diretamente na interface.

---

## Migração para Firebase (Ontem)

Antes das melhorias de hoje, o projeto foi migrado do fluxo local baseado em arquivos para uma arquitetura em Firebase.

### Estrutura anterior
- Dashboard local com suporte de servidor Python e base em JSON
- Arquivos do fluxo antigo:
  - `OB_Server.py`
  - `ob_data.json`
  - `run_server.bat`

### O que foi feito na migração
- Configuração do projeto no **Firebase**
- Integração do dashboard com **Cloud Firestore**
- Importação da base JSON existente para o Firestore
- Adaptação da aplicação para leitura e escrita online
- Configuração do **Firebase Auth** para controle de acesso
- Ajuste da base para operação centralizada, sem depender do servidor local em Python

### Resultado da migração
- Os dados passaram a ficar centralizados no Firestore
- O dashboard deixou de depender do fluxo local com arquivo JSON como fonte principal
- A autenticação passou a fazer parte do fluxo da aplicação
- O sistema ficou preparado para regras de acesso por usuário/admin

---

## Resumo Geral

Após a migração para Firebase, o projeto passou por três fases de refatoração focadas em **segurança**, **organização** e **boas práticas**, seguidas de uma fase de limpeza visual.

---

## Fase 1 — Segurança de Dados e XSS

### Problemas identificados
- `SEED_DATA` continha nomes reais de clientes embutidos no HTML fonte público
- Renderização de dados diretamente com `innerHTML` sem sanitização (vulnerabilidade XSS)
- Ausência de Content Security Policy (CSP)

### O que foi feito
- **`SEED_DATA` esvaziado** → `const SEED_DATA = [];`
- **Funções de escape criadas** em `dashboard.js`:
  - `escHtml(v)` — escapa `& < > ' "` para entidades HTML
  - `escAttr(v)` — escapa atributos HTML (inclui backtick)
  - `escJsSQ(v)` — escapa aspas simples em strings JS
- Todas as chamadas de `innerHTML` com dados dinâmicos passaram a usar `escHtml()` / `escAttr()`
- **CSP adicionada** no `<head>` do HTML:
  ```html
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self' https: data: blob:;
    script-src 'self' https:;
    style-src 'self' 'unsafe-inline' https:;
    connect-src 'self' https://*.googleapis.com https://*.firebaseio.com ...;
  ">
  ```

---

## Fase 2 — Remoção de Handlers Inline

### Problema identificado
- ~47 atributos `onclick`, `onchange`, `oninput` diretamente no HTML
- Padrão conflita com CSP restritiva e dificulta manutenção

### O que foi feito
- Todos os handlers inline foram removidos do HTML
- Substituídos por `addEventListener` centralizados na função `bindStaticEvents()` em `dashboard.js`
- Uso de **event delegation** para elementos dinâmicos:
  - `ctbody` → editar/excluir por `data-action` + `data-uid`
  - `pag-btns` → paginação por `data-page`
  - `view-cfg` → adicionar/remover configurações por `data-cfg-add-key` / `data-remove-cfg-key`
  - `month-bar` → filtro de mês por `data-month`
  - `photo-rank` → upload de foto por `data-photo-input-id`

---

## Fase 3 — Separação de Arquivos e CSP Final

### Problema identificado
- Todo CSS e JS estavam embutidos no HTML (arquivo único com +2.000 linhas)
- `unsafe-inline` necessário no `script-src` enquanto JS ficasse inline

### O que foi feito

#### Arquivos criados
| Arquivo | Conteúdo |
|---|---|
| `styles/dashboard.css` | Todo o CSS extraído do `<style>` |
| `scripts/dashboard.js` | Todo o JS extraído do `<script>` |
| `firestore.rules` | Regras de segurança do Firestore |

#### HTML resultante (`OB_Dashboard_Rede.html`)
- Apenas marcação + referências externas
- `unsafe-inline` removido do `script-src` (CSP mais restritiva)

#### `firestore.rules` — Regras de produção
- Leitura: qualquer usuário autenticado
- Escrita: apenas admins (duas opções de controle)
  - **Opção A:** Custom claim `admin: true` no token Firebase Auth
  - **Opção B:** UID listado em `/meta/security.adminUids` (recomendada)
- Validação de campos em `contratos`: tipos, tamanhos e valores permitidos
- `uid` imutável após criação
- Bloqueio padrão para todas as outras coleções

---

## Fase 4 — Limpeza Visual (Encoding)

### Problema identificado
- A extração dos arquivos causou corrupção de encoding (mojibake) em caracteres especiais
- Acentos, emojis e símbolos foram substituídos por `?` ou sequências incorretas

### O que foi feito

**PowerShell** — remoção de caracteres de substituição (`U+FFFD`):
```powershell
$files = @("OB_Dashboard_Rede.html","scripts/dashboard.js","styles/dashboard.css")
foreach($f in $files){
  $c = Get-Content -Path $f -Raw
  $c = $c -replace [string][char]0xFFFD, ''
  Set-Content -Path $f -Value $c -Encoding utf8
}
```

**Restaurações no HTML** (via HTML entities):
| Antes | Depois |
|---|---|
| `Oliveira & Benedet - Dashboard` | `Oliveira & Benedet — Dashboard` (`&#8212;`) |
| `Configuracoes` | `Configurações` |
| `Atualizar` | `↻ Atualizar` (`&#8635;`) |
| `Limpar` | `✕ Limpar` (`&#10005;`) |
| `Confirmar Exclusao` | `Confirmar Exclusão` |
| Ícones cfg: `A`, `Ac`, `Adv`... | `🏛 ⚡ 👤 📋 📡 📅` (HTML entities) |
| Fechar modal: `-` | `×` (`&times;`) |

**Restaurações no JS** (via Unicode escapes):
| Antes | Depois |
|---|---|
| `MEDALS=['#1','#2','#3',...]` | `MEDALS=['🥇','🥈','🥉',...]` |
| Indicadores de sort: `asc/desc/sort` | `↑ ↓ ↕` (`\u2191 \u2193 \u2195`) |
| Botões tabela: `Edit` / `Del` | `✏` / `🗑` (HTML entities em template string) |
| Ícone câmera: `Foto` | `📷` |
| Paginação: `<` / `>` | `‹` / `›` (`&lsaquo; &rsaquo;`) |
| `TIPOS`: texto com Êxito corrompido | `\u00C9xito` (Unicode escape) |

---

## Como Tornar um Usuário Admin

1. Acesse **Firebase Console → Authentication → Users** e copie o **User UID**
2. Acesse **Firestore Database → Data**
3. Crie (ou edite) o documento: `meta / security`
4. Adicione o campo:
   - **Field:** `adminUids`
   - **Type:** `array`
   - **Value:** o UID copiado
5. Salve — o usuário terá acesso de escrita imediatamente

Para adicionar mais admins no futuro, basta adicionar mais UIDs ao mesmo array.

---

## Estrutura Final do Projeto

```
escritorio/
├── index.html               # Redirect para OB_Dashboard_Rede.html
├── OB_Dashboard_Rede.html   # Shell HTML + CSP
├── firebase-config.js       # Configuração Firebase local (no .gitignore)
├── firebase-config.public.js# Configuração Firebase pública
├── firebase.json            # Configuração de hospedagem Firebase
├── firestore.rules          # Regras de segurança Firestore
├── styles/
│   └── dashboard.css        # Todo o CSS
└── scripts/
    ├── dashboard.js         # Toda a lógica da aplicação
    └── import-firestore.html# Utilitário de importação de dados (uso pontual)
```

---

## Pendências Futuras (Opcionais)

- [x] `README.md` com instruções de setup e deploy
- [x] `.gitignore` para excluir arquivos desnecessários do repositório
- [ ] Perfis de acesso mais refinados no Firebase Auth (ex.: somente leitura vs. admin)
- [x] Testes básicos de regressão

---

## Recomendações Futuras (04/05/2026)

As itens abaixo foram identificados na análise técnica do projeto e registrados para implementação futura, quando o controle de acesso for formalizado.

### Status operacional atual (06/05/2026)

No momento, o aplicativo continua restrito a um grupo pequeno de 4 pessoas.

Por decisão operacional, as regras do Firestore permanecem temporariamente mais abertas para usuários autenticados, evitando atrito de uso enquanto o acesso ainda é controlado manualmente.

Isso significa que o endurecimento com diferenciação real entre usuário comum e admin foi adiado de forma consciente para a próxima fase de expansão.

### Gestão de Usuários (contexto atual)

Por enquanto, usuários são adicionados manualmente no Firestore via painel Firebase Console. O grupo de acesso é isolado e controlado diretamente pelo array `adminUids` em `meta/security`. Firebase Auth foi configurado mas não há diferenciação de perfis dentro do app — todos os usuários autenticados têm o mesmo nível de acesso na interface.

### Firestore Rules — Restrições de update/delete para admins

Atualmente `update` e `delete` da coleção `contratos` permitem qualquer usuário autenticado. Quando o controle de perfis for necessário, as regras devem evoluir para:

```javascript
function isAdmin() {
  return signedIn() &&
    request.auth.uid in get(/databases/$(database)/documents/meta/security).data.adminUids;
}

match /contratos/{docId} {
  allow read:   if signedIn();
  allow create: if signedIn() && validContrato(request.resource.data);
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

Obs: leitura do documento `meta/security` dentro da regra tem custo de 1 leitura adicional por operação — aceitável para operações de escrita, mas deve ser avaliado se for aplicado a leituras também.

Enquanto isso, manter esse modelo só é aceitável porque o acesso ainda é limitado e conhecido. Ao abrir o sistema para mais usuários, essa alteração deixa de ser opcional e passa a ser prioridade imediata.

### Testes Firestore Rules — Cobertura de admin

Quando as regras acima forem implementadas, adicionar os seguintes casos de teste em `tests/firestore.rules.test.mjs`:

- Deve **negar** `delete` para usuário autenticado sem permissão de admin
- Deve **permitir** `delete` para usuário com UID em `adminUids`
- Deve **negar** `update` para não-admin
- Deve **permitir** `update` para admin
- Validação de tipo do campo `etapa` (deve ser inteiro 1–5)
- Validação de tamanho de campos string (ex: `cliente` max 200 chars)
- Campo `uid` imutável após criação (`request.resource.data.uid == resource.data.uid`)

### Testes E2E — Fluxos adicionais

Quando o fluxo de autenticação for estabilizado, adicionar em `tests/e2e/smoke.spec.js`:

- Login e logout com credenciais de teste
- Criar novo registro via modal e verificar aparição no painel
- Editar um registro existente e confirmar a persistência
- Excluir um registro com confirmação
- Filtrar por advogado e verificar resultado
- Busca textual retorna resultados esperados
- Paginação avança e retrocede corretamente

---

## Fase 7 — Limpeza do Repositório (03/05/2026)

### Objetivo
Remover do repositório todos os arquivos que não são utilizados pelo site publicado no GitHub Pages / Firebase Hosting.

### O que foi removido

| Arquivo/Pasta | Motivo |
|---|---|
| `05. DASHBOARD/` *(pasta inteira)* | Versões antigas do dashboard, dados CSV/JSON locais, servidor Python (`OB_Server.py`) — arquivos de trabalho/histórico sem uso no site |
| `tests/regression.test.mjs` | Arquivo de testes unitários — não faz parte da build publicada |
| `tests/` *(pasta vazia)* | Removida após exclusão do arquivo de testes |

### Mantidos intencionalmente

| Arquivo | Motivo |
|---|---|
| `scripts/import-firestore.html` | Utilitário de importação de dados ainda em uso pontual |
| `firebase-config.js` | Configuração local (já ignorada pelo `.gitignore` e pelo `firebase.json`) |
| `HISTORICO_MELHORIAS.md` e `README.md` | Documentação — ignoradas pelo `firebase.json` na hospedagem |

---

## Fase 5 — Paridade Visual com Versão Final (03/05/2026)

### Objetivo
Alinhar `OB_Dashboard_Rede.html` + `dashboard.js` + `dashboard.css` à versão de referência
`05. DASHBOARD/OB_Dashboard_2026-04-30 versão final.html`, preservando toda a infraestrutura
Firebase/Auth/CSP/sync já existente.

### Mudanças em `scripts/dashboard.js`

#### Rótulos de seções corrigidos
| Antes | Depois |
|---|---|
| `"Advogado × Mês · Resumo"` | `"Advogado × Mês · Resumo Executivo"` |
| `"Contratos por Advogado - por Mês"` | `"Contratos Assinados por Advogado — por Mês"` |
| `"Tempo Médio no Comercial"` | `"Tempo Médio no Comercial — Permanência da Pasta"` |

#### KPIs do dashboard alinhados à versão final
- Conjunto final: **Total Contratos, Em Andamento, Concluídos, Variação, Tempo Médio**
- Adicionado helper `isDoneRecord()` para calcular status concluído

#### Typos corrigidos
- `"Área Líer"` → `"Área Líder"`
- `"Advogado Líer"` → `"Advogado Líder"`

#### Linguagem "Contrato" → "Registro"
- Modal: `"Novo/Editar Contrato"` → `"Novo/Editar Registro"`
- Mensagens de exclusão: `"contrato"` → `"registro"`
- Contador de registros: `"(n)"` → `"— n registros"`

#### Widgets dinâmicos do dashboard
- Contêiner de widgets com ordenação configurável pelo usuário
- Persistência da ordem em `localStorage`
- Widget de **Tempo Médio no Comercial** adicionado

#### Cards da aba Registros migrados para estrutura final
- `.reg-hdr` com grid header: `.reg-cli`, `.pdots`, `.reg-meta`, badges, `.reg-btn`
- `.reg-panel` expansível com `.panel-body`
- `.etapa-bar` com botões `.eb`
- `.dg` grade de datas com campos `.ifield`
- `.dur-strip` / `.dur-grid` para cálculo de duração
- `.docs-sel` com `.doc-chip.sel` (substituiu `.pendente`)
- `.pfooter` com `.pstatus` e `.pacts`
- `toggleRegCard()` atualizado para novos IDs de painel
- doc-chip toggle: classe `pendente` → `sel`

#### KPI cards superiores da aba Registros removidos
- Função `renderRegKpis()` removida
- Chamada de `renderRegKpis()` removida

### Mudanças em `OB_Dashboard_Rede.html`

- `#sync-bar` movido do topo (após o header) para o **rodapé** da página (antes dos modais), dentro de `#app`
- `<div class="kpi-row" id="reg-kpi-row">` removido da view `#view-reg`
- Placeholder do campo de busca: `""` → `"Buscar..."`
- Título padrão do modal: `Novo Registro`

### Mudanças em `styles/dashboard.css`

#### Barra de sync convertida para rodapé
- `.sync-bar`: `position:relative`, `border-top` (em vez de `border`), sem `margin-bottom`
- `#app`: `padding-bottom` aumentado para acomodar a barra de rodapé

#### Cards do dashboard compactados
- `.kpi-val`: font-size `38px` → `30px`; `.kpi`: padding `18px` → `14px`
- `.card`: padding reduzido; `.ct`: `margin-bottom` reduzido
- `.mc-n`: font-size `46px` → `36px`, padding ajustado
- `.pr` (foto rank): gaps menores; `.av` `46px` → `40px`; `.pr-n` font-size `26px` → `21px`

#### Cards da aba Registros ajustados ao tamanho da versão final
- `.reg-hdr`: padding e gap reduzidos
- `.reg-cli`: font-size `13px`
- `.reg-btn`: tamanho reduzido
- `.panel-body`: padding reduzido
- `.pfooter`: padding reduzido
- Regra `#view-reg .kpi-row` removida (grid de 4 colunas que não existe mais)

#### Alturas dos canvas de gráficos ajustadas
- `evolChart`: `210px`
- `advChart`: `240px` → `220px`
- Donuts: `170px`

---

## Fase 6 — Consolidação de Dados e Melhorias de UX (01–03/05/2026)

### 6.1 Consolidação e importação de dados para o Firestore

#### Problema
O Firestore continha apenas 68 registros (fonte: `ob_data.json`), enquanto 6 arquivos HTML diferentes cada um embutia datasets maiores (até 182 registros), gerados por usuários distintos ao longo do tempo.

#### O que foi feito

**Exportação individual por HTML (PowerShell)**
- Extraído o array `SEED_DATA` de cada um dos 6 arquivos HTML
- Gerado um CSV por arquivo na pasta `05. DASHBOARD/exports_csv_por_html/`:

| Arquivo CSV | Registros |
|---|---|
| `OB_Dashboard_2026-04-27.csv` | 73 |
| `OB_Dashboard_2026-04-28_1_somente_dados_mês_março_e_abril.csv` | 104 |
| `OB_Dashboard_2026-04-30.csv` | 182 |
| `OB_Dashboard_2026-04-30_versão_final.csv` | 145 |
| `OB_Dashboard_ATUALIZADO_4.csv` | 181 |
| `OB_Dashboard_Rede.csv` | 68 |

**Agrupamento**
- Todos os CSVs concatenados em `00_AGRUPADO_TODOS_CSVS.csv` (734 linhas, coluna `origem_csv` identificando a fonte)
- Delimitador `;` para compatibilidade com Excel BR

**Merge / deduplicação (`merge_dedup.ps1`)**
- Agrupamento por `uid + data + cliente`
- Campos com conflito entre fontes: unidos com ` | `
- Coluna `origem_csv`: fontes listadas separadas por ` | `
- Coluna `n_fontes`: quantidade de arquivos que contribuíram para o registro
- Resultado: **498 registros únicos** em `00_MESCLADO_DEDUP_v2.csv`

> **Lição aprendida (PowerShell encoding):**  
> `Get-Content` e `Import-Csv -Encoding UTF8` corrompem acentos.  
> Solução: `[System.IO.File]::ReadAllBytes()` + `[System.Text.Encoding]::UTF8.GetString()`.  
> Para gravação com BOM (compatibilidade Excel): `New-Object System.Text.UTF8Encoding $true`.

**Conversão CSV → JSON (`csv_para_json.ps1`)**
- Campos excluídos do JSON: `origem_csv`, `n_fontes` (metadados do merge)
- Campo `etapa` convertido para inteiro
- Campo `docsPendentes` inicializado como array vazio `[]`
- Gerado `importar_firestore.json` (331 KB, 498 registros)

**Importação via `scripts/import-firestore.html`**
- Login com Firebase Auth
- Upload do `importar_firestore.json`
- Opção "Pular registros que já existem" ativada por padrão
- 498 registros importados para a coleção `contratos` no Firestore

---

### 6.2 Remoção da aba Contratos da navegação

#### Motivo
A aba **Contratos** (tabela paginada) e a aba **Registros** (cards com pipeline) exibiam essencialmente os mesmos dados. Manter as duas causava redundância e confusão.

#### O que foi feito — `OB_Dashboard_Rede.html`
- Removido o botão `<button id="tab-ct" data-view="ct">Contratos</button>` da barra de navegação
- A `view-ct` (tabela) permanece no HTML para eventuais usos internos, mas não é mais acessível pelo menu

---

### 6.3 Ícones nas abas de navegação

Adicionados ícones nas abas para melhor identidade visual:

| Aba | Antes | Depois |
|---|---|---|
| Dashboard | `Dashboard` | `📊 Dashboard` (`&#128202;`) |
| Registros | `📁 Registros` | sem mudança |
| Configurações | `Configurações` | `⚙ Configurações` (`&#9881;`) |

---

### 6.4 Paginação na aba Registros

#### Problema
Com 498 registros no Firestore, a aba Registros renderizava todos os cards de uma só vez, tornando a página lenta e pesada.

#### O que foi feito

**`OB_Dashboard_Rede.html`**
- Adicionada barra de paginação abaixo de `#reg-list`:
  ```html
  <div class="pag">
    <div class="pag-info" id="reg-pag-info"></div>
    <div class="pag-btns" id="reg-pag-btns"></div>
  </div>
  ```

**`scripts/dashboard.js`**
- Estado de página: `let regPg=1`
- Tamanho de página: `const REG_PG=12`
- `renderReg()` atualizada para fatiar a lista: `list.slice((regPg-1)*REG_PG, regPg*REG_PG)`
- Botões de navegação gerados dinamicamente com `data-reg-page`, reutilizando estilos `.pb2` já existentes
- Reset para página 1 ao aplicar qualquer filtro (busca, mês, advogado, etapa) ou limpar filtros
- Função `goRegPg(p)` para navegar entre páginas via event delegation em `#reg-pag-btns`

#### Resultado
- Apenas 12 cards renderizados por vez (em vez de 498)
- Filtros continuam funcionando normalmente, reiniciando na página 1
- Ações dos cards (salvar, excluir, etapa, docs) preservadas sem alteração

---

## Fase 8 — Sincronização Firebase e Melhorias de UX (03/05/2026)

### 8.1 Substituição do polling por listener em tempo real (onSnapshot)

#### Problema
A sincronização era feita com `setInterval` a cada 30s, causando re-renders completos da página periodicamente, mesmo sem alterações nos dados.

#### O que foi feito — `scripts/dashboard.js`
- Removido `startAutoSync()` (que usava `setInterval`)
- Criada função `startRealtimeSync()` com `fbDb.collection('contratos').onSnapshot(...)`
- Merge inteligente: para cada doc recebido, compara `updatedAt` local vs. remoto — só sobrescreve se a versão remota for mais recente
- Registros excluídos remotamente são removidos do array local
- Listener cancelado automaticamente ao fazer logout (`unsubContratos()`)
- Status da barra de sync exibe `"Tempo real"` em vez de `"Firebase conectado"`
- Variável `unsubContratos` armazena a função de cancelamento do listener

---

### 8.2 Versionamento com campo `updatedAt`

#### Problema
Sem controle de versão, duas abas abertas simultaneamente podiam sobrescrever dados uma da outra.

#### O que foi feito
- `serverSave(record)` agora define `record.updatedAt = Date.now()` antes de gravar no Firestore
- `serverSave` passa a retornar `true` (sucesso) ou `false` (falha)
- `saveC` (modal) e `saveReg` (painel inline) usam o retorno para decidir se fecham ou não
- Adicionado `updatedAt` à lista de campos permitidos em `firestore.rules` dentro de `validContrato()`

---

### 8.3 Confirmação de save antes de atualizar a UI

#### Problema
A UI atualizava otimisticamente antes da confirmação do Firebase — se o save falhasse, o dado errado ficava exibido.

#### O que foi feito — `saveC()` e `saveReg()`
- Botão "Salvar" desabilitado e texto alterado para `"Salvando..."` durante a operação
- Modal/painel só fecha após retorno `true` de `serverSave`
- Se o save falhar:
  - Botão reabilitado
  - Modal/painel permanece aberto
  - Mudança otimista no array `DB` é revertida (apenas em `saveC` para novos registros)

---

### 8.4 Guarda de edição durante sync (`isEditing`)

- Variável `isEditing` adicionada: `true` enquanto modal ou painel inline estiver aberto
- `onSnapshot` ignora atualizações remotas enquanto `isEditing === true`
- `isEditing` volta para `false` ao fechar modal (`closeM`) ou ao salvar painel (`saveReg`)

---

### 8.5 Trava contra chamadas paralelas (`isSyncing`)

- `loadFromFirebase()` retorna imediatamente se `isSyncing === true`
- Evita múltiplas requisições simultâneas ao Firestore na inicialização

---

### 8.6 Campo Data = Data de Chegada no modal "Novo Registro"

#### O que foi feito
- O campo `Data` do modal (id `m-data`) passou a preencher tanto `data` quanto `dtChegada` ao salvar
- Ao editar um registro existente, o campo exibe `dtChegada` (com fallback para `data` em registros antigos)
- `saveC()` extrai `dtChegadaVal` e aplica nos dois campos

---

### 8.7 Pré-preenchimento do Mês de Referência

- Ao abrir "Novo Registro", o campo Mês de Referência é pré-preenchido com o mês atual do calendário (`MESES_REF[new Date().getMonth()]`)
- Se houver um mês ativo selecionado no dashboard, esse é usado em vez do mês atual

---

### 8.8 Ordenação dos meses de Janeiro a Dezembro

- `fillSelects()` agora ordena o campo `m-mes` usando a posição em `MESES_REF` como chave de ordenação
- Meses não encontrados em `MESES_REF` vão para o final da lista

---

### 8.9 Ordenação padrão dos registros por número/controle

- Aba Registros (`getRegView`): ordenação padrão alterada de `data` decrescente para `numero` decrescente — o registro mais recente (maior número) aparece primeiro
- Tabela (aba Contratos interna): `sortCol` padrão alterado para `'numero'`, `sortDir` para `-1`

---

### 8.10 Atualização completa do body após salvar/excluir

- `saveC()` agora chama `renderDash(); renderTbl(); renderReg()` após salvar com sucesso
- `saveReg()` agora chama `renderDash(); renderTbl(); renderReg()` após salvar com sucesso
- Exclusão já atualizava tudo — mantido sem alteração

---

### 8.11 Correção de erros de JavaScript no console

#### Problema
`renderTbl()` tentava acessar elementos HTML (`ct-count`, `ctbody`, `pag-info`, `pag-btns`) que não existem na página atual (remanescentes da aba Contratos removida), causando `TypeError: Cannot set properties of null`.

#### O que foi feito
- Adicionadas verificações nulas (`if(!element) return`) antes de cada acesso a esses elementos
- `renderTbl()` retorna silenciosamente quando os elementos não estão presentes no DOM

---

### 8.12 CSP — hash de script inline permitido

Aviso de Content-Security-Policy reportado pelo navegador referente a um script inline (provavelmente injetado por extensão ou ferramenta). O hash SHA256 fornecido pelo navegador foi adicionado à diretiva `script-src`:

```html
script-src 'self' https: 'sha256-vvt4KWwuNr51XfE5m+hzeNEGhiOfZzG97ccfqGsPwvE='
```

