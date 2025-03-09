import { query, transaction } from '$lib/services/db';

export interface Playlist {
    id?: number;
    name: string;
    server_url: string;
    username: string;
    password: string;
    created_at?: string;
}

export class PlaylistRepository {
    async create(playlist: Playlist): Promise<number> {
        const result = await query<{ id: number }>(
            `INSERT INTO playlists (name, server_url, username, password)
             VALUES (?, ?, ?, ?)
             RETURNING id`,
            [playlist.name, playlist.server_url, playlist.username, playlist.password]
        );
        return result[0].id;
    }

    async findAll(): Promise<Playlist[]> {
        return query<Playlist>('SELECT * FROM playlists ORDER BY created_at DESC');
    }

    async findById(id: number): Promise<Playlist | null> {
        const results = await query<Playlist>(
            'SELECT * FROM playlists WHERE id = ?',
            [id]
        );
        return results[0] || null;
    }

    async update(id: number, playlist: Partial<Playlist>): Promise<boolean> {
        const fields = Object.keys(playlist)
            .filter(key => key !== 'id' && key !== 'created_at')
            .map(key => `${key} = ?`);

        const values = fields.map(field => playlist[field.split(' ')[0]]);

        if (fields.length === 0) return false;

        const result = await query(
            `UPDATE playlists 
             SET ${fields.join(', ')}
             WHERE id = ?`,
            [...values, id]
        );

        return true;
    }

    async delete(id: number): Promise<boolean> {
        await transaction(async () => {
            // Delete related data first
            await query('DELETE FROM epg_data WHERE channel_id IN (SELECT id FROM channels WHERE category_id IN (SELECT id FROM categories WHERE playlist_id = ?))', [id]);
            await query('DELETE FROM channels WHERE category_id IN (SELECT id FROM categories WHERE playlist_id = ?)', [id]);
            await query('DELETE FROM categories WHERE playlist_id = ?', [id]);
            await query('DELETE FROM playlists WHERE id = ?', [id]);
        });
        return true;
    }
}