// db.js — envoltura mínima de IndexedDB (ajustes, carpeta elegida, listas, caché de etiquetas)

let dbp;
function open() {
  dbp ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('ipod', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('meta', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const kvDel = (k) => tx('kv', 'readwrite', (s) => s.delete(k));
export const metaAll = () => tx('meta', 'readonly', (s) => s.getAll());
export const metaPutMany = (list) => tx('meta', 'readwrite', (s) => { list.forEach((m) => s.put(m)); });
export const metaDel = (id) => tx('meta', 'readwrite', (s) => s.delete(id));
