// Every read/modify/write runs while holding one IndexedDB readwrite
// transaction. Callbacks must be synchronous: no network or unrelated awaits.
export function localTransaction(name, key, update, { indexedDB = globalThis.indexedDB } = {}) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('IndexedDB is unavailable.')); return; }
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('records', 'readwrite');
      const records = tx.objectStore('records');
      let result;
      let failure;
      const read = records.get(key);
      read.onsuccess = () => {
        try {
          const change = update(read.result);
          if (change.result instanceof Promise) {
            // Repository commands only perform synchronous in-memory work;
            // observe a rejected command before the transaction can commit.
            change.result.catch((error) => { failure = error; try { tx.abort(); } catch {} });
          }
          result = change.result;
          if (change.delete) records.delete(key);
          else if ('value' in change) records.put(change.value, key);
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = () => { db.close(); reject(failure || tx.error || new Error('Local transaction aborted.')); };
      tx.onerror = () => {};
    };
  });
}

const recoveryDatabase = 'life-lab-recovery';
export const readRecovery = (key) => localTransaction(recoveryDatabase, key, (value) => ({ result: value }));
export const writeRecovery = (key, value) => localTransaction(recoveryDatabase, key, () => ({ value, result: value }));
export const deleteRecovery = (key) => localTransaction(recoveryDatabase, key, () => ({ delete: true }));
