// 블로그 임시저장 저장소 — IndexedDB(Blob 포함 가능) 기반의 아주 작은 key/value 헬퍼.
// IndexedDB를 못 쓰는 환경(사파리 프라이빗 등)에서는 localStorage에 텍스트 필드만 저장한다.
// 어떤 경우에도 throw 하지 않는다 (임시저장 실패가 글쓰기를 막으면 안 됨).

const DB_NAME = "sophia-blog-drafts";
const STORE = "drafts";
const LS_PREFIX = "sophia-blog-draft:";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        } catch { /* ignore */ }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** localStorage 폴백: Blob/File 등 직렬화 불가 값은 버리고 텍스트만 남긴다 */
function toTextOnly(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof Blob !== "undefined" && v instanceof Blob ? undefined : v))
  );
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(toTextOnly(value)));
  } catch { /* quota/private → 포기 */ }
}
function lsDelete(key: string) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch { /* ignore */ }
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        if (!db) return reject(new Error("no-idb"));
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve((req.result as T) ?? null);
          tx.onerror = () => reject(tx.error ?? new Error("idb-error"));
          tx.onabort = () => reject(tx.error ?? new Error("idb-abort"));
        } catch (e) {
          reject(e);
        }
      })
  );
}

export async function getDraft<T>(key: string): Promise<T | null> {
  try {
    const v = await run<T>("readonly", (s) => s.get(key)).catch(() => null);
    return v ?? lsGet<T>(key);
  } catch {
    return lsGet<T>(key);
  }
}

export async function setDraft(key: string, value: unknown): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(value, key));
    lsDelete(key); // 예전 폴백 사본이 남아 있으면 정리
    return true;
  } catch {
    lsSet(key, value);
    return false;
  }
}

export async function deleteDraft(key: string): Promise<void> {
  lsDelete(key);
  try {
    await run("readwrite", (s) => s.delete(key));
  } catch { /* ignore */ }
}

const pad = (n: number) => String(n).padStart(2, "0");
/** "HH:mm" */
export const formatDraftTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** "M/D HH:mm" */
export const formatDraftDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatDraftTime(ts)}`;
};
