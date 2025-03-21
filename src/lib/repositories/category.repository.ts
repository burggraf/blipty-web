import { query, transaction } from '$lib/services/db';

export type CategoryType = 'live' | 'vod_movie' | 'vod_series';

export interface Category {
    id?: number;
    provider_id: number;
    category_type: CategoryType;
    category_id: string;
    name: string;
}

export class CategoryRepository {
    private static BATCH_SIZE = 500;

    async create(category: Category): Promise<number> {
        const result = await query<{ id: number }>(
            `INSERT INTO categories (provider_id, category_type, category_id, name)
             VALUES (?, ?, ?, ?)
             RETURNING id`,
            [category.provider_id, category.category_type, category.category_id, category.name]
        );
        return result[0].id;
    }

    async bulkCreate(categories: Category[]): Promise<void> {
        // Process categories in batches
        for (let i = 0; i < categories.length; i += CategoryRepository.BATCH_SIZE) {
            const batch = categories.slice(i, i + CategoryRepository.BATCH_SIZE);

            // Create parameterized values string for the batch
            const values = batch.map(() => '(?, ?, ?, ?)').join(',');

            // Flatten parameters array
            const params = batch.flatMap(category => [
                category.provider_id,
                category.category_type,
                category.category_id,
                category.name
            ]);

            await query(
                `INSERT OR IGNORE INTO categories (provider_id, category_type, category_id, name)
                 VALUES ${values}`,
                params
            );
        }
    }

    async findByProvider(providerId: number, type?: CategoryType): Promise<Category[]> {
        const sql = type
            ? 'SELECT * FROM categories WHERE provider_id = ? AND category_type = ? ORDER BY name'
            : 'SELECT * FROM categories WHERE provider_id = ? ORDER BY category_type, name';

        const params = type ? [providerId, type] : [providerId];
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

        const values = fields.map(field => {
            const key = field.split(' ')[0] as keyof Category;
            return category[key];
        });

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

    async getCategoryTypeStats(providerId: number): Promise<{ category_type: CategoryType; count: number }[]> {
        return query<{ category_type: CategoryType; count: number }>(
            'SELECT category_type, COUNT(*) as count FROM categories WHERE provider_id = ? GROUP BY category_type',
            [providerId]
        );
    }

    async getCategoriesByType(providerId: number, categoryType: CategoryType): Promise<{ category_id: number; name: string; channel_count: number }[]> {
        return query<{ category_id: number; name: string; channel_count: number }>(
            `SELECT 
                c.id as category_id, 
                c.name,
                COUNT(ch.id) as channel_count
             FROM categories c
             LEFT JOIN channels ch ON ch.category_id = c.id
             WHERE c.provider_id = ? AND c.category_type = ?
             GROUP BY c.id, c.name
             ORDER BY c.name`,
            [providerId, categoryType]
        );
    }

    // New method to get favorite channels by content type
    async getFavoriteChannelsByType(providerId: number, categoryType: CategoryType): Promise<{
        id: number;
        category_id: number;
        provider_id: number;
        stream_id: string;
        name: string;
        icon_url?: string;
        metadata?: Record<string, any>;
    }[]> {
        return query(
            `SELECT ch.* 
             FROM channels ch
             JOIN categories cat ON ch.category_id = cat.id
             JOIN channelinfo ci ON ci.provider_id = ch.provider_id AND ci.stream_id = ch.stream_id
             WHERE cat.provider_id = ? 
               AND cat.category_type = ? 
               AND ci.favorite = 1
             ORDER BY ch.name`,
            [providerId, categoryType]
        );
    }
}