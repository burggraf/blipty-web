<script lang="ts">
	import { ProviderRepository } from '$lib/repositories/provider.repository';
	import AddProviderForm from '$lib/components/AddProviderForm.svelte';
	import type { Provider } from '$lib/repositories/provider.repository';
	import { Button } from '$lib/components/ui/button';
	import RotateCw from 'lucide-svelte/icons/rotate-cw';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { cn } from '$lib/utils';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import Wrapper from '$lib/components/Wrapper.svelte';

	const providerRepo = new ProviderRepository();
	let providers = $state<Provider[]>([]);
	let loading = $state(true);
	let syncing = $state<number | null>(null);
	let deleting = $state<number | null>(null);
	let error = $state<string | null>(null);
	let selectedChannel = $state<{
		id: number;
		name: string;
		stream_id: string;
		provider_id: number;
	} | null>(null);
	let selectedChannelUrl = $state('');

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
			const vp: any = document.getElementsByName('VideoPlayer');
			if (vp) {
				console.log('vp.src 1:', vp.src);
				vp.src = selectedChannelUrl;
				console.log('vp.src 2:', vp.src);
			} else {
				console.log('vp not found');
			}
			console.log('selectedChannelUrl', selectedChannelUrl);
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			loadProviders();
			const handleProviderCreated = () => {
				loadProviders();
			};
			window.addEventListener('provider:created', handleProviderCreated);
			return () => window.removeEventListener('provider:created', handleProviderCreated);
		}
	});

	$effect(() => {
		const handleChannelSelected = (event: CustomEvent) => {
			selectChannel(event.detail);
		};
		window.addEventListener('channel:selected', handleChannelSelected as EventListener);
		return () =>
			window.removeEventListener('channel:selected', handleChannelSelected as EventListener);
	});
</script>

<Wrapper class="flex h-[70vh] items-center justify-center">
	{#if loading}
		<Wrapper class="text-muted-foreground">Loading...</Wrapper>
	{:else if providers.length === 0}
		<AddProviderForm />
	{:else}
		<Wrapper class="container py-6">
			<Wrapper class="flex flex-col gap-4">
				<Wrapper class="flex items-center justify-between">
					<Wrapper tag="h1" class="text-2xl font-semibold tracking-tight">Your Providers</Wrapper>
				</Wrapper>

				{#if error}
					<Wrapper class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
						{error}
					</Wrapper>
				{/if}

				<Wrapper class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each providers as provider (provider.id)}
						<Wrapper class="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
							<Wrapper class="flex items-center justify-between">
								<Wrapper tag="h2" class="text-lg font-semibold">{provider.name}</Wrapper>
								<Wrapper class="flex gap-2">
									<Button
										variant="ghost"
										size="sm"
										disabled={syncing !== null}
										onclick={() => provider.id && syncProvider(provider.id)}
									>
										<RotateCw class={cn('h-4 w-4', syncing === provider.id && 'animate-spin')} />
										<Wrapper tag="span" class="sr-only">Sync {provider.name}</Wrapper>
									</Button>
									<Button
										variant="ghost"
										size="sm"
										disabled={deleting !== null}
										onclick={() => provider.id && deleteProvider(provider.id)}
									>
										<Trash2 class={cn('h-4 w-4', deleting === provider.id && 'text-destructive')} />
										<Wrapper tag="span" class="sr-only">Delete {provider.name}</Wrapper>
									</Button>
								</Wrapper>
							</Wrapper>
							<Wrapper tag="p" class="text-sm text-muted-foreground">{provider.server_url}</Wrapper>
						</Wrapper>
					{/each}
				</Wrapper>
			</Wrapper>
		</Wrapper>
		<VideoPlayer id="vp" src={selectedChannelUrl} channelName={selectedChannel?.name ?? ''} />
		<br />selectedChannelUrl: {selectedChannelUrl}
	{/if}
</Wrapper>
