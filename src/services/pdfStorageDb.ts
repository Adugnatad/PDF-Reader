/**
 * IndexedDB storage for persisting binary PDF documents in browser storage.
 * Allows user-imported, scanned, and generated documents to persist permanently
 * across browser sessions, reloads, and iframe re-renders.
 */

const DB_NAME = 'docuflow_pdf_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_blobs';

interface StoredPdfBlob {
  id: string;
  name: string;
  data: ArrayBuffer;
  size: number;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error:', event);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB init exception:', e);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Persists raw binary PDF buffer into browser's IndexedDB
 */
export async function savePdfToIndexedDb(
  id: string,
  name: string,
  data: Uint8Array | ArrayBuffer
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
      const copy = new Uint8Array(u8.byteLength);
      copy.set(u8);
      const arrayBuffer = copy.buffer as ArrayBuffer;

      const record: StoredPdfBlob = {
        id,
        name,
        data: arrayBuffer,
        size: arrayBuffer.byteLength,
        updatedAt: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch (e) {
      console.warn('IndexedDB save exception:', e);
      resolve(false);
    }
  });
}

/**
 * Loads a raw binary PDF buffer from browser's IndexedDB by id or name
 */
export async function getPdfFromIndexedDb(
  idOrName: string
): Promise<{ data: Uint8Array; name: string; id: string } | null> {
  const db = await getDb();
  if (!db || !idOrName) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // 1. Try direct ID lookup
      const req = store.get(idOrName);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve({
            data: new Uint8Array(req.result.data),
            name: req.result.name,
            id: req.result.id,
          });
          return;
        }

        // 2. Cursor scan for matching filename
        const cleanTarget = idOrName.toLowerCase().trim();
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            if (
              val.name.toLowerCase() === cleanTarget ||
              val.name.toLowerCase().replace(/\.pdf$/i, '') === cleanTarget.replace(/\.pdf$/i, '') ||
              val.id.toLowerCase() === cleanTarget
            ) {
              resolve({
                data: new Uint8Array(val.data),
                name: val.name,
                id: val.id,
              });
              return;
            }
            cursor.continue();
          } else {
            resolve(null);
          }
        };
        cursorReq.onerror = () => resolve(null);
      };

      req.onerror = () => resolve(null);
    } catch (e) {
      console.warn('IndexedDB get exception:', e);
      resolve(null);
    }
  });
}

/**
 * Deletes a PDF record from IndexedDB
 */
export async function deletePdfFromIndexedDb(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
