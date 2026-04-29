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
├── firestore.rules
├── HISTORICO_MELHORIAS.md
├── README.md
├── .gitignore
├── scripts/
│   └── dashboard.js
├── styles/
│   └── dashboard.css
└── tests/
    └── regression.test.mjs
```

## Requisitos

- Navegador moderno
- Projeto Firebase configurado
- Node.js 22+ para rodar os testes de regressão

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

## Testes básicos de regressão

Os testes validam contratos importantes da base atual:

- referências externas do HTML
- presença da autenticação
- ausência de handlers inline
- CSP mínima esperada
- `SEED_DATA` vazio
- helpers de escape presentes
- regras principais do Firestore

Para rodar:

```powershell
node --test tests/regression.test.mjs
```

## Segurança

- `firebase-config.js` deve ser tratado como arquivo local do ambiente.
- O `.gitignore` já foi configurado para evitar novos commits desse arquivo.
- Se ele já foi commitado antes, o ideal é removê-lo do versionamento e, se necessário, rotacionar as credenciais do projeto.

## Histórico

O resumo das etapas de migração, segurança e refatoração está em `HISTORICO_MELHORIAS.md`.
