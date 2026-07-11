import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function resolveChromePath() {
  if (process.env.PW_CHROME_PATH) return process.env.PW_CHROME_PATH;

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  return candidates.find((path) => existsSync(path)) || '';
}

const chromePath = resolveChromePath();
const env = {
  ...process.env,
  ...(chromePath ? { PW_CHROME_PATH: chromePath } : {}),
};

if (chromePath) {
  console.log(`[validate] Usando navegador local em: ${chromePath}`);
} else {
  console.log('[validate] PW_CHROME_PATH nao definido. Usando browser padrao do Playwright.');
}

const smokeCmd = 'npm run test:e2e:smoke';
const result = spawnSync(smokeCmd, {
  stdio: 'inherit',
  env,
  shell: true,
});

if (result.error) {
  console.error('[validate] Falha ao executar smoke local:', result.error.message);
}

process.exit(result.status ?? 1);
