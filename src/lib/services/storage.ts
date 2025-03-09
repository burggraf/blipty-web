const DB_NAME = 'blipty-storage';
const STORE_NAME = 'sqlite-db';
const DB_KEY = 'database';

export class StorageService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    async saveDatabase(data: Uint8Array): Promise<void> {
        if (!this.db) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, DB_KEY);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async loadDatabase(): Promise<Uint8Array | null> {
        if (!this.db) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(DB_KEY);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    }
}