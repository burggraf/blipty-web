<script lang="ts">
	import { PlaylistRepository } from '$lib/repositories/playlist.repository';
	import AddPlaylistForm from '$lib/components/AddPlaylistForm.svelte';
	import type { Playlist } from '$lib/repositories/playlist.repository';
	import { Button } from '$lib/components/ui/button';
	import PlusCircle from 'lucide-svelte/icons/plus-circle';
	import RotateCw from 'lucide-svelte/icons/rotate-cw';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { cn } from '$lib/utils';
	import * as Dialog from '$lib/components/ui/dialog';

	const playlistRepo = new PlaylistRepository();
	let playlists: Playlist[] = [];
	let loading = true;
	let syncing: number | null = null;
	let deleting: number | null = null;
	let error: string | null = null;
	let showAddPlaylistDialog = false;

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
			await loadPlaylists();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sync playlist';
			console.error('Failed to sync playlist:', err);
		} finally {
			syncing = null;
		}
	}

	async function deletePlaylist(id: number) {
		if (deleting !== null) return;
		error = null;
		deleting = id;
		try {
			await playlistRepo.delete(id);
			await loadPlaylists();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete playlist';
			console.error('Failed to delete playlist:', err);
		} finally {
			deleting = null;
		}
	}

	function handlePlaylistCreated() {
		loadPlaylists();
		showAddPlaylistDialog = false;
	}

	// Initialize on client side
	if (typeof window !== 'undefined') {
		loadPlaylists();
		window.addEventListener('playlist:created', handlePlaylistCreated);
	}
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
			<div class="flex items-center justify-between">
				<h1 class="text-2xl font-semibold tracking-tight">Your Playlists</h1>
				<Button onclick={() => (showAddPlaylistDialog = true)}>
					<PlusCircle class="mr-2 h-4 w-4" />
					Add Playlist
				</Button>
			</div>

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
							<div class="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									disabled={syncing !== null}
									onclick={() => playlist.id && syncPlaylist(playlist.id)}
								>
									<RotateCw class={cn('h-4 w-4', syncing === playlist.id && 'animate-spin')} />
									<span class="sr-only">Sync {playlist.name}</span>
								</Button>
								<Button
									variant="ghost"
									size="sm"
									disabled={deleting !== null}
									onclick={() => playlist.id && deletePlaylist(playlist.id)}
								>
									<Trash2 class={cn('h-4 w-4', deleting === playlist.id && 'text-destructive')} />
									<span class="sr-only">Delete {playlist.name}</span>
								</Button>
							</div>
						</div>
						<p class="text-sm text-muted-foreground">{playlist.server_url}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<Dialog.Root bind:open={showAddPlaylistDialog}>
	<Dialog.Content class="max-w-md">
		<AddPlaylistForm />
	</Dialog.Content>
</Dialog.Root>
