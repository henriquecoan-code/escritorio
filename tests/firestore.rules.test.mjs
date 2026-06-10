import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-ob-dashboard',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Rules - dashboard', () => {
  // ── Leitura ──────────────────────────────────────────────────
  it('bloqueia leitura para anonimo', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'contratos', 'seed')));
  });

  it('permite leitura para usuario autenticado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contratos', 'seed'), {
        uid: 'seed',
        cliente: 'Contrato Seed',
      });
    });

    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(getDoc(doc(userDb, 'contratos', 'seed')));
  });

  // ── Create ───────────────────────────────────────────────────
  it('permite create com campos validos', async () => {
    const userDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      setDoc(doc(userDb, 'contratos', 'ok-1'), {
        uid: 'ok-1',
        cliente: 'Teste',
        updatedAt: Date.now(),
      })
    );
  });

  it('permite create com createdAt e updatedAt', async () => {
    const userDb = testEnv.authenticatedContext('user-2b').firestore();
    const now = Date.now();
    await assertSucceeds(
      setDoc(doc(userDb, 'contratos', 'ok-1b'), {
        uid: 'ok-1b',
        cliente: 'Teste com createdAt',
        createdAt: now,
        updatedAt: now,
      })
    );
  });

  it('nega create com campo nao permitido', async () => {
    const userDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(userDb, 'contratos', 'bad-1'), {
        uid: 'bad-1',
        cliente: 'Teste',
        campoProibido: 'valor',
      })
    );
  });

  it('nega create para usuario anonimo', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, 'contratos', 'anon-1'), {
        uid: 'anon-1',
        cliente: 'Teste Anon',
      })
    );
  });

  // ── Update ───────────────────────────────────────────────────
  it('permite update para usuario autenticado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contratos', 'upd-1'), {
        uid: 'upd-1',
        cliente: 'Original',
      });
    });

    const userDb = testEnv.authenticatedContext('user-3').firestore();
    await assertSucceeds(
      updateDoc(doc(userDb, 'contratos', 'upd-1'), { cliente: 'Atualizado' })
    );
  });

  it('nega update para usuario anonimo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contratos', 'upd-anon'), {
        uid: 'upd-anon',
        cliente: 'Original',
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(anonDb, 'contratos', 'upd-anon'), { cliente: 'Hackeado' })
    );
  });

  // ── Delete ───────────────────────────────────────────────────
  it('permite delete para usuario autenticado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contratos', 'del-1'), {
        uid: 'del-1',
        cliente: 'Para Deletar',
      });
    });

    const userDb = testEnv.authenticatedContext('user-4').firestore();
    await assertSucceeds(deleteDoc(doc(userDb, 'contratos', 'del-1')));
  });

  it('nega delete para usuario anonimo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contratos', 'del-anon'), {
        uid: 'del-anon',
        cliente: 'Nao Deletar',
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(deleteDoc(doc(anonDb, 'contratos', 'del-anon')));
  });

  // ── meta ─────────────────────────────────────────────────────
  it('permite leitura de meta para autenticado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'meta', 'security'), {
        adminUids: ['uid-admin'],
      });
    });

    const userDb = testEnv.authenticatedContext('user-5').firestore();
    await assertSucceeds(getDoc(doc(userDb, 'meta', 'security')));
  });

  it('nega leitura de meta para anonimo', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'meta', 'security')));
  });

  // ── Coleção arbitrária ───────────────────────────────────────
  it('nega acesso a colecoes nao mapeadas', async () => {
    const userDb = testEnv.authenticatedContext('user-6').firestore();
    await assertFails(getDoc(doc(userDb, 'outra-colecao', 'qualquer')));
  });
});
