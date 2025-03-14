<script lang="ts" context="module">
	// Add the global method type to window
	declare global {
		interface Window {
			openChannelDetails: (channel: any, providerId: number) => void;
		}
	}
</script>

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Heart } from 'lucide-svelte';
	import { ChannelInfoRepository } from '$lib/repositories/channelinfo.repository';
	import type { Channel } from '$lib/repositories/channel.repository';

	// Dialog state
	let isOpen = $state(false);
	let currentChannel: Channel | null = $state(null);
	let currentProviderId: number | null = $state(null);
	let channelInfoRepo = new ChannelInfoRepository();
	let channelInfo: any = $state(null);
	let metadata: Record<string, any> = $state({});
	let isLoading = $state(false);
	let errorMessage: string | null = $state(null);

	// Global method to open the dialog
	window.openChannelDetails = (channel: Channel, providerId: number) => {
		console.log(
			`Opening channel details for: ${channel.name} (${providerId}:${channel.stream_id})`
		);
		currentChannel = channel;
		currentProviderId = providerId;
		isOpen = true;
		isLoading = true;
		channelInfo = null;
		metadata = {};
		errorMessage = null;

		if (channel && providerId) {
			loadChannelInfo(providerId, channel.stream_id);
		}
	};

	async function loadChannelInfo(providerId: number, streamId: string) {
		try {
			console.log(`Fetching channel info from repository...`);
			channelInfo = await channelInfoRepo.findByStreamId(providerId, streamId);
			console.log('Channel info loaded:', channelInfo);

			if (channelInfo?.metadata) {
				try {
					metadata =
						typeof channelInfo.metadata === 'string'
							? JSON.parse(channelInfo.metadata)
							: channelInfo.metadata;
					console.log('Metadata parsed:', metadata);
				} catch (e) {
					console.error('Error parsing channel metadata:', e);
					metadata = {};
					errorMessage = 'Failed to parse metadata';
				}
			} else {
				console.log('No metadata available');
				metadata = {};
			}
		} catch (e) {
			console.error('Error loading channel info:', e);
			errorMessage = 'Failed to load channel information';
		} finally {
			isLoading = false;
		}
	}

	async function toggleFavorite() {
		if (!currentProviderId || !currentChannel) return;

		try {
			const newState = await channelInfoRepo.toggleFavorite(
				currentProviderId,
				currentChannel.stream_id
			);

			if (channelInfo) {
				channelInfo.favorite = newState;
			}

			// Dispatch event to update UI elsewhere
			window.dispatchEvent(
				new CustomEvent('channel:favorite:updated', {
					detail: {
						providerId: currentProviderId,
						streamId: currentChannel.stream_id,
						favorite: newState
					}
				})
			);
		} catch (e) {
			console.error('Error toggling favorite:', e);
			errorMessage = 'Failed to update favorite status';
		}
	}

	function closeDialog() {
		isOpen = false;
	}
</script>

<Dialog.Root bind:open={isOpen}>
	<Dialog.Content class="max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>
				{#if currentChannel}
					<div class="flex items-center gap-2">
						<span>{currentChannel.name}</span>
						{#if channelInfo?.height}
							<Badge variant="secondary">{channelInfo.height}p</Badge>
						{/if}
					</div>
				{:else}
					Channel Details
				{/if}
			</Dialog.Title>
		</Dialog.Header>

		{#if isLoading}
			<div class="flex justify-center py-8">
				<p class="text-muted-foreground">Loading channel information...</p>
			</div>
		{:else if errorMessage}
			<div class="flex justify-center py-8">
				<p class="text-destructive">{errorMessage}</p>
			</div>
		{:else if channelInfo}
			<div class="flex flex-col gap-4">
				<div class="flex items-center gap-4">
					<Button variant="outline" class="gap-2" onclick={toggleFavorite}>
						<Heart class="h-4 w-4" fill={channelInfo.favorite ? 'currentColor' : 'none'} />
						{channelInfo.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
					</Button>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-md border p-4">
						<h3 class="mb-2 text-lg font-semibold">Channel Info</h3>
						<div class="space-y-2">
							<div class="grid grid-cols-3 gap-1">
								<span class="text-muted-foreground">ID:</span>
								<span class="col-span-2">{currentChannel?.stream_id || 'N/A'}</span>
							</div>
							<div class="grid grid-cols-3 gap-1">
								<span class="text-muted-foreground">Resolution:</span>
								<span class="col-span-2"
									>{channelInfo.height ? `${channelInfo.height}p` : 'Unknown'}</span
								>
							</div>
							<div class="grid grid-cols-3 gap-1">
								<span class="text-muted-foreground">Favorite:</span>
								<span class="col-span-2">{channelInfo.favorite ? 'Yes' : 'No'}</span>
							</div>
							<div class="grid grid-cols-3 gap-1">
								<span class="text-muted-foreground">Hidden:</span>
								<span class="col-span-2">{channelInfo.hidden ? 'Yes' : 'No'}</span>
							</div>
							<div class="grid grid-cols-3 gap-1">
								<span class="text-muted-foreground">Restricted:</span>
								<span class="col-span-2">{channelInfo.restricted ? 'Yes' : 'No'}</span>
							</div>
							<div class="grid grid-cols-3 gap-1">
								<span class="text-muted-foreground">Status:</span>
								<span class="col-span-2">{channelInfo.status || 'Unknown'}</span>
							</div>
						</div>
					</div>

					<div class="rounded-md border p-4">
						<h3 class="mb-2 text-lg font-semibold">Metadata</h3>
						{#if Object.keys(metadata).length > 0}
							<div class="max-h-60 space-y-2 overflow-y-auto">
								{#each Object.entries(metadata) as [key, value]}
									<div class="grid grid-cols-3 gap-1">
										<span class="text-muted-foreground">{key}:</span>
										<span class="col-span-2 break-words">
											{#if typeof value === 'object'}
												{JSON.stringify(value)}
											{:else}
												{value}
											{/if}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground">No metadata available</p>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div class="flex justify-center py-8">
				<p class="text-muted-foreground">No channel information available</p>
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={closeDialog}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
