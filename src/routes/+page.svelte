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
		loading = true;
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
				{#if error}
					<Wrapper class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
						{error}
					</Wrapper>
				{:else}
					<VideoPlayer
						id="vp"
						src={selectedChannelUrl}
						channelId={selectedChannel?.id}
						providerId={selectedChannel?.provider_id}
						streamId={selectedChannel?.stream_id}
					/>
				{/if}
			</Wrapper>
		</Wrapper>
	{/if}
</Wrapper>
