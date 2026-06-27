// Offline queue + auto-sync shared module.
// Loaded by intake.html and dashboard.html.

const OFFLINE_DB_NAME = 'kumbh-offline';
const OFFLINE_STORE   = 'queue';

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

async function enqueue(url, body) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(OFFLINE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE);
    store.add({ url, body, queued_at: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function dequeue(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function getAllQueued() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(OFFLINE_STORE, 'readonly');
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// Try to POST; if the network is down, save to IndexedDB queue instead.
// Returns { online: true, data } on success, or { online: false, queued: true } when saved offline.
async function submitWithOfflineSupport(url, body) {
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return { online: true, data: await res.json() };
  } catch (err) {
    if (!navigator.onLine) {
      await enqueue(url, body);
      return { online: false, queued: true };
    }
    throw err;
  }
}

// Replay the offline queue.  Returns the number of items successfully flushed.
async function flushQueue(onProgress) {
  const items = await getAllQueued();
  if (!items.length) return 0;

  let flushed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(item.body),
      });
      if (res.ok) {
        await dequeue(item.id);
        flushed++;
        if (onProgress) onProgress(flushed, items.length);
      }
    } catch {
      break; // still offline — stop, leave the rest queued
    }
  }
  return flushed;
}

async function queueLength() {
  return (await getAllQueued()).length;
}
