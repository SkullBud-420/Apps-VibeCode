import { openDB, IDBPDatabase } from 'idb';
import { Grow } from '../types';

const DB_NAME = 'GrowMasterDB';
const STORE_NAME = 'grows';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const storage = {
  async getAllGrows(): Promise<Grow[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async saveGrow(grow: Grow): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, grow);
  },

  async deleteGrow(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  },

  async saveAllGrows(grows: Grow[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    for (const grow of grows) {
      await tx.store.put(grow);
    }
    await tx.done;
  }
};
