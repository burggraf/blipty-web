import { query, transaction, startDbOperation, endDbOperation } from '$lib/services/db';
import { XtreamApiClient, type XtreamCategory, type XtreamChannel } from '$lib/services/xtream-api';
import { CategoryRepository } from './category.repository';
import { ChannelRepository } from './channel.repository';

export interface Playlist {
    id?: number;
    name: string;
    server_url: string;
    username: string;
    password: string;
    created_at?: string;
}

export class PlaylistRepository {
    private categoryRepo = new CategoryRepository();
    private channelRepo = new ChannelRepository();

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
            'SELECT id, name, server_url, username, password, created_at FROM playlists WHERE id = ?',
            [id]
        );
        return results[0] || null;
    }

    async update(id: number, playlist: Partial<Playlist>): Promise<boolean> {
        const fields = Object.keys(playlist)
            .filter(key => key !== 'id' && key !== 'created_at')
            .map(key => `${key} = ?`);

        const values = fields.map(field => {
            const key = field.split(' ')[0] as keyof Playlist;
            return playlist[key];
        });

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

    async sync(playlistId: number): Promise<void> {
        const playlist = await this.findById(playlistId);
        if (!playlist) throw new Error('Playlist not found');

        const api = new XtreamApiClient(playlist);
        startDbOperation('syncPlaylist');

        try {
            await transaction(async () => {
                // Delete existing data for this playlist
                await query('DELETE FROM epg_data WHERE channel_id IN (SELECT id FROM channels WHERE category_id IN (SELECT id FROM categories WHERE playlist_id = ?))', [playlistId]);
                await query('DELETE FROM channels WHERE category_id IN (SELECT id FROM categories WHERE playlist_id = ?)', [playlistId]);
                await query('DELETE FROM categories WHERE playlist_id = ?', [playlistId]);

                // Sync live content
                const liveCategories = await api.getLiveCategories();
                await this.syncCategories(playlist.id!, 'live', liveCategories);
                await this.syncChannels(api, playlist.id!, 'live', liveCategories);

                // Sync VOD content
                const vodCategories = await api.getVodCategories();
                await this.syncCategories(playlist.id!, 'vod_movie', vodCategories);
                await this.syncChannels(api, playlist.id!, 'vod_movie', vodCategories);

                // Sync Series content
                const seriesCategories = await api.getSeriesCategories();
                await this.syncCategories(playlist.id!, 'vod_series', seriesCategories);
                // Series content requires special handling due to seasons/episodes
                // TODO: Implement series content sync
            });
        } finally {
            endDbOperation('syncPlaylist');
        }
    }

    private async syncCategories(
        playlistId: number,
        type: 'live' | 'vod_movie' | 'vod_series',
        categories: XtreamCategory[]
    ): Promise<void> {
        const categoriesToCreate = categories.map(cat => ({
            playlist_id: playlistId,
            category_type: type,
            category_id: cat.category_id,
            name: cat.category_name
        }));

        await this.categoryRepo.bulkCreate(categoriesToCreate);
    }

    private async syncChannels(
        api: XtreamApiClient,
        playlistId: number,
        type: 'live' | 'vod_movie' | 'vod_series',
        categories: XtreamCategory[]
    ): Promise<void> {
        // Get all streams at once
        const allStreams = type === 'live'
            ? await api.getAllLiveStreams()
            : await api.getAllVodStreams();

        const allChannelsToCreate = [];
        const categoryMap = new Map(categories.map(c => [c.category_id, c]));

        // Find corresponding local category IDs
        const localCategories = await query<{ id: number, category_id: string }>(
            'SELECT id, category_id FROM categories WHERE playlist_id = ? AND category_type = ?',
            [playlistId, type]
        );
        const categoryIdMap = new Map(localCategories.map(c => [c.category_id, c.id]));

        // Filter and map streams by their categories
        for (const stream of allStreams) {
            const localCategoryId = categoryIdMap.get(stream.category_id);
            if (!localCategoryId) continue;

            allChannelsToCreate.push({
                category_id: localCategoryId,
                stream_id: stream.stream_id,
                name: stream.name,
                icon_url: stream.stream_icon,
                metadata: {
                    epg_channel_id: stream.epg_channel_id,
                    added: stream.added,
                    tv_archive: stream.tv_archive,
                    tv_archive_duration: stream.tv_archive_duration,
                    direct_source: stream.direct_source,
                    custom_sid: stream.custom_sid,
                    is_adult: stream.is_adult === '1'
                }
            });
        }

        // Bulk insert all channels at once
        await this.channelRepo.bulkCreate(allChannelsToCreate);
    }
}