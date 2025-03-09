# Technical Implementation Guide for Xtream Codes Client Application

## Executive Summary

This guide details the development of a client-side SvelteKit application leveraging Xtream Codes APIs to manage IPTV providers, persist data via SQLite WASM/IndexedDB, and present content through a responsive UI. The solution implements modern browser storage capabilities while addressing performance constraints identified in recent benchmarks[4][8][10].

---

## Core Architecture

### Technology Stack

```
Frontend: Svelte 5 + TypeScript + shadcn-svelte
Build Tool: Bun v2.4+
Storage: SQLite WASM (sqlite-wasm[2][8]) + IndexedDB VFS
Persistence: OPFS SyncAccessHandle (Chrome/Edge) with IndexedDB fallback
API Client: Custom Xtream Codes implementation
```

### Data Flow Diagram

```
[UI Input] → [API Client] ↔ [SQLite WASM]
    ↕                ↕
[IndexedDB] ← [WASM Worker]
```

---

## Xtream Codes API Implementation

### API Endpoint Structure

```typescript
interface XtreamConfig {
	baseUrl: string;
	username: string;
	password: string;
}

const API_ENDPOINTS = {
	LIVE_CATEGORIES: (c: XtreamConfig) =>
		`${c.baseUrl}/player_api.php?username=${c.username}&password=${c.password}&action=get_live_categories`,

	LIVE_STREAMS: (c: XtreamConfig, categoryId: string) =>
		`${c.baseUrl}/player_api.php?username=${c.username}&password=${c.password}&action=get_live_streams&category_id=${categoryId}`,

	VOD_CATEGORIES: (c: XtreamConfig) =>
		`${c.baseUrl}/player_api.php?username=${c.username}&password=${c.password}&action=get_vod_categories`,

	VOD_STREAMS: (c: XtreamConfig, categoryId: string) =>
		`${c.baseUrl}/player_api.php?username=${c.username}&password=${c.password}&action=get_vod_streams&category_id=${categoryId}`,

	EPG_DATA: (c: XtreamConfig, streamId: string) =>
		`${c.baseUrl}/player_api.php?username=${c.username}&password=${c.password}&action=get_short_epg&stream_id=${streamId}&limit=500`,

	STREAM_URL: (c: XtreamConfig, streamId: number, type: 'live' | 'movie' | 'series') =>
		`${c.baseUrl}/${type}/${c.username}/${c.password}/${streamId}`
};
```

_Implementation based on Xtream API analysis[1][3][5][9]_

---

## Database Schema Design

### SQLite Tables Structure

```sql
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER REFERENCES playlists(id),
  category_type TEXT CHECK(category_type IN ('live', 'vod_movie', 'vod_series')),
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(playlist_id, category_type, category_id)
);

CREATE TABLE channels (
  id INTEGER PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  stream_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

CREATE TABLE epg_data (
  channel_id INTEGER REFERENCES channels(id),
  start TIMESTAMP NOT NULL,
  end TIMESTAMP NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (channel_id, start)
);
```

_Schema optimized for Xtream data relationships[3][5][9]_

---

## Storage Layer Implementation

### WASM SQLite Configuration

```typescript
// lib/db.ts
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

let dbInstance: Database | null = null;

export async function initializeDB() {
	if (!dbInstance) {
		try {
			SQL = await initSqlJs({ locateFile: (file) => `/sql.js/${file}` });

			// Try to load existing database from IndexedDB
			const savedDb = await storage.loadDatabase();
			if (savedDb) {
				dbInstance = new SQL.Database(savedDb);
			} else {
				dbInstance = new SQL.Database();
				await createTables();
			}

			// Enable WAL mode for better performance
			await query('PRAGMA journal_mode = WAL');
			await query('PRAGMA synchronous = NORMAL');
		} catch (error) {
			console.error('Failed to initialize SQLite:', error);
			throw error;
		}
	}
	return dbInstance;
}
```

_Implements sql.js with IndexedDB persistence and WAL mode[2][8]_

---

## UI Component Structure

### Playlist Management Workflow

```svelte
{#each $playlists as playlist (playlist.id)}
	{playlist.name}

	loadContent(playlist, type)} />
{/each}

{#if selectedChannel}{:else}{/if}
```

_Implements shadcn-svelte components with lazy loading[6][12]_

---

## Performance Optimization Strategies

1. **IndexedDB Caching Layer**

   ```typescript
   const cacheHandler = {
   	get: async (key: string) => {
   		const result = await db?.run('SELECT value FROM cache WHERE key = ? AND expires > ?', [
   			key,
   			Date.now()
   		]);
   		return result?.[0]?.value ? JSON.parse(result[0].value) : null;
   	},
   	set: async (key: string, value: any, ttl = 3600) => {
   		await db?.run('INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?, ?, ?)', [
   			key,
   			JSON.stringify(value),
   			Date.now() + ttl * 1000
   		]);
   	}
   };
   ```

   _Reduces API calls by 40% based on Notion's implementation[10]_

2. **Bulk Insert Transactions**

   ```typescript
   async function bulkInsertChannels(channels: Channel[]) {
   	const insert = db.prepare(
   		`INSERT OR IGNORE INTO channels 
       (category_id, stream_id, name, icon_url, metadata)
       VALUES (?, ?, ?, ?, ?)`
   	);

   	await db.transaction(() => {
   		channels.forEach((channel) => {
   			insert.run(
   				channel.categoryId,
   				channel.streamId,
   				channel.name,
   				channel.iconUrl,
   				JSON.stringify(channel.metadata)
   			);
   		});
   	});
   }
   ```

   _Achieves 3-5x faster inserts compared to individual operations[4]_

---

## Security Considerations

1. **Credential Storage**

   ```typescript
   import { subtle } from 'crypto-web';

   async function encryptCredentials(password: string, data: string) {
   	const key = await subtle.importKey(
   		'raw',
   		new TextEncoder().encode(password),
   		{ name: 'AES-GCM' },
   		false,
   		['encrypt', 'decrypt']
   	);

   	const iv = crypto.getRandomValues(new Uint8Array(12));
   	const encrypted = await subtle.encrypt(
   		{ name: 'AES-GCM', iv },
   		key,
   		new TextEncoder().encode(data)
   	);

   	return { iv, encrypted };
   }
   ```

   _Implements Web Crypto API for secure credential storage_

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (2 Weeks)

1. Set up SvelteKit project with static adapter
   ```bash
   bun create svelte@latest xtream-client
   cd xtream-client
   bun install sql.js @types/sql.js @shadcn-svelte/ui
   ```
2. Implement SQLite WASM initialization
3. Create base UI layout with sidebar components

### Phase 2: API Integration (3 Weeks)

1. Develop Xtream API client service
2. Implement data synchronization workers
3. Create database schema migration system

### Phase 3: UI Polish (1 Week)

1. Implement lazy loading for category trees
2. Add video player integration (HLS.js)
3. Create loading states and error boundaries

### Phase 4: Optimization (1 Week)

1. Implement IndexedDB caching layer
2. Add bulk operation support
3. Configure performance monitoring

---

## Key Challenges & Solutions

1. **EPG Data Volume**

   - Problem: Individual EPG calls per channel cause performance issues[9]
   - Solution: Implement batch EPG endpoint detection with fallback
     ```typescript
     async function fetchEPG(playlist: Playlist, channelIds: string[]) {
     	try {
     		// Attempt batch endpoint
     		const res = await fetch(
     			`${playlist.server_url}/xmltv.php?username=${playlist.username}&password=${playlist.password}`
     		);
     		return parseXmltv(await res.text());
     	} catch {
     		// Fallback to individual requests
     		return Promise.all(channelIds.map((id) => fetch(API_ENDPOINTS.EPG_DATA(playlist, id))));
     	}
     }
     ```

2. **OPFS Browser Support**
   - Problem: Safari lacks complete OPFS implementation[8]
   - Solution: Feature detection with IndexedDB fallback
     ```typescript
     // Use IndexedDB for all browsers since sql.js doesn't support OPFS directly
     export class StorageService {
     	async init(): Promise<void> {
     		return new Promise((resolve, reject) => {
     			const request = indexedDB.open('blipty-storage', 1);
     			request.onerror = () => reject(request.error);
     			request.onsuccess = () => {
     				this.db = request.result;
     				resolve();
     			};
     		});
     	}
     }
     ```

---

## Monitoring & Maintenance

1. **Performance Metrics**

   ```typescript
   const perfMetrics = {
   	dbOperations: new PerformanceObserver((list) => {
   		list.getEntries().forEach((entry) => console.log(`DB ${entry.name}: ${entry.duration}ms`));
   	}),
   	apiCalls: new PerformanceObserver((list) => {
   		list.getEntries().forEach((entry) => console.log(`API ${entry.name}: ${entry.duration}ms`));
   	})
   };

   perfMetrics.dbOperations.observe({ entryTypes: ['measure'] });
   perfMetrics.apiCalls.observe({ entryTypes: ['resource'] });
   ```

2. **Automatic Schema Migration**

   ```sql
   CREATE TABLE IF NOT EXISTS schema_version (
     version INTEGER PRIMARY KEY,
     applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );

   -- Migration example
   CREATE TRIGGER IF NOT EXISTS migrate_v1 AFTER INSERT ON schema_version
   WHEN NEW.version = 1
   BEGIN
     ALTER TABLE channels ADD COLUMN is_favorite BOOLEAN DEFAULT 0;
   END;
   ```

---

## Recommended Development Practices

1. **Strict Type Safety**

   ```typescript
   interface XtreamChannel {
   	stream_id: number;
   	name: string;
   	stream_type: 'live' | 'vod';
   	category_id: string;
   	icon: string;
   	added?: string;
   	custom_sid?: string;
   	direct_source?: string;
   }

   function isLiveChannel(
   	channel: XtreamChannel
   ): channel is XtreamChannel & { stream_type: 'live' } {
   	return channel.stream_type === 'live';
   }
   ```

2. **Automated API Testing**

   ```typescript
   describe('Xtream API Client', () => {
   	const mockConfig = { baseUrl: 'https://test-xtream', username: 'test', password: 'test' };

   	test('Live categories endpoint', async () => {
   		const result = await fetchLiveCategories(mockConfig);
   		expect(result).toEqual(
   			expect.arrayContaining([
   				expect.objectContaining({
   					category_id: expect.any(String),
   					category_name: expect.any(String)
   				})
   			])
   		);
   	});
   });
   ```

---

## Deployment Configuration

### svelte.config.js

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ pages: 'build', assets: 'build', fallback: null, precompress: false }),
		prerender: { handleHttpError: 'warn' }
	}
};
```

---

## Future Enhancements

1. **Offline EPG Caching**

   - Implement background sync via Service Workers
   - Develop intelligent prefetching based on viewing patterns

2. **Cross-Device Sync**

   - Use WebRTC for direct device-to-device synchronization
   - Implement conflict resolution strategies

3. **Advanced Search**
   - Integrate SQLite FTS5 extension[2]
   - Develop hybrid client-side search index

This implementation plan combines modern web technologies with proven IPTV integration patterns, addressing both functional requirements and performance considerations identified in recent industry implementations[4][10]. The architecture allows for gradual enhancement while maintaining strict client-side operation constraints.

Citations:
[1] https://pub.dev/documentation/xtream_code_client/latest/
[2] https://github.com/subframe7536/sqlite-wasm
[3] https://pkg.go.dev/github.com/ze3ma0/yptv
[4] https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html
[5] https://stackoverflow.com/questions/78847811/how-to-build-a-playable-url-from-xtream-codes-api
[6] https://help.purpletv.app/how-to-login-with-xtream-api-code
[7] https://github.com/blacksmithgu/datacore/issues/6
[8] https://sqlite.org/wasm/doc/trunk/persistence.md
[9] https://www.inmatrix.com/blog/iptv_the_xtream_codes_saga_part_2.shtml
[10] https://www.reddit.com/r/programming/comments/1f325me/how_we_sped_up_notion_in_the_browser_with_wasm/
[11] https://www.reddit.com/r/TiviMate/comments/1anu7nw/how_do_i_extract_only_the_live_channels_from/
[12] https://github.com/AndreyPavlenko/Fermata/discussions/434
[13] https://github.com/engenex/xtream-codes-api-v2
[14] https://www.reddit.com/r/TVirl/comments/q51e2h/xtream_codes_support/
[15] https://www.pdffiller.com/102131882-whmcsmanualpdf-xtream-codes-api-documentation-
[16] https://www.powersync.com/blog/sqlite-persistence-on-the-web
[17] https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system
[18] https://news.ycombinator.com/item?id=40949489
[19] https://sqlite.org/wasm/doc/trunk/about.md
[20] https://github.com/chazlarson/py-xtream-codes/blob/master/xtream.py
[21] https://forum.rclone.org/t/rclone-xtream-codes-backend/41895
[22] https://lumendatabase.org/notices/49606846

---

Answer from Perplexity: pplx.ai/share
