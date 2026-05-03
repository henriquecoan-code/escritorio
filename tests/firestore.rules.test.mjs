import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

  it('bloqueia create com campo nao permitido', async () => {
    const userDb = testEnv.authenticatedContext('user-3').firestore();
    await assertFails(
      setDoc(doc(userDb, 'contratos', 'bad-1'), {
        uid: 'bad-1',
        cliente: 'Teste',
        hacker: true,
      })
    );
  });
});
