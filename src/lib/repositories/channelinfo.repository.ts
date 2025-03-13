import { query, transaction } from '$lib/services/db';

export interface ChannelInfo {
    id?: number;
    provider_id: number;
    stream_id: string;
    favorite: boolean;
    hidden: boolean;
    restricted: boolean;
    height?: number | null;
    width?: number | null;
    status?: string | null;
    last_watched?: Date | null;
    metadata?: Record<string, any> | null;
}

export class ChannelInfoRepository {
    async findById(id: number): Promise<ChannelInfo | null> {
        const results = await query<ChannelInfo>(
            'SELECT * FROM channelinfo WHERE id = ?',
            [id]
        );

        return results.length > 0 ? this.mapChannelInfo(results[0]) : null;
    }

    async findByStreamId(providerId: number, streamId: string): Promise<ChannelInfo | null> {
        const results = await query<ChannelInfo>(
            'SELECT * FROM channelinfo WHERE provider_id = ? AND stream_id = ?',
            [providerId, streamId]
        );

        return results.length > 0 ? this.mapChannelInfo(results[0]) : null;
    }

    async create(channelInfo: ChannelInfo): Promise<ChannelInfo> {
        const { id, ...data } = channelInfo;

        const metadataStr = data.metadata ? JSON.stringify(data.metadata) : null;
        const lastWatched = data.last_watched ? data.last_watched.toISOString() : null;

        const result = await query<{ id: number }>(
            `INSERT INTO channelinfo 
             (provider_id, stream_id, favorite, hidden, restricted, height, width, status, last_watched, metadata) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
             RETURNING id`,
            [
                data.provider_id,
                data.stream_id,
                data.favorite ? 1 : 0,
                data.hidden ? 1 : 0,
                data.restricted ? 1 : 0,
                data.height || null,
                data.width || null,
                data.status || null,
                lastWatched,
                metadataStr
            ]
        );

        return this.findById(result[0].id);
    }

    async update(channelInfo: ChannelInfo): Promise<ChannelInfo> {
        if (!channelInfo.id) {
            throw new Error("Cannot update channelinfo without id");
        }

        const metadataStr = channelInfo.metadata ? JSON.stringify(channelInfo.metadata) : null;
        const lastWatched = channelInfo.last_watched ? channelInfo.last_watched.toISOString() : null;

        await query(
            `UPDATE channelinfo 
             SET provider_id = ?, stream_id = ?, favorite = ?, hidden = ?, restricted = ?, height = ?, 
                 width = ?, status = ?, last_watched = ?, metadata = ?
             WHERE id = ?`,
            [
                channelInfo.provider_id,
                channelInfo.stream_id,
                channelInfo.favorite ? 1 : 0,
                channelInfo.hidden ? 1 : 0,
                channelInfo.restricted ? 1 : 0,
                channelInfo.height || null,
                channelInfo.width || null,
                channelInfo.status || null,
                lastWatched,
                metadataStr,
                channelInfo.id
            ]
        );

        return this.findById(channelInfo.id);
    }

    async upsert(channelInfo: Omit<ChannelInfo, 'id'>): Promise<ChannelInfo> {
        return await transaction(async () => {
            const existing = await this.findByStreamId(channelInfo.provider_id, channelInfo.stream_id);

            if (existing) {
                return this.update({
                    ...existing,
                    ...channelInfo,
                    id: existing.id
                });
            } else {
                return this.create(channelInfo as ChannelInfo);
            }
        });
    }

    async delete(id: number): Promise<void> {
        await query('DELETE FROM channelinfo WHERE id = ?', [id]);
    }

    async findFavorites(providerId?: number): Promise<ChannelInfo[]> {
        const sql = providerId
            ? 'SELECT * FROM channelinfo WHERE favorite = 1 AND provider_id = ?'
            : 'SELECT * FROM channelinfo WHERE favorite = 1';

        const params = providerId ? [providerId] : [];
        const results = await query<ChannelInfo>(sql, params);

        return results.map(info => this.mapChannelInfo(info));
    }

    async updateLastWatched(providerId: number, streamId: string, timestamp?: Date): Promise<void> {
        const lastWatched = timestamp ? timestamp.toISOString() : new Date().toISOString();

        await query(
            `INSERT INTO channelinfo (provider_id, stream_id, favorite, hidden, restricted, last_watched)
             VALUES (?, ?, 0, 0, 0, ?)
             ON CONFLICT (provider_id, stream_id) DO UPDATE 
             SET last_watched = ?`,
            [providerId, streamId, lastWatched, lastWatched]
        );
    }

    async toggleFavorite(providerId: number, streamId: string): Promise<boolean> {
        const info = await this.findByStreamId(providerId, streamId);

        if (info) {
            const newState = !info.favorite;
            await query(
                'UPDATE channelinfo SET favorite = ? WHERE id = ?',
                [newState ? 1 : 0, info.id]
            );
            return newState;
        } else {
            // Create a new record with favorite set to true
            await this.create({
                provider_id: providerId,
                stream_id: streamId,
                favorite: true,
                hidden: false,
                restricted: false
            });
            return true;
        }
    }

    private mapChannelInfo(raw: any): ChannelInfo {
        return {
            id: raw.id,
            provider_id: raw.provider_id,
            stream_id: raw.stream_id,
            favorite: Boolean(raw.favorite),
            hidden: Boolean(raw.hidden),
            restricted: Boolean(raw.restricted),
            height: raw.height,
            width: raw.width,
            status: raw.status,
            last_watched: raw.last_watched ? new Date(raw.last_watched) : null,
            metadata: raw.metadata ? JSON.parse(raw.metadata) : null
        };
    }
}

// Export a singleton instance
export const channelInfoRepository = new ChannelInfoRepository();