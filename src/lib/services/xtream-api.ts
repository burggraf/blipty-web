import type { Provider } from '$lib/repositories/provider.repository';

export interface XtreamCategory {
    category_id: string;
    category_name: string;
    parent_id: number;
}

export interface XtreamChannel {
    stream_id: string;
    name: string;
    stream_icon: string;
    epg_channel_id: string;
    added: string;
    category_id: string;
    tv_archive: number;
    tv_archive_duration: number;
    direct_source: string;
    custom_sid: string;
    is_adult: string;
}

export class XtreamApiClient {
    constructor(private provider: Provider) {
        // Validate provider data
        if (!provider.server_url || !provider.username || !provider.password) {
            throw new Error('Invalid provider configuration: Missing required fields');
        }
    }

    private getApiUrl(action: string): string {
        const url = `${this.provider.server_url}/player_api.php?username=${this.provider.username}&password=${this.provider.password}&action=${action}`;
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