import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
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

function authCtx(uid, email = `${uid}@example.com`) {
  return testEnv.authenticatedContext(uid, { email }).firestore();
}

beforeEach(async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'meta', 'security'), {
      adminUids: ['admin-user'],
      adminEmails: ['admin@example.com'],
    });
    for (const uid of ['user-1', 'user-2', 'user-2b', 'user-3', 'user-4', 'user-6']) {
      const email = `${uid}@example.com`;
      await setDoc(doc(db, 'admin_users', email), {
        email,
        active: true,
        panels: { dashboard: true, financeiro: false, relacionamento: false, admin: false },
      });
    }
    await setDoc(doc(db, 'admin_users', 'relationship-user@example.com'), {
      email: 'relationship-user@example.com',
      active: true,
      panels: { dashboard: false, financeiro: false, relacionamento: true, admin: false },
    });
    await setDoc(doc(db, 'admin_users', 'finance-user@example.com'), {
      email: 'finance-user@example.com',
      active: true,
      panels: { dashboard: false, financeiro: true, relacionamento: false, admin: false },
    });
  });
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

    const userDb = authCtx('user-1');
    await assertSucceeds(getDoc(doc(userDb, 'contratos', 'seed')));
  });

  // ── Create ───────────────────────────────────────────────────
  it('permite create com campos validos', async () => {
    const userDb = authCtx('user-2');
    await assertSucceeds(
      setDoc(doc(userDb, 'contratos', 'ok-1'), {
        uid: 'ok-1',
        cliente: 'Teste',
        updatedAt: Date.now(),
      })
    );
  });

  it('permite create com createdAt e updatedAt', async () => {
    const userDb = authCtx('user-2b');
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
    const userDb = authCtx('user-2');
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

    const userDb = authCtx('user-3');
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

    const userDb = authCtx('user-4');
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
        adminUids: ['admin-user'],
      });
    });

    const userDb = authCtx('admin-user', 'admin@example.com');
    await assertSucceeds(getDoc(doc(userDb, 'meta', 'security')));
  });

  it('nega leitura de meta para anonimo', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'meta', 'security')));
  });

  it('protege os dados de relacionamento', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const userDb = authCtx('relationship-user', 'relationship-user@example.com');
    await assertFails(getDoc(doc(anonDb, 'relacionamento_clientes', 'client-1')));
    await assertSucceeds(setDoc(doc(userDb, 'relacionamento_clientes', 'client-1'), {
      id: 'client-1',
      nome: 'Cliente de teste',
    }));
    await assertSucceeds(setDoc(doc(userDb, 'relacionamento_interacoes', 'interaction-1'), {
      id: 'interaction-1',
      clienteId: 'client-1',
    }));
    await assertSucceeds(setDoc(doc(userDb, 'meta', 'relacionamento_config'), {
      sdrs: ['Teste'],
    }));
  });

  it('isola o dashboard do perfil de relacionamento', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contratos', 'restricted-dashboard'), {
        uid: 'restricted-dashboard', cliente: 'Contrato restrito',
      });
    });

    const relationshipDb = authCtx('relationship-user', 'relationship-user@example.com');
    await assertFails(getDoc(doc(relationshipDb, 'contratos', 'restricted-dashboard')));
  });

  it('isola o relacionamento do perfil de dashboard', async () => {
    const dashboardDb = authCtx('user-1');
    await assertFails(getDoc(doc(dashboardDb, 'relacionamento_clientes', 'client-restricted')));
    await assertFails(getDoc(doc(dashboardDb, 'meta', 'relacionamento_config')));
    await assertFails(getDoc(doc(dashboardDb, 'meta', 'cobranca_config')));
    await assertSucceeds(setDoc(doc(dashboardDb, 'meta', 'lists'), { AREAS: ['Cível'] }));
    await assertSucceeds(setDoc(doc(dashboardDb, 'meta', 'photos'), {}));
    await assertSucceeds(setDoc(doc(dashboardDb, 'meta', 'importAudit'), { timestamp: Date.now() }));
  });

  it('protege os dados de financeiro/cobranca para usuario sem permissao', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const dashboardDb = authCtx('user-1');
    const financeDb = authCtx('finance-user', 'finance-user@example.com');
    await assertFails(getDoc(doc(anonDb, 'cobranca_propria_vista', 'rec-1')));
    await assertFails(getDoc(doc(dashboardDb, 'cobranca_propria_vista', 'rec-1')));
    await assertSucceeds(setDoc(doc(financeDb, 'cobranca_propria_vista', 'rec-1'), {
      devedor: 'Devedor Teste',
      valor: 1000,
    }));
  });

  it('permite ao administrador gerenciar preferencias de usuarios', async () => {
    const adminDb = authCtx('admin-user', 'admin@example.com');
    await assertSucceeds(setDoc(doc(adminDb, 'admin_users', 'managed@example.com'), {
      email: 'managed@example.com',
      active: true,
      panels: { dashboard: true, relacionamento: true, admin: false },
    }));
    await assertSucceeds(getDoc(doc(adminDb, 'admin_users', 'managed@example.com')));
  });

  // ── Coleção arbitrária ───────────────────────────────────────
  it('nega acesso a colecoes nao mapeadas', async () => {
    const userDb = testEnv.authenticatedContext('user-6').firestore();
    await assertFails(getDoc(doc(userDb, 'outra-colecao', 'qualquer')));
  });
});
