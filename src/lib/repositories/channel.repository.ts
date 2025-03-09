import { query, transaction, startDbOperation, endDbOperation } from '$lib/services/db';

export interface Channel {
    id?: number;
    category_id: number;
    stream_id: string;
    name: string;
    icon_url?: string;
    metadata?: Record<string, any>;
}

export interface EPGEntry {
    channel_id: number;
    start: string;
    end: string;
    title: string;
    description?: string;
}

export class ChannelRepository {
    async create(channel: Channel): Promise<number> {
        const result = await query<{ id: number }>(
            `INSERT INTO channels (category_id, stream_id, name, icon_url, metadata)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id`,
            [
                channel.category_id,
                channel.stream_id,
                channel.name,
                channel.icon_url,
                channel.metadata ? JSON.stringify(channel.metadata) : null
            ]
        );
        return result[0].id;
    }

    async bulkCreate(channels: Channel[]): Promise<void> {
        startDbOperation('bulkCreateChannels');
        await transaction(async () => {
            for (const channel of channels) {
                await query(
                    `INSERT OR IGNORE INTO channels (category_id, stream_id, name, icon_url, metadata)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        channel.category_id,
                        channel.stream_id,
                        channel.name,
                        channel.icon_url,
                        channel.metadata ? JSON.stringify(channel.metadata) : null
                    ]
                );
            }
        });
        endDbOperation('bulkCreateChannels');
    }

    async findByCategory(categoryId: number): Promise<Channel[]> {
        return query<Channel>(
            'SELECT * FROM channels WHERE category_id = ? ORDER BY name',
            [categoryId]
        );
    }

    async findById(id: number): Promise<Channel | null> {
        const results = await query<Channel>(
            'SELECT * FROM channels WHERE id = ?',
            [id]
        );
        return results[0] || null;
    }

    async update(id: number, channel: Partial<Channel>): Promise<boolean> {
        const fields = Object.keys(channel)
            .filter(key => key !== 'id')
            .map(key => `${key} = ?`);

        const values = fields.map(field => {
            const value = channel[field.split(' ')[0]];
            return field === 'metadata' ? JSON.stringify(value) : value;
        });

        if (fields.length === 0) return false;

        await query(
            `UPDATE channels 
             SET ${fields.join(', ')}
             WHERE id = ?`,
            [...values, id]
        );

        return true;
    }

    async delete(id: number): Promise<boolean> {
        await transaction(async () => {
            await query('DELETE FROM epg_data WHERE channel_id = ?', [id]);
            await query('DELETE FROM channels WHERE id = ?', [id]);
        });
        return true;
    }

    // EPG Data Management
    async updateEPG(entries: EPGEntry[]): Promise<void> {
        startDbOperation('updateEPG');
        await transaction(async () => {
            for (const entry of entries) {
                await query(
                    `INSERT OR REPLACE INTO epg_data (channel_id, start, end, title, description)
                     VALUES (?, ?, ?, ?, ?)`,
                    [entry.channel_id, entry.start, entry.end, entry.title, entry.description]
                );
            }
        });
        endDbOperation('updateEPG');
    }

    async getEPG(channelId: number, from: Date, to: Date): Promise<EPGEntry[]> {
        return query<EPGEntry>(
            `SELECT * FROM epg_data 
             WHERE channel_id = ? 
             AND start >= ? 
             AND end <= ?
             ORDER BY start`,
            [channelId, from.toISOString(), to.toISOString()]
        );
    }

    async getCurrentEPG(channelId: number): Promise<EPGEntry | null> {
        const now = new Date().toISOString();
        const results = await query<EPGEntry>(
            `SELECT * FROM epg_data 
             WHERE channel_id = ? 
             AND start <= ? 
             AND end >= ?
             LIMIT 1`,
            [channelId, now, now]
        );
        return results[0] || null;
    }

    async cleanupOldEPG(beforeDate: Date): Promise<void> {
        await query(
            'DELETE FROM epg_data WHERE end < ?',
            [beforeDate.toISOString()]
        );
    }
}