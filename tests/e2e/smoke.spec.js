const { test, expect } = require('@playwright/test');

async function disableAuthOverlay(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  });
}

async function bypassAuthGuard(page) {
  await page.evaluate(() => {
    if (typeof window.ensureAuthenticated === 'function') {
      window.ensureAuthenticated = () => true;
    }
  });
}

test('carrega a pagina principal', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  await expect(page).toHaveTitle(/Oliveira\s*&\s*Benedet/i);
  await expect(page.locator('#app')).toBeVisible();
});

test('carrega a pagina independente de relacionamento', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/relacionamento.html`);
  await expect(page).toHaveTitle(/Comercial\s*&\s*Relacionamento/i);
  await expect(page.locator('#tabs')).toBeVisible();
  await expect(page.locator('#authOverlay')).toBeVisible();
});

test('navega entre abas principais', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  await disableAuthOverlay(page);

  await page.click('#tab-reg');
  await expect(page.locator('#view-reg')).toHaveClass(/\bon\b/);

  await page.click('#tab-cfg');
  await expect(page.locator('#view-cfg')).toHaveClass(/\bon\b/);

  await page.click('#tab-dash');
  await expect(page.locator('#view-dash')).toHaveClass(/\bon\b/);
});

test('sem erro de runtime no carregamento', async ({ page, baseURL }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(`${baseURL}/index.html`);
  await page.waitForTimeout(1200);

  expect(pageErrors).toEqual([]);
});

test('alternancia de tema claro/escuro persiste', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  await disableAuthOverlay(page);

  // Tema inicial: escuro (sem classe 'light' no <html>)
  const htmlEl = page.locator('html');
  const initialClass = await htmlEl.getAttribute('class');
  expect(initialClass ?? '').not.toContain('light');

  // Clica no botão de tema
  await page.click('#theme-toggle-btn');
  await expect(htmlEl).toHaveClass(/light/);

  // Recarrega e verifica persistência via localStorage
  await page.reload();
  await disableAuthOverlay(page);
  await expect(htmlEl).toHaveClass(/light/);

  // Volta ao escuro
  await page.click('#theme-toggle-btn');
  const afterClass = await htmlEl.getAttribute('class');
  expect(afterClass ?? '').not.toContain('light');
});

test('campo de busca esta visivel e aceita entrada', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  await disableAuthOverlay(page);

  await page.click('#tab-reg');

  const searchInput = page.locator('#reg-srch');
  await expect(searchInput).toBeVisible();

  await searchInput.fill('teste busca');
  await expect(searchInput).toHaveValue('teste busca');
});

test('barra de sincronizacao esta presente no rodape', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  await disableAuthOverlay(page);

  await expect(page.locator('#sync-bar')).toBeVisible();
});

test('modal de novo registro abre e fecha', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  await disableAuthOverlay(page);
  await bypassAuthGuard(page);

  // Abre modal
  await page.click('#open-new-contract-btn');
  await expect(page.locator('#overlay')).toHaveClass(/open/);

  // Fecha modal
  await page.click('#close-modal-x-btn');
  const modalClass = await page.locator('#overlay').getAttribute('class');
  expect(modalClass ?? '').not.toContain('open');
});
