const { test, expect } = require('@playwright/test');

async function disableAuthOverlay(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  });
}

test('carrega a pagina principal', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await expect(page).toHaveTitle(/Oliveira\s*&\s*Benedet/i);
  await expect(page.locator('#app')).toBeVisible();
});

test('navega entre abas principais', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
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

  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await page.waitForTimeout(1200);

  expect(pageErrors).toEqual([]);
});

test('alternancia de tema claro/escuro persiste', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);

  // Tema inicial: escuro (sem classe 'light' no <html>)
  const htmlEl = page.locator('html');
  const initialClass = await htmlEl.getAttribute('class');
  expect(initialClass ?? '').not.toContain('light');

  // Clica no botão de tema
  await page.click('#theme-toggle-btn');
  await expect(htmlEl).toHaveClass(/light/);

  // Recarrega e verifica persistência via localStorage
  await page.reload();
  await expect(htmlEl).toHaveClass(/light/);

  // Volta ao escuro
  await page.click('#theme-toggle-btn');
  const afterClass = await htmlEl.getAttribute('class');
  expect(afterClass ?? '').not.toContain('light');
});

test('campo de busca esta visivel e aceita entrada', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await disableAuthOverlay(page);

  await page.click('#tab-reg');

  const searchInput = page.locator('#reg-search');
  await expect(searchInput).toBeVisible();

  await searchInput.fill('teste busca');
  await expect(searchInput).toHaveValue('teste busca');
});

test('barra de sincronizacao esta presente no rodape', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await disableAuthOverlay(page);

  await expect(page.locator('#sync-bar')).toBeVisible();
});

test('modal de novo registro abre e fecha', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await disableAuthOverlay(page);

  // Abre modal
  await page.click('#tab-reg');
  await page.click('#btn-new-reg');
  await expect(page.locator('#modal')).toHaveClass(/open/);

  // Fecha modal
  await page.click('#modal-close');
  const modalClass = await page.locator('#modal').getAttribute('class');
  expect(modalClass ?? '').not.toContain('open');
});
});
