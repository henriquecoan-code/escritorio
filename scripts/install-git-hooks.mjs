import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';

function resolveGitDir(repoRoot) {
  const dotGitPath = resolve(repoRoot, '.git');
  if (!existsSync(dotGitPath)) return '';

  try {
    const content = readFileSync(dotGitPath, 'utf8');
    const match = content.match(/^gitdir:\s*(.+)\s*$/i);
    if (!match) return dotGitPath;
    const rawPath = match[1].trim();
    return isAbsolute(rawPath) ? rawPath : resolve(dirname(dotGitPath), rawPath);
  } catch {
    return dotGitPath;
  }
}

const repoRoot = process.cwd();
const gitDir = resolveGitDir(repoRoot);

if (!gitDir) {
  console.error('[hooks] Pasta .git nao encontrada. Rode este comando na raiz do repositorio.');
  process.exit(1);
}

const hooksDir = resolve(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });

const prePushPath = resolve(hooksDir, 'pre-push');
const script = `#!/usr/bin/env sh
# Hook gerado automaticamente por scripts/install-git-hooks.mjs

printf '\n[hooks] Validando projeto antes do push...\n'
npm run validate
status=$?
if [ $status -ne 0 ]; then
  printf '[hooks] Validacao falhou. Push cancelado.\n'
  exit $status
fi
printf '[hooks] Validacao concluida. Push liberado.\n'
`;

writeFileSync(prePushPath, script, 'utf8');
try {
  chmodSync(prePushPath, 0o755);
} catch {}

console.log(`[hooks] Hook instalado em: ${prePushPath}`);
console.log('[hooks] Agora o Git vai rodar "npm run validate" automaticamente no pre-push.');
