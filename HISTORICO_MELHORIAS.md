# Histórico de Melhorias — OB Dashboard Rede

**Projeto:** Oliveira & Benedet — Dashboard de Contratos  
**Data:** Abril 2026  
**Stack:** HTML + CSS + JS (vanilla) + Firebase Firestore + Firebase Auth

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
├── OB_Dashboard_Rede.html   # Shell HTML + CSP
├── firebase-config.js       # Configuração Firebase (público por design)
├── firestore.rules          # Regras de segurança Firestore
├── styles/
│   └── dashboard.css        # Todo o CSS
└── scripts/
    └── dashboard.js         # Toda a lógica da aplicação
```

---

## Pendências Futuras (Opcionais)

- [x] `README.md` com instruções de setup e deploy
- [x] `.gitignore` para excluir arquivos desnecessários do repositório
- [ ] Perfis de acesso mais refinados no Firebase Auth (ex.: somente leitura vs. admin)
- [x] Testes básicos de regressão
