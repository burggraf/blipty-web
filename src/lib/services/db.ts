import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import { StorageService } from './storage';

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
const storage = new StorageService();

export async function initializeDB() {
    if (!dbInstance) {
        try {
            // Initialize storage service
            await storage.init();

            // Initialize SQL.js with WASM file from static directory
            SQL = await initSqlJs({
                locateFile: file => `/sql.js/${file}`  // This will resolve to /static/sql.js/
            });

            // Try to load existing database
            const savedDb = await storage.loadDatabase();
            if (savedDb) {
                dbInstance = new SQL.Database(savedDb);
            } else {
                // Create a new database if none exists
                dbInstance = new SQL.Database();
                await createTables();
            }

            // Enable WAL mode for better performance
            await query('PRAGMA journal_mode = WAL');
            await query('PRAGMA synchronous = NORMAL');

            // Set up periodic saves
            if (typeof window !== 'undefined') {
                setInterval(persistDatabase, 30000); // Save every 30 seconds
                window.addEventListener('beforeunload', () => {
                    persistDatabase();
                });
            }
        } catch (error) {
            console.error('Failed to initialize SQLite:', error);
            throw error;
        }
    }
    return dbInstance;
}

// Save current database state to storage
async function persistDatabase() {
    if (!dbInstance) return;
    try {
        const data = dbInstance.export();
        await storage.saveDatabase(data);
    } catch (error) {
        console.error('Failed to persist database:', error);
    }
}

async function migrateToProviderTerminology() {
    await transaction(async () => {
        // Check if old tables exist
        const oldTableExists = await query<{ cnt: number }>(
            "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='playlists'"
        );

        if (oldTableExists[0]?.cnt > 0) {
            // Create new tables
            await exec(`
                CREATE TABLE IF NOT EXISTS providers (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    server_url TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Move data from playlists to providers if it exists
                INSERT OR IGNORE INTO providers (id, name, server_url, username, password, created_at)
                SELECT id, name, server_url, username, password, created_at FROM playlists;

                -- Create temporary table for categories
                CREATE TABLE categories_new (
                    id INTEGER PRIMARY KEY,
                    provider_id INTEGER REFERENCES providers(id),
                    category_type TEXT CHECK(category_type IN ('live', 'vod_movie', 'vod_series')),
                    category_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    UNIQUE(provider_id, category_type, category_id)
                );

                -- Move data from old categories table
                INSERT OR IGNORE INTO categories_new (id, provider_id, category_type, category_id, name)
                SELECT id, playlist_id, category_type, category_id, name FROM categories;

                -- Drop old tables
                DROP TABLE IF EXISTS categories;
                ALTER TABLE categories_new RENAME TO categories;
                DROP TABLE IF EXISTS playlists;
            `);
        }
    });
}

async function createTables() {
    if (!dbInstance) throw new Error('Database not initialized');

    await exec(`
        CREATE TABLE IF NOT EXISTS providers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            server_url TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            provider_id INTEGER REFERENCES providers(id),
            category_type TEXT CHECK(category_type IN ('live', 'vod_movie', 'vod_series')),
            category_id TEXT NOT NULL,
            name TEXT NOT NULL,
            UNIQUE(provider_id, category_type, category_id)
        );

        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY,
            category_id INTEGER REFERENCES categories(id),
            provider_id INTEGER REFERENCES providers(id),
            stream_id TEXT NOT NULL,
            name TEXT NOT NULL,
            icon_url TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            metadata JSON
        );

        CREATE TABLE IF NOT EXISTS channelinfo (
            id INTEGER PRIMARY KEY,
            provider_id INTEGER NOT NULL,
            stream_id TEXT NOT NULL,
            favorite BOOLEAN DEFAULT FALSE,
            hidden BOOLEAN DEFAULT FALSE,
            restricted BOOLEAN DEFAULT FALSE,
            height NUMERIC,
            width NUMERIC,
            status TEXT,
            last_watched DATETIME,
            metadata JSON,
            UNIQUE(provider_id, stream_id),
            FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS epg_data (
            channel_id INTEGER REFERENCES channels(id),
            start TIMESTAMP NOT NULL,
            end TIMESTAMP NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            PRIMARY KEY (channel_id, start)
        );

        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            expires INTEGER NOT NULL
        );
    `);

    // Run migration for existing databases
    await migrateToProviderTerminology();
}

// Execute raw SQL
export async function exec(sql: string): Promise<void> {
    if (!dbInstance) throw new Error('Database not initialized');
    dbInstance.run(sql);
}

// Query helper function
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!dbInstance) throw new Error('Database not initialized');
    const result = dbInstance.exec(sql, params)[0];
    if (!result) return [];

    return result.values.map(row => {
        const obj: any = {};
        result.columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj as T;
    });
}

// Transaction helper
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (!dbInstance) throw new Error('Database not initialized');

    await exec('BEGIN TRANSACTION');
    try {
        const result = await callback();
        await exec('COMMIT');
        return result;
    } catch (error) {
        await exec('ROLLBACK');
        throw error;
    }
}

// Cache implementation
export const cache = {
    get: async <T>(key: string): Promise<T | null> => {
        const result = await query<{ value: string }>(
            'SELECT value FROM cache WHERE key = ? AND expires > ?',
            [key, Date.now()]
        );
        return result[0]?.value ? JSON.parse(result[0].value) : null;
    },

    set: async <T>(key: string, value: T, ttl = 3600): Promise<void> => {
        await query(
            'INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?, ?, ?)',
            [key, JSON.stringify(value), Date.now() + ttl * 1000]
        );
    },

    clear: async (): Promise<void> => {
        await exec('DELETE FROM cache WHERE expires <= ?');
    }
};

// Export database instance for direct access if needed
export function getDb(): Database | null {
    return dbInstance;
}

// Simple performance monitoring
const performanceMarks = new Map<string, number>();

export function startDbOperation(name: string) {
    performanceMarks.set(name, performance.now());
}

export function endDbOperation(name: string) {
    const start = performanceMarks.get(name);
    if (start) {
        const duration = performance.now() - start;
        performanceMarks.delete(name);
        console.debug(`DB Operation "${name}" took ${duration.toFixed(2)}ms`);
    }
}

// Save database to binary array
export function exportDatabase(): Uint8Array {
    if (!dbInstance) throw new Error('Database not initialized');
    return dbInstance.export();
}

// Load database from binary array
export async function importDatabase(data: Uint8Array): Promise<void> {
    if (!SQL) throw new Error('SQL.js not initialized');
    dbInstance = new SQL.Database(data);
}