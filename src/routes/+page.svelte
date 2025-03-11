<script lang="ts">
	import { PlaylistRepository } from '$lib/repositories/playlist.repository';
	import AddPlaylistForm from '$lib/components/AddPlaylistForm.svelte';
	import type { Playlist } from '$lib/repositories/playlist.repository';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	const playlistRepo = new PlaylistRepository();
	let playlists = $state<Playlist[]>([]);
	let loading = $state(true);
	let syncing = $state<number | null>(null);
	let error = $state<string | null>(null);

	async function loadPlaylists() {
		error = null;
		try {
			playlists = await playlistRepo.findAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load playlists';
			console.error('Failed to load playlists:', err);
		} finally {
			loading = false;
		}
	}

	async function syncPlaylist(id: number) {
		if (syncing !== null) return;
		error = null;
		syncing = id;
		try {
			await playlistRepo.sync(id);
			// Reload playlists after sync
			await loadPlaylists();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sync playlist';
			console.error('Failed to sync playlist:', err);
		} finally {
			syncing = null;
		}
	}

	function handlePlaylistCreated() {
		loadPlaylists();
	}

	$effect(() => {
		if (browser) {
			loadPlaylists();
			window.addEventListener('playlist:created', handlePlaylistCreated);
			return () => {
				window.removeEventListener('playlist:created', handlePlaylistCreated);
			};
		}
	});
</script>

{#if loading}
	<div class="flex h-[70vh] items-center justify-center">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{:else if playlists.length === 0}
	<AddPlaylistForm />
{:else}
	<div class="container py-6">
		<div class="flex flex-col gap-4">
			<h1 class="text-2xl font-semibold tracking-tight">Your Playlists</h1>

			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each playlists as playlist (playlist.id)}
					<div class="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">{playlist.name}</h2>
							<Button
								variant="ghost"
								size="sm"
								disabled={syncing !== null}
								onclick={() => playlist.id && syncPlaylist(playlist.id)}
							>
								<RefreshCw class={cn('h-4 w-4', syncing === playlist.id && 'animate-spin')} />
								<span class="sr-only">Sync {playlist.name}</span>
							</Button>
						</div>
						<p class="text-sm text-muted-foreground">{playlist.server_url}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
