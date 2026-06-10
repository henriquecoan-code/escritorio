# OB Dashboard Rede

Dashboard interno da Oliveira & Benedet para gestão e visualização de contratos, com frontend estático em HTML/CSS/JS e backend em Firebase.

## Tecnologias

- HTML, CSS e JavaScript vanilla
- Firebase Auth
- Cloud Firestore
- Chart.js

## Estrutura

```text
escritorio/
├── OB_Dashboard_Rede.html
├── firebase-config.js
├── firebase-config.public.js
├── firebase.json
├── firestore.rules
├── HISTORICO_MELHORIAS.md
├── README.md
├── .gitignore
├── package.json
├── playwright.config.js
├── scripts/
│   ├── dashboard.js
│   ├── import-firestore.html
│   └── theme.js
├── styles/
│   └── dashboard.css
└── tests/
    ├── e2e/
    │   └── smoke.spec.js
    └── firestore.rules.test.mjs
```

## Requisitos

- Navegador moderno
- Projeto Firebase configurado
- Node.js 22+
- Docker Desktop (para OWASP ZAP Baseline)

## Configuração do Firebase

1. Crie um projeto no Firebase.
2. Ative Authentication com email/senha.
3. Ative Cloud Firestore.
4. Ajuste o arquivo `firebase-config.js` com as credenciais do seu projeto.
5. Publique as regras de `firestore.rules`.

## Como abrir o dashboard

Como o projeto é estático, basta abrir `OB_Dashboard_Rede.html` no navegador ou servir a pasta com qualquer servidor estático.

Se quiser usar um servidor local simples no Windows com Python:

```powershell
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000/OB_Dashboard_Rede.html
```

## Login e permissões

- O dashboard exige autenticação via Firebase Auth.
- Leitura é permitida para usuário autenticado.
- No estado atual, create, update e delete estão liberados para usuário autenticado.
- O controle por admin em `meta/security.adminUids` permanece reservado para endurecimento futuro das regras, quando o acesso for ampliado para mais pessoas.

Quando o endurecimento for ativado, para tornar um usuário admin:

1. Abra Firebase Console → Authentication → Users.
2. Copie o UID do usuário.
3. Em Firestore Database → Data, crie ou edite o documento `meta/security`.
4. Adicione o campo `adminUids` como array.
5. Inclua o UID dentro do array.

## Plano de testes (copiar e executar no Windows)

### 1. Instalar dependências

```powershell
npm install
npx playwright install
```

### 2. Subir o dashboard local

```powershell
npm run serve
```

Acesse: `http://localhost:8000/OB_Dashboard_Rede.html`

### 3. Rodar testes E2E (Playwright)

Em outro terminal:

```powershell
npm run test:e2e
```

Para o fluxo autenticado real (sem bypass), configure credenciais de teste e rode:

```powershell
$env:E2E_EMAIL="usuario1@dominio.com"
$env:E2E_PASSWORD="senha_do_usuario1"
$env:E2E_USER2_EMAIL="usuario2@dominio.com"
$env:E2E_USER2_PASSWORD="senha_do_usuario2"
npm run test:e2e:real
```

Observações:

- O teste exige `E2E_EMAIL` e `E2E_PASSWORD`.
- A validação de permissão cruzada usa `E2E_USER2_EMAIL` e `E2E_USER2_PASSWORD` (se não informar, esse caso é pulado).

Cobertura inicial atual:

- carregamento da página principal
- navegação entre abas (Dashboard, Registros e Configurações)
- validação de erros de runtime no carregamento

Cobertura adicional no fluxo autenticado real (`npm run test:e2e:real`):

- login/logout real com Firebase Auth
- CRUD ponta a ponta com persistência após reload
- busca e filtro por advogado em Registros
- paginação de Registros (quando houver mais de 1 página)
- importação JSON via `scripts/import-firestore.html` e validação no dashboard

### 4. Rodar testes das regras do Firestore

```powershell
npm run test:rules
```

Cobertura inicial atual:

- bloqueio de leitura para usuário anônimo
- leitura permitida para usuário autenticado
- criação permitida com campos válidos
- criação bloqueada com campo não permitido

### 5. Rodar OWASP ZAP Baseline

Com Docker Desktop aberto, em outro terminal:

```powershell
docker pull ghcr.io/zaproxy/zaproxy:stable
docker run --rm -t -v "${PWD}:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "http://host.docker.internal:8000/OB_Dashboard_Rede.html" -m 5 -r zap-report.html
```

Resultado esperado:

- arquivo `zap-report.html` gerado na raiz do projeto
- prioridade de correção: High primeiro, depois Medium

### 6. Rodar checklist manual (15 min)

Antes de publicar, execute o roteiro em `TESTE_MANUAL_15MIN.md` para validar os fluxos que ainda dependem de verificacao humana (login real, CRUD ponta a ponta, importador e responsividade).

## Ordem recomendada de execução

1. `npm run serve`
2. `npm run test:e2e`
3. `npm run test:rules`
4. ZAP Baseline
5. Checklist manual (15 min)

Critério de pronto:

- sem alertas High no ZAP
- testes E2E passando
- testes de regras do Firestore passando

## CI no GitHub Actions

O repositório agora inclui pipeline automática em [.github/workflows/ci-tests.yml](.github/workflows/ci-tests.yml).

Execuções automáticas:

- push
- pull request

Jobs executados:

- E2E Playwright
- Firestore Rules (com Java 21)
- Security ZAP Baseline

Relatórios gerados como artefatos da execução:

- playwright-report
- zap-report

## Notebook e GitHub

Para sincronizar um notebook novo com o GitHub neste repositório:

- salve o arquivo com extensao `.ipynb` dentro deste workspace, de preferência em uma pasta como `notebooks/`
- faça as alteracoes no notebook e salve normalmente no VS Code
- use o painel Source Control para criar o commit e enviar para `origin/main`

O arquivo [.gitattributes](.gitattributes) ja normaliza notebooks para evitar diferenças desnecessarias no Windows e no GitHub.

## Backup automatico do Firestore (GitHub Actions)

Foi adicionada uma rotina automatica em [.github/workflows/firestore-backup.yml](.github/workflows/firestore-backup.yml) que:

- executa diariamente (03:15 UTC) e tambem por acionamento manual
- exporta os dados do Firestore para JSON
- comprime e criptografa o arquivo de backup com AES-256
- publica o backup como artefato do GitHub Actions com retencao de 7 dias

Script utilizado:

- [scripts/firestore-backup.mjs](scripts/firestore-backup.mjs)

### Segredos necessarios

Configure em Settings -> Secrets and variables -> Actions:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON completo da conta de servico do Firebase (ou em base64)
- `BACKUP_ENCRYPTION_PASSPHRASE`: frase secreta para criptografar o backup

### Visibilidade dos dados

- Se o repositorio for privado: somente colaboradores com acesso conseguem baixar os artefatos.
- Se o repositorio for publico: o fluxo pode ficar visivel para terceiros. Nesse caso, recomenda-se mover o backup para um repositorio privado dedicado.

### Politica de retencao

- A retencao esta configurada em 7 dias (`retention-days: 7`).
- Na pratica, backups acima desse periodo sao removidos automaticamente pelo GitHub.

### Restauracao local (quando precisar)

Exemplo de descriptografia no Windows (PowerShell), sem depender do OpenSSL:

```powershell
.\scripts\restore-firestore-backup.ps1 -EncryptedFile "C:\Users\henri\Downloads\firestore-backup-26795378218.zip"
```

Ou, usando o miniscript pronto do projeto:

```powershell
.\scripts\restore-firestore-backup.ps1 -EncryptedFile "C:\Users\henri\Downloads\firestore-backup-26795378218.zip"
```

Se o arquivo vier do GitHub Actions como `.zip`, basta passar o caminho completo no parâmetro `-EncryptedFile`; o script encontra o `.enc` dentro do ZIP automaticamente, faz a descriptografia e grava o JSON final na mesma pasta do arquivo de entrada, a menos que você informe `-OutputFile`.

## Importador Firestore (seguranca e auditoria)

O utilitario [scripts/import-firestore.html](scripts/import-firestore.html) foi atualizado com controles adicionais.

### Reautenticacao obrigatoria

Antes de executar as acoes abaixo, a tela pede confirmacao de usuario e senha novamente:

- Importar
- Exportar backup (Excel)
- Renumerar registros

### Modos para registros existentes

- Completar apenas campos faltantes (padrao)
- Atualizar todos os campos presentes no arquivo (seguro)
- Substituir documento pelos dados do arquivo

No modo seguro, somente os campos presentes no JSON/Excel sao atualizados. Campos ausentes no arquivo nao sao sobrescritos.

### Historico de auditoria

As operacoes de importacao, exportacao e renumeracao gravam historico em `meta/importAudit` no Firestore com:

- quem executou (`uid` e `email`)
- o que foi feito (`action`)
- quando foi feito (`at`)
- detalhes da operacao (`details`)

Para controle de tamanho, o historico mantem os 300 eventos mais recentes.

### Sugestao futura

- Adicionar botao "Ver historico" no proprio importador para consultar a auditoria sem abrir o Firebase Console.

## Segurança

- `firebase-config.js` deve ser tratado como arquivo local do ambiente.
- O `.gitignore` já foi configurado para evitar novos commits desse arquivo.
- Se ele já foi commitado antes, o ideal é removê-lo do versionamento e, se necessário, rotacionar as credenciais do projeto.
- A configuração pública em `firebase-config.public.js` faz parte do frontend e, isoladamente, não protege nem expõe os dados do projeto; a proteção real depende de Auth e `firestore.rules`.
- No cenário atual, como o app ainda é operado por poucas pessoas da equipe, as regras foram mantidas temporariamente mais simples. Antes de ampliar o acesso, endureça `update`, `delete` e escrita em `meta`.

## Histórico

O resumo das etapas de migração, segurança e refatoração está em `HISTORICO_MELHORIAS.md`.

## Recomendações técnicas (análise de 2026-06-10)

Prioridade alta:

- Endurecer `firestore.rules` para impedir que qualquer usuário autenticado edite ou exclua qualquer contrato.
- Restringir escrita em `meta/*` para admin.
- Restringir ou remover o importador administrativo da publicação padrão (`scripts/import-firestore.html`).

Prioridade média:

- Escapar valores dinâmicos antes de montar `<option>` com `innerHTML` em `scripts/dashboard.js`.
- Restringir CSP de `script-src` para origens explícitas e evitar `https:` genérico.
- Ajustar testes para validar cenário seguro (negação de edição cruzada e escrita de `meta` por não admin).

## Troubleshooting: erro "permissão negada" ao salvar registro

Causa mais provável no estado atual:

- O frontend envia `createdAt` ao salvar novo registro.
- A regra de create validava `hasOnly(...)` sem incluir `createdAt`.
- Resultado: o Firestore rejeita o `set(...)` com `permission-denied`.

Checklist rápido:

1. Confirme login ativo no overlay de autenticação.
2. Verifique se as regras publicadas no Firebase já incluem `createdAt` em `validContrato(...)`.
3. Após alterar regras, publique com `firebase deploy --only firestore:rules`.
4. Teste criar um novo registro (não apenas editar um existente).
