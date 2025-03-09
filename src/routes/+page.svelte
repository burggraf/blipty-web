<script lang="ts">
	import { PlaylistRepository } from '$lib/repositories/playlist.repository';
	import AddPlaylistForm from '$lib/components/AddPlaylistForm.svelte';
	import type { Playlist } from '$lib/repositories/playlist.repository';
	import { browser } from '$app/environment';

	const playlistRepo = new PlaylistRepository();
	let playlists = $state<Playlist[]>([]);
	let loading = $state(true);

	async function loadPlaylists() {
		try {
			playlists = await playlistRepo.findAll();
		} finally {
			loading = false;
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
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each playlists as playlist (playlist.id)}
				<div class="rounded-lg border bg-card p-4 shadow-sm">
					<h2 class="text-lg font-semibold">{playlist.name}</h2>
					<p class="text-sm text-muted-foreground">{playlist.server_url}</p>
				</div>
			{/each}
		</div>
	</div>
{/if}
