import { query, transaction } from '$lib/services/db';

export type CategoryType = 'live' | 'vod_movie' | 'vod_series';

export interface Category {
    id?: number;
    playlist_id: number;
    category_type: CategoryType;
    category_id: string;
    name: string;
}

export class CategoryRepository {
    async create(category: Category): Promise<number> {
        const result = await query<{ id: number }>(
            `INSERT INTO categories (playlist_id, category_type, category_id, name)
             VALUES (?, ?, ?, ?)
             RETURNING id`,
            [category.playlist_id, category.category_type, category.category_id, category.name]
        );
        return result[0].id;
    }

    async bulkCreate(categories: Category[]): Promise<void> {
        await transaction(async () => {
            for (const category of categories) {
                await query(
                    `INSERT OR IGNORE INTO categories (playlist_id, category_type, category_id, name)
                     VALUES (?, ?, ?, ?)`,
                    [category.playlist_id, category.category_type, category.category_id, category.name]
                );
            }
        });
    }

    async findByPlaylist(playlistId: number, type?: CategoryType): Promise<Category[]> {
        const sql = type
            ? 'SELECT * FROM categories WHERE playlist_id = ? AND category_type = ? ORDER BY name'
            : 'SELECT * FROM categories WHERE playlist_id = ? ORDER BY category_type, name';

        const params = type ? [playlistId, type] : [playlistId];
        return query<Category>(sql, params);
    }

    async findById(id: number): Promise<Category | null> {
        const results = await query<Category>(
            'SELECT * FROM categories WHERE id = ?',
            [id]
        );
        return results[0] || null;
    }

    async update(id: number, category: Partial<Category>): Promise<boolean> {
        const fields = Object.keys(category)
            .filter(key => key !== 'id')
            .map(key => `${key} = ?`);

        const values = fields.map(field => category[field.split(' ')[0]]);

        if (fields.length === 0) return false;

        await query(
            `UPDATE categories 
             SET ${fields.join(', ')}
             WHERE id = ?`,
            [...values, id]
        );

        return true;
    }

    async delete(id: number): Promise<boolean> {
        await transaction(async () => {
            await query('DELETE FROM epg_data WHERE channel_id IN (SELECT id FROM channels WHERE category_id = ?)', [id]);
            await query('DELETE FROM channels WHERE category_id = ?', [id]);
            await query('DELETE FROM categories WHERE id = ?', [id]);
        });
        return true;
    }
}