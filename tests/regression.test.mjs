import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const html = read('OB_Dashboard_Rede.html');
const js = read(path.join('scripts', 'dashboard.js'));
const rules = read('firestore.rules');

test('HTML carrega os arquivos externos principais', () => {
  assert.match(html, /<link rel="stylesheet" href="styles\/dashboard\.css">/);
  assert.match(html, /<script src="firebase-config\.js"><\/script>/);
  assert.match(html, /firebase-auth-compat\.js/);
  assert.match(html, /<script src="scripts\/dashboard\.js"><\/script>/);
});

test('HTML mantém autenticação e botões principais', () => {
  assert.match(html, /id="auth-email"/);
  assert.match(html, /id="auth-password"/);
  assert.match(html, /id="auth-login-btn"/);
  assert.match(html, /id="auth-logout-btn"/);
  assert.match(html, /id="open-new-contract-btn"/);
});

test('HTML não possui handlers inline', () => {
  assert.doesNotMatch(html, /\son(?:click|change|input|submit|load|error|keydown|keyup|keypress)\s*=/i);
});

test('CSP não permite script inline e mantém conectores do Firebase', () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self' https:/);
  assert.doesNotMatch(html, /script-src[^\"]*'unsafe-inline'/);
  assert.match(html, /connect-src 'self' https:\/\/\*\.googleapis\.com/);
  assert.match(html, /https:\/\/\*\.firebaseio\.com/);
  assert.match(html, /https:\/\/\*\.gstatic\.com/);
});

test('JavaScript mantém dados seed vazios e helpers de escape', () => {
  assert.match(js, /const SEED_DATA = \[\];/);
  assert.match(js, /function escHtml\(v\)/);
  assert.match(js, /function escAttr\(v\)/);
  assert.match(js, /function escJsSQ\(v\)/);
  assert.match(js, /function bindStaticEvents\(\)/);
});

test('JavaScript mantém integração com Firebase Auth e Firestore', () => {
  assert.match(js, /const FIREBASE_CFG = window\.OB_FIREBASE_CONFIG \|\| null;/);
  assert.match(js, /fbAuth = firebase\.auth\(app\);/);
  assert.match(js, /fbDb = firebase\.firestore\(app\);/);
  assert.match(js, /await fbAuth\.signInWithEmailAndPassword\(email,password\);/);
  assert.match(js, /fbAuth\.onAuthStateChanged\(/);
});

test('Regras do Firestore exigem autenticação e controle de admin para escrita', () => {
  assert.match(rules, /function signedIn\(\)/);
  assert.match(rules, /function canWrite\(\)/);
  assert.match(rules, /adminUids/);
  assert.match(rules, /allow read: if signedIn\(\);/);
  assert.match(rules, /allow create: if canWrite\(\) && validContractCreate\(\);/);
  assert.match(rules, /allow update: if canWrite\(\) && validContractUpdate\(\);/);
  assert.match(rules, /allow delete: if canWrite\(\);/);
});

test('Regras validam status permitidos e bloqueiam padrão', () => {
  assert.match(rules, /\['Ativo','Encerrado','Suspenso'\]/);
  assert.match(rules, /match \/\{document=\*\*\} \{/);
  assert.match(rules, /allow read, write: if false;/);
});

test('Estrutura de dados padrão está presente (AREAS, ACOES, TIPOS, etc)', () => {
  assert.match(js, /let AREAS\s*=/);
  assert.match(js, /let ACOES\s*=/);
  assert.match(js, /let TIPOS\s*=/);
  assert.match(js, /let ORIGENS\s*=/);
  assert.match(js, /let ADVS\s*=/);
  assert.match(js, /let STATUS\s*=/);
  assert.match(js, /let MESES_REF\s*=/);
});

test('Helpers de escape são utilizados em renderizações', () => {
  assert.match(js, /escHtml\([^)]*\)/);
  assert.match(js, /escAttr\([^)]*\)/);
  const htmlRenders = (js.match(/innerHTML\s*[+]?=/g) || []).length;
  const escapeUsage = (js.match(/escHtml\(/g) || []).length;
  assert.ok(escapeUsage > 0, 'escHtml deve ser usado em renderizações');
});

test('Event listeners estão centralizados em bindStaticEvents', () => {
  assert.match(js, /\.addEventListener\(/);
  assert.match(js, /\.addEventListener\('click'/);
  assert.match(js, /\.addEventListener\('change'/);
  assert.match(js, /\.addEventListener\('input'/);
  const bindStaticEventsFn = js.match(/function bindStaticEvents\(\){[\s\S]*?^}/m);
  assert.ok(bindStaticEventsFn, 'bindStaticEvents deve existir como função centralizada');
});

test('Firebase é inicializado condicionalmente e com tratamento de erros', () => {
  assert.match(js, /function initFirebaseIfConfigured\(\)/);
  assert.match(js, /firebase\.initializeApp\(FIREBASE_CFG\)/);
  assert.match(js, /catch\(e\){[\s\S]*?console\.error/);
});

test('Dados são renderizados com sanitização (innerHTML com escHtml)', () => {
  const htmlInnerSamples = js.match(/innerHTML\s*[+]?=\s*`[^`]*\$\{[^}]*\}/g) || [];
  const withEscape = htmlInnerSamples.filter(s => s.includes('escHtml')).length;
  assert.ok(withEscape > 0, 'innerHTML com variáveis deve usar escHtml ou similar');
});
