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
