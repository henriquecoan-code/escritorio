import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.');
  }

  // Accept either plain JSON or base64 encoded JSON.
  const text = raw.trim();
  if (text.startsWith('{')) {
    return JSON.parse(text);
  }

  const decoded = Buffer.from(text, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

function toPlain(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item));
  }

  if (typeof value !== 'object') {
    return value;
  }

  // Firestore Timestamp compatibility check.
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  // Firestore DocumentReference compatibility check.
  if (typeof value.path === 'string' && typeof value.id === 'string' && typeof value.firestore === 'object') {
    return { __ref: value.path };
  }

  // Firestore GeoPoint compatibility check.
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { __geo: { latitude: value.latitude, longitude: value.longitude } };
  }

  const obj = {};
  for (const [k, v] of Object.entries(value)) {
    obj[k] = toPlain(v);
  }
  return obj;
}

async function exportCollection(collectionRef) {
  const snap = await collectionRef.get();
  const result = [];

  for (const docSnap of snap.docs) {
    const entry = {
      id: docSnap.id,
      data: toPlain(docSnap.data()),
      subcollections: {}
    };

    const subs = await docSnap.ref.listCollections();
    for (const sub of subs) {
      entry.subcollections[sub.id] = await exportCollection(sub);
    }

    if (Object.keys(entry.subcollections).length === 0) {
      delete entry.subcollections;
    }

    result.push(entry);
  }

  return result;
}

async function main() {
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const outFile = outArg ? outArg.slice('--out='.length) : path.join('backup', 'firestore-backup.json');

  const serviceAccount = parseServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }

  const db = getFirestore();
  const topCollections = await db.listCollections();

  const payload = {
    createdAtUtc: new Date().toISOString(),
    projectId: serviceAccount.project_id,
    collections: {}
  };

  for (const col of topCollections) {
    payload.collections[col.id] = await exportCollection(col);
  }

  const outDir = path.dirname(outFile);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');

  process.stdout.write(`Backup file created: ${outFile}\n`);
}

main().catch((err) => {
  process.stderr.write(`Backup failed: ${err.message}\n`);
  process.exit(1);
});
