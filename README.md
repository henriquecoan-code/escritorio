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
- Escrita depende de admin.

Para tornar um usuário admin:

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

Cobertura inicial atual:

- carregamento da página principal
- navegação entre abas (Dashboard, Registros e Configurações)
- validação de erros de runtime no carregamento

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

## Ordem recomendada de execução

1. `npm run serve`
2. `npm run test:e2e`
3. `npm run test:rules`
4. ZAP Baseline

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

## Segurança

- `firebase-config.js` deve ser tratado como arquivo local do ambiente.
- O `.gitignore` já foi configurado para evitar novos commits desse arquivo.
- Se ele já foi commitado antes, o ideal é removê-lo do versionamento e, se necessário, rotacionar as credenciais do projeto.

## Histórico

O resumo das etapas de migração, segurança e refatoração está em `HISTORICO_MELHORIAS.md`.
