import type { Playlist } from '$lib/repositories/playlist.repository';

export interface XtreamCategory {
    category_id: string;
    category_name: string;
    parent_id: number;
}

export interface XtreamChannel {
    num: number;
    name: string;
    stream_type: string;
    stream_id: string;
    stream_icon: string;
    epg_channel_id: string;
    added: string;
    is_adult: string;
    category_id: string;
    custom_sid: string;
    tv_archive: number;
    direct_source: string;
    tv_archive_duration: number;
}

export class XtreamApiClient {
    constructor(private playlist: Playlist) {
        // Validate playlist data
        if (!playlist.server_url || !playlist.username || !playlist.password) {
            throw new Error('Invalid playlist configuration: Missing required fields');
        }
    }

    private getApiUrl(action: string): string {
        const url = `${this.playlist.server_url}/player_api.php?username=${this.playlist.username}&password=${this.playlist.password}&action=${action}`;
        console.debug('Xtream API request:', url);
        return url;
    }

    private async fetchJson<T>(url: string): Promise<T> {
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            console.error('Xtream API error:', {
                status: response.status,
                statusText: response.statusText,
                url: url.replace(/password=([^&]+)/, 'password=***'),
                response: text
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json() as Promise<T>;
    }

    async getLiveCategories(): Promise<XtreamCategory[]> {
        return this.fetchJson<XtreamCategory[]>(this.getApiUrl('get_live_categories'));
    }

    async getAllLiveStreams(): Promise<XtreamChannel[]> {
        return this.fetchJson<XtreamChannel[]>(this.getApiUrl('get_live_streams'));
    }

    async getVodCategories(): Promise<XtreamCategory[]> {
        return this.fetchJson<XtreamCategory[]>(this.getApiUrl('get_vod_categories'));
    }

    async getAllVodStreams(): Promise<XtreamChannel[]> {
        return this.fetchJson<XtreamChannel[]>(this.getApiUrl('get_vod_streams'));
    }

    async getSeriesCategories(): Promise<XtreamCategory[]> {
        return this.fetchJson<XtreamCategory[]>(this.getApiUrl('get_series_categories'));
    }

    async getShortEpg(streamId: string): Promise<any> {
        return this.fetchJson(this.getApiUrl('get_short_epg') + `&stream_id=${streamId}&limit=500`);
    }
}