const { test, expect } = require('@playwright/test');

const E2E_EMAIL = process.env.E2E_EMAIL || '';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '';
const E2E_USER2_EMAIL = process.env.E2E_USER2_EMAIL || '';
const E2E_USER2_PASSWORD = process.env.E2E_USER2_PASSWORD || '';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function gotoDashboard(page, baseURL) {
  await page.goto(`${baseURL}/OB_Dashboard_Rede.html`);
  await expect(page.locator('#app')).toBeVisible();
}

async function login(page, email, password) {
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', password);
  await page.click('#auth-login-btn');
  await expect(page.locator('#auth-overlay')).not.toHaveClass(/open/, { timeout: 15000 });
  await expect(page.locator('#auth-user')).toContainText(email, { timeout: 15000 });
}

async function logout(page) {
  await page.click('#auth-logout-btn');
  await expect(page.locator('#auth-overlay')).toHaveClass(/open/, { timeout: 15000 });
}

async function ensureLoggedIn(page, email, password) {
  const isOpen = await page.locator('#auth-overlay').evaluate((el) => el.classList.contains('open'));
  if (isOpen) {
    await login(page, email, password);
  }
}

async function openRecordsTab(page) {
  await page.click('#tab-reg');
  await expect(page.locator('#view-reg')).toHaveClass(/\bon\b/);
}

async function createRecordViaModal(page, clientName) {
  await createRecordViaModalWithOptions(page, {
    clientName,
    advIndex: 1,
  });
}

async function createRecordViaModalWithOptions(page, { clientName, advIndex = 1 }) {
  await page.click('#open-new-contract-btn');
  await expect(page.locator('#overlay')).toHaveClass(/open/);

  await page.fill('#m-cli', clientName);
  await page.selectOption('#m-adv', { index: advIndex });
  await page.fill('#m-dtCheg', todayIso());

  const selectedAdv = await page.locator('#m-adv option:checked').textContent();
  await page.click('#save-contract-btn');

  await expect(page.locator('#overlay')).not.toHaveClass(/open/, { timeout: 15000 });
  return { selectedAdv: (selectedAdv || '').trim() };
}

async function openCardByClient(page, clientName) {
  await openRecordsTab(page);
  await page.fill('#reg-srch', clientName);

  const card = page.locator('.reg-card', { hasText: clientName }).first();
  await expect(card).toBeVisible({ timeout: 15000 });

  const panel = card.locator('.reg-panel');
  await card.locator('[data-toggle-card]').click();
  await expect(panel).toHaveClass(/open/);

  return card;
}

async function deleteRecordFromCard(page, clientName) {
  const card = await openCardByClient(page, clientName);
  await card.locator('[data-reg-delete]').click();
  await page.click('#del-btn');

  await expect(page.locator('.reg-card', { hasText: clientName })).toHaveCount(0, { timeout: 15000 });
}

async function ensureDeletedIfExists(page, clientName) {
  await openRecordsTab(page);
  await page.fill('#reg-srch', clientName);
  const card = page.locator('.reg-card', { hasText: clientName }).first();
  if ((await card.count()) > 0) {
    await deleteRecordFromCard(page, clientName);
  }
  await page.fill('#reg-srch', '');
}

test.describe.configure({ mode: 'serial' });

test.describe('Fluxo real autenticado', () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'Defina E2E_EMAIL e E2E_PASSWORD para rodar os testes de fluxo real.');

  test('login real, CRUD com persistencia e delete final', async ({ page, baseURL }) => {
    const seed = Date.now();
    const createdName = `E2E Auto ${seed}`;
    const editedName = `${createdName} Editado`;

    await gotoDashboard(page, baseURL);
    await login(page, E2E_EMAIL, E2E_PASSWORD);

    await createRecordViaModal(page, createdName);

    const card = await openCardByClient(page, createdName);
    await card.locator('[data-reg-field="cliente"]').fill(editedName);
    await card.locator('[data-reg-save]').click();

    await page.reload();
    await ensureLoggedIn(page, E2E_EMAIL, E2E_PASSWORD);
    await openRecordsTab(page);
    await page.fill('#reg-srch', editedName);
    await expect(page.locator('.reg-card', { hasText: editedName }).first()).toBeVisible({ timeout: 15000 });

    await deleteRecordFromCard(page, editedName);
  });

  test('login invalido mostra erro e logout volta para overlay', async ({ page, baseURL }) => {
    await gotoDashboard(page, baseURL);

    await page.fill('#auth-email', 'invalido@example.com');
    await page.fill('#auth-password', 'senha-invalida');
    await page.click('#auth-login-btn');
    await expect(page.locator('#auth-err')).not.toHaveText('');

    await login(page, E2E_EMAIL, E2E_PASSWORD);
    await logout(page);
  });

  test('usuario 2 consegue editar registro criado pelo usuario 1 (regra atual)', async ({ page, baseURL }) => {
    test.skip(
      !E2E_USER2_EMAIL || !E2E_USER2_PASSWORD,
      'Defina E2E_USER2_EMAIL e E2E_USER2_PASSWORD para validar permissao cruzada.'
    );

    const seed = Date.now();
    const createdName = `E2E Perm ${seed}`;
    const user2EditedName = `${createdName} U2`;

    await gotoDashboard(page, baseURL);
    await login(page, E2E_EMAIL, E2E_PASSWORD);
    await createRecordViaModal(page, createdName);

    await logout(page);
    await login(page, E2E_USER2_EMAIL, E2E_USER2_PASSWORD);

    const card = await openCardByClient(page, createdName);
    await card.locator('[data-reg-field="cliente"]').fill(user2EditedName);
    await card.locator('[data-reg-save]').click();

    await page.reload();
    await ensureLoggedIn(page, E2E_USER2_EMAIL, E2E_USER2_PASSWORD);
    await openRecordsTab(page);
    await page.fill('#reg-srch', user2EditedName);
    await expect(page.locator('.reg-card', { hasText: user2EditedName }).first()).toBeVisible({ timeout: 15000 });

    await deleteRecordFromCard(page, user2EditedName);
  });

  test('busca e filtro por advogado funcionam', async ({ page, baseURL }) => {
    const seed = Date.now();
    const recA = `E2E Busca A ${seed}`;
    const recB = `E2E Busca B ${seed}`;

    await gotoDashboard(page, baseURL);
    await login(page, E2E_EMAIL, E2E_PASSWORD);

    const { selectedAdv: advA } = await createRecordViaModalWithOptions(page, {
      clientName: recA,
      advIndex: 1,
    });
    await createRecordViaModalWithOptions(page, {
      clientName: recB,
      advIndex: 2,
    });

    await openRecordsTab(page);

    await page.fill('#reg-srch', recA);
    await expect(page.locator('.reg-card', { hasText: recA }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.reg-card', { hasText: recB })).toHaveCount(0);

    await page.fill('#reg-srch', '');
    await page.selectOption('#reg-ff-adv', { label: advA });
    await expect(page.locator('.reg-card', { hasText: recA }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.reg-card', { hasText: recB })).toHaveCount(0);

    await page.selectOption('#reg-ff-adv', { value: '' });
    await ensureDeletedIfExists(page, recA);
    await ensureDeletedIfExists(page, recB);
  });

  test('paginacao avanca quando ha mais de uma pagina', async ({ page, baseURL }) => {
    await gotoDashboard(page, baseURL);
    await login(page, E2E_EMAIL, E2E_PASSWORD);
    await openRecordsTab(page);

    await page.fill('#reg-srch', '');
    await page.selectOption('#reg-ff-adv', { value: '' });
    await page.selectOption('#reg-ff-mes', { value: '' });
    await page.selectOption('#reg-ff-etapa', { value: '' });

    const infoBefore = (await page.locator('#reg-pag-info').innerText()).trim();
    const match = infoBefore.match(/P[áa]gina\s+(\d+)\s+de\s+(\d+)/i);
    const totalPages = match ? Number(match[2]) : 1;
    test.skip(totalPages <= 1, 'Ambiente atual nao possui registros suficientes para testar paginacao.');

    await page.click('#reg-pag-btns button[data-reg-page="2"]');
    await expect(page.locator('#reg-pag-info')).toContainText(/P[áa]gina\s+2\s+de/i, { timeout: 15000 });
  });

  test('importador JSON cria registro e dashboard enxerga o item', async ({ page, baseURL }) => {
    const seed = Date.now();
    const importUid = `e2e-import-${seed}`;
    const importClient = `E2E Import ${seed}`;
    const payload = [
      {
        uid: importUid,
        cliente: importClient,
        updatedAt: Date.now(),
      },
    ];

    await page.goto(`${baseURL}/scripts/import-firestore.html`);
    await page.fill('#email', E2E_EMAIL);
    await page.fill('#senha', E2E_PASSWORD);
    await page.click('#btnLogin');
    await expect(page.locator('#userStatus')).toContainText(E2E_EMAIL, { timeout: 15000 });

    await page.setInputFiles('#fileInput', {
      name: 'e2e-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
    });

    await page.click('#btnImport');
    await expect(page.locator('#status')).toContainText(/Conclu[ií]do/i, { timeout: 60000 });

    await gotoDashboard(page, baseURL);
    await ensureLoggedIn(page, E2E_EMAIL, E2E_PASSWORD);
    await openRecordsTab(page);
    await page.fill('#reg-srch', importClient);
    await expect(page.locator('.reg-card', { hasText: importClient }).first()).toBeVisible({ timeout: 15000 });

    await ensureDeletedIfExists(page, importClient);
  });
});
