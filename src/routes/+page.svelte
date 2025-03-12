<script lang="ts">
	import { ProviderRepository } from '$lib/repositories/provider.repository';
	import AddProviderForm from '$lib/components/AddProviderForm.svelte';
	import type { Provider } from '$lib/repositories/provider.repository';
	import { Button } from '$lib/components/ui/button';
	import PlusCircle from 'lucide-svelte/icons/plus-circle';
	import RotateCw from 'lucide-svelte/icons/rotate-cw';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { cn } from '$lib/utils';
	import * as Dialog from '$lib/components/ui/dialog';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';

	const providerRepo = new ProviderRepository();
	let providers: Provider[] = [];
	let loading = true;
	let syncing: number | null = null;
	let deleting: number | null = null;
	let error: string | null = null;
	let showAddProviderDialog = false;
	let selectedChannel: { id: number; name: string; stream_id: string; provider_id: number } | null =
		null;
	let selectedChannelUrl: string = '';

	async function loadProviders() {
		error = null;
		try {
			providers = await providerRepo.findAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load providers';
			console.error('Failed to load providers:', err);
		} finally {
			loading = false;
		}
	}

	async function syncProvider(id: number) {
		if (syncing !== null) return;
		error = null;
		syncing = id;
		try {
			await providerRepo.sync(id);
			await loadProviders();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sync provider';
			console.error('Failed to sync provider:', err);
		} finally {
			syncing = null;
		}
	}

	async function deleteProvider(id: number) {
		if (deleting !== null) return;
		error = null;
		deleting = id;
		try {
			await providerRepo.delete(id);
			await loadProviders();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete provider';
			console.error('Failed to delete provider:', err);
		} finally {
			deleting = null;
		}
	}

	async function selectChannel(channel: {
		id: number;
		name: string;
		stream_id: string;
		provider_id: number;
	}) {
		selectedChannel = channel;
		const provider = await providerRepo.findById(channel.provider_id);
		console.log('>>>provider', provider);
		if (provider) {
			selectedChannelUrl = `${provider.server_url}/live/${provider.username}/${provider.password}/${channel.stream_id}.ts`;
			console.log('selectedChannelUrl', selectedChannelUrl);
		}
	}

	function handleProviderCreated() {
		loadProviders();
		showAddProviderDialog = false;
	}

	// Initialize on client side
	if (typeof window !== 'undefined') {
		loadProviders();
		window.addEventListener('provider:created', handleProviderCreated);
	}

	$effect(() => {
		const handleChannelSelected = (event: CustomEvent) => {
			console.log('>>>handleChannelSelected:', event.detail);
			selectChannel(event.detail);
		};
		window.addEventListener('channel:selected', handleChannelSelected as EventListener);
		return () =>
			window.removeEventListener('channel:selected', handleChannelSelected as EventListener);
	});
</script>

{#if loading}
	<div class="flex h-[70vh] items-center justify-center">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{:else if providers.length === 0}
	<AddProviderForm />
{:else}
	<div class="container py-6">
		<div class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<h1 class="text-2xl font-semibold tracking-tight">Your Providers</h1>
				<Button onclick={() => (showAddProviderDialog = true)}>
					<PlusCircle class="mr-2 h-4 w-4" />
					Add Provider
				</Button>
			</div>

			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each providers as provider (provider.id)}
					<div class="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">{provider.name}</h2>
							<div class="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									disabled={syncing !== null}
									onclick={() => provider.id && syncProvider(provider.id)}
								>
									<RotateCw class={cn('h-4 w-4', syncing === provider.id && 'animate-spin')} />
									<span class="sr-only">Sync {provider.name}</span>
								</Button>
								<Button
									variant="ghost"
									size="sm"
									disabled={deleting !== null}
									onclick={() => provider.id && deleteProvider(provider.id)}
								>
									<Trash2 class={cn('h-4 w-4', deleting === provider.id && 'text-destructive')} />
									<span class="sr-only">Delete {provider.name}</span>
								</Button>
							</div>
						</div>
						<p class="text-sm text-muted-foreground">{provider.server_url}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
	<VideoPlayer src={selectedChannelUrl} channelName={selectedChannel?.name ?? ''} />
{/if}

<Dialog.Root bind:open={showAddProviderDialog}>
	<Dialog.Content class="max-w-md">
		<AddProviderForm />
	</Dialog.Content>
</Dialog.Root>
