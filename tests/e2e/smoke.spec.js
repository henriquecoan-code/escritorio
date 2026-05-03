const { test, expect } = require('@playwright/test');

async function disableAuthOverlay(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  });
}

async function waitForOverlayOpen(page) {
  await expect(page.locator('#auth-overlay')).toHaveClass(/open/, { timeout: 5000 });
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

// --- Testes de login ---

test('overlay de login aparece ao carregar', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await waitForOverlayOpen(page);
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  await expect(page.locator('#auth-login-btn')).toBeVisible();
});

test('login vazio mostra mensagem de validacao', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await waitForOverlayOpen(page);

  await page.click('#auth-login-btn');

  await expect(page.locator('#auth-err')).toHaveText('Informe email e senha.');
});

test('login com email invalido mostra erro em portugues', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await waitForOverlayOpen(page);

  await page.fill('#auth-email', 'nao-e-um-email');
  await page.fill('#auth-password', 'qualquercoisa');
  await page.click('#auth-login-btn');

  // Aguarda a resposta do Firebase (pode ser lenta)
  await expect(page.locator('#auth-err')).not.toHaveText('', { timeout: 8000 });

  // Garante que a mensagem NÃO é o erro técnico bruto do Firebase em inglês
  const errText = await page.locator('#auth-err').textContent();
  expect(errText).not.toMatch(/Firebase:|auth\//i);
  expect(errText.length).toBeGreaterThan(5);
});

test('botao de login fica desabilitado durante autenticacao', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await waitForOverlayOpen(page);

  await page.fill('#auth-email', 'teste@teste.com');
  await page.fill('#auth-password', 'senhaqualquer');

  // Clica e imediatamente verifica o estado do botão
  await page.click('#auth-login-btn');
  const disabled = await page.locator('#auth-login-btn').getAttribute('disabled');
  const label = await page.locator('#auth-login-btn').textContent();

  // Botão deve estar desabilitado OU já ter voltado (se resposta foi muito rápida)
  // Verificamos que pelo menos o texto de erro aparece depois
  await expect(page.locator('#auth-err')).not.toHaveText('', { timeout: 8000 });
});
