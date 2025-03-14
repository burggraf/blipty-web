<script lang="ts">
	import '../app.css';
	import { initializeDB } from '$lib/services/db';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import * as Accordion from '$lib/components/ui/accordion';
	import { MenuIcon, RefreshCw, Heart, MoreVertical } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import DatabaseTestDialog from '$lib/components/DatabaseTestDialog.svelte';
	import { ProviderRepository } from '$lib/repositories/provider.repository';
	import { CategoryRepository, type CategoryType } from '$lib/repositories/category.repository';
	import { ChannelRepository } from '$lib/repositories/channel.repository';
	import {
		ChannelInfoRepository,
		type ChannelInfo
	} from '$lib/repositories/channelinfo.repository';
	import type { Provider } from '$lib/repositories/provider.repository';
	import type { Channel } from '$lib/repositories/channel.repository';
	import AddProviderForm from '$lib/components/AddProviderForm.svelte';
	import PlusCircle from 'lucide-svelte/icons/plus-circle';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Popover from '$lib/components/ui/popover';

	let { children } = $props<{ children: any }>();

	let dbReady = $state(false);
	let providers = $state<Provider[]>([]);
	let syncingProviders = $state<Set<number>>(new Set());
	let providerRepo = new ProviderRepository();
	let categoryRepo = new CategoryRepository();
	let channelRepo = new ChannelRepository();
	let channelInfoRepo = new ChannelInfoRepository();
	let showAddProviderDialog = $state(false);
	let favoriteChannels = $state<Map<string, boolean>>(new Map());

	// Store channelinfo data by provider_id and stream_id
	let channelInfoData = $state<Record<string, ChannelInfo>>({});

	// Store category stats and channels by provider
	let categoryStatsByProvider = $state<
		Record<number, { category_type: CategoryType; count: number }[]>
	>({});
	let categoriesByType = $state<
		Record<number, Record<string, { category_id: number; name: string; channel_count: number }[]>>
	>({});
	let channelsByCategory = $state<Record<number, Channel[]>>({});

	// New state to store favorite channels by content type
	let favoriteChannelsByType = $state<Record<number, Record<string, Channel[]>>>({});

	// Helper function to get channel info
	async function getChannelInfo(providerId: number, streamId: string): Promise<ChannelInfo | null> {
		const key = `${providerId}-${streamId}`;
		if (!channelInfoData[key]) {
			const info = await channelInfoRepo.findByStreamId(providerId, streamId);
			if (info) {
				channelInfoData[key] = info;
			}
		}
		return channelInfoData[key] || null;
	}

	$effect.pre(() => {
		initializeDB()
			.then(async () => {
				dbReady = true;
				providers = await providerRepo.findAll();
				// Load data for all providers
				for (const provider of providers) {
					if (provider.id) {
						await loadProviderData(provider.id);
					}
				}
				// Load all favorites
				await loadFavorites();
			})
			.catch(console.error);
	});

	// Listen for provider:created events
	$effect(() => {
		const handleProviderCreated = async () => {
			providers = await providerRepo.findAll();
			// Load data for the new provider
			const newProvider = providers[providers.length - 1];
			if (newProvider.id) {
				await loadProviderData(newProvider.id);
			}
		};
		window.addEventListener('provider:created', handleProviderCreated);
		return () => window.removeEventListener('provider:created', handleProviderCreated);
	});

	async function loadFavorites() {
		const favorites = await channelInfoRepo.findFavorites();
		const newFavorites = new Map();

		favorites.forEach((info) => {
			const key = `${info.provider_id}-${info.stream_id}`;
			newFavorites.set(key, true);
			// Store channel info data
			channelInfoData[key] = info;
		});

		favoriteChannels = newFavorites;

		// Load favorite channels by content type for each provider
		for (const provider of providers) {
			if (provider.id) {
				await loadFavoriteChannelsByType(provider.id);
			}
		}
	}

	async function loadFavoriteChannelsByType(providerId: number) {
		if (!favoriteChannelsByType[providerId]) {
			favoriteChannelsByType[providerId] = {};
		}

		// Load favorites for each content type
		for (const stat of categoryStatsByProvider[providerId] || []) {
			const type = stat.category_type;
			const favoriteChannels = await categoryRepo.getFavoriteChannelsByType(providerId, type);
			favoriteChannelsByType[providerId][type] = favoriteChannels;

			// Load channel info data for each favorite channel
			for (const channel of favoriteChannels) {
				const info = await channelInfoRepo.findByStreamId(providerId, channel.stream_id);
				if (info) {
					const key = `${providerId}-${channel.stream_id}`;
					channelInfoData[key] = info;
				}
			}
		}
	}

	async function toggleFavorite(e: MouseEvent, providerId: number, streamId: string) {
		e.stopPropagation();
		const newState = await channelInfoRepo.toggleFavorite(providerId, streamId);
		const key = `${providerId}-${streamId}`;

		// Update local state
		const updatedFavorites = new Map(favoriteChannels);

		if (newState) {
			updatedFavorites.set(key, true);
		} else {
			updatedFavorites.delete(key);
		}

		favoriteChannels = updatedFavorites;

		// Reload favorites by content type for this provider
		await loadFavoriteChannelsByType(providerId);
	}

	async function syncProvider(providerId: number) {
		if (!providerId || syncingProviders.has(providerId)) return;

		syncingProviders.add(providerId);
		try {
			await providerRepo.sync(providerId);
			// Refresh providers and data after sync
			providers = await providerRepo.findAll();
			await loadProviderData(providerId);
		} catch (err) {
			console.error('Failed to sync provider:', err);
		} finally {
			syncingProviders.delete(providerId);
		}
	}

	async function loadProviderData(providerId: number) {
		// Get category type statistics
		categoryStatsByProvider[providerId] = await categoryRepo.getCategoryTypeStats(providerId);

		// Initialize categories by type for this provider
		categoriesByType[providerId] = {};

		// Load categories for each type
		for (const stat of categoryStatsByProvider[providerId]) {
			const categories = await categoryRepo.getCategoriesByType(providerId, stat.category_type);
			categoriesByType[providerId][stat.category_type] = categories;

			// Load channels for each category
			for (const category of categories) {
				const channels = await channelRepo.findByCategory(category.category_id);
				channelsByCategory[category.category_id] = channels;

				// Load channel info data for each channel
				for (const channel of channels) {
					const info = await channelInfoRepo.findByStreamId(providerId, channel.stream_id);
					if (info) {
						const key = `${providerId}-${channel.stream_id}`;
						channelInfoData[key] = info;
					}
				}
			}
		}

		// Load favorite channels by content type
		await loadFavoriteChannelsByType(providerId);
	}

	async function handleChannelClick(channel: any, providerId: number) {
		console.log('handleChannelClick', channel);
		const provider = await providerRepo.findById(providerId);
		if (provider) {
			window.dispatchEvent(
				new CustomEvent('channel:selected', {
					detail: {
						...channel,
						provider_id: providerId
					}
				})
			);
		}
	}

	function getCategoryTypeLabel(type: CategoryType): string {
		switch (type) {
			case 'live':
				return 'Live TV';
			case 'vod_movie':
				return 'Movies';
			case 'vod_series':
				return 'Series';
			default:
				return type;
		}
	}
</script>

<div class="flex">
	<Sidebar.Provider>
		<Sidebar.Root>
			<Sidebar.Header>
				<div class="flex items-center gap-2 px-2">
					<Sidebar.Trigger>
						<MenuIcon />
					</Sidebar.Trigger>
					<span class="font-semibold">Providers</span>
					<Button variant="ghost" size="icon" onclick={() => (showAddProviderDialog = true)}>
						<PlusCircle class="h-4 w-4" />
						<span class="sr-only">Add Provider</span>
					</Button>
				</div>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					<div class="p-2">
						<DatabaseTestDialog>
							<Button variant="outline" class="w-full">Execute SQL Query</Button>
						</DatabaseTestDialog>
					</div>
					<Accordion.Root type="multiple" class="w-full">
						{#each providers as provider}
							<Accordion.Item value={provider.id?.toString() ?? ''}>
								<div class="flex items-center justify-between px-2">
									<Accordion.Trigger>{provider.name}</Accordion.Trigger>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8"
										disabled={syncingProviders.has(provider.id ?? 0)}
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											if (provider.id) syncProvider(provider.id);
										}}
									>
										<RefreshCw
											class={syncingProviders.has(provider.id ?? 0) ? 'animate-spin' : ''}
										/>
										<span class="sr-only">Sync Provider</span>
									</Button>
								</div>
								<Accordion.Content>
									{#if provider.id && categoryStatsByProvider[provider.id]}
										<Accordion.Root type="multiple" class="pl-4">
											{#each categoryStatsByProvider[provider.id] as { category_type, count }}
												{#if count > 0}
													<Accordion.Item value={`${provider.id}-${category_type}`}>
														<Accordion.Trigger>
															{getCategoryTypeLabel(category_type)} ({count})
														</Accordion.Trigger>
														<Accordion.Content>
															<Accordion.Root type="multiple" class="pl-4">
																<!-- Favorites category for this content type -->
																{#if favoriteChannelsByType[provider.id]?.[category_type]?.length > 0}
																	<Accordion.Item
																		value={`favorites-${provider.id}-${category_type}`}
																	>
																		<Accordion.Trigger>
																			Favorites ({favoriteChannelsByType[provider.id][category_type]
																				.length})
																		</Accordion.Trigger>
																		<Accordion.Content>
																			<div class="pl-4 text-sm">
																				{#each favoriteChannelsByType[provider.id][category_type] as channel}
																					{@const key = `${provider.id}-${channel.stream_id}`}
																					{@const channelInfo = channelInfoData[key]}
																					<div
																						class="flex w-full items-center gap-1 rounded-sm px-2 py-1 hover:bg-accent/50"
																					>
																						<button
																							class="flex flex-1 items-center text-left"
																							onclick={() =>
																								handleChannelClick(channel, provider.id!)}
																						>
																							<span class="flex-1">{channel.name}</span>
																							{#if channelInfo?.height}
																								<Badge variant="secondary"
																									>{channelInfo.height}p</Badge
																								>
																							{/if}
																						</button>
																						<Button
																							variant="ghost"
																							size="icon"
																							class="h-6 w-6"
																							onclick={(e) =>
																								toggleFavorite(e, provider.id!, channel.stream_id)}
																						>
																							<Heart class="h-4 w-4" fill="currentColor" />
																							<span class="sr-only">Remove from Favorites</span>
																						</Button>
																						<Popover.Root>
																							<Popover.Trigger>
																								<Button variant="ghost" size="icon" class="h-6 w-6">
																									<MoreVertical class="h-4 w-4" />
																								</Button>
																							</Popover.Trigger>
																							<Popover.Content class="w-48">
																								<div class="flex flex-col gap-1">
																									<Button
																										variant="ghost"
																										class="w-full justify-start"
																										onclick={() => {
																											console.log('View details');
																										}}
																									>
																										View Details
																									</Button>
																									<Button
																										variant="ghost"
																										class="w-full justify-start"
																										onclick={() => {
																											console.log('Add to playlist');
																										}}
																									>
																										Add to Playlist
																									</Button>
																								</div>
																							</Popover.Content>
																						</Popover.Root>
																					</div>
																				{/each}
																			</div>
																		</Accordion.Content>
																	</Accordion.Item>
																{/if}

																<!-- Regular categories -->
																{#each categoriesByType[provider.id][category_type] as category}
																	<Accordion.Item value={`category-${category.category_id}`}>
																		<Accordion.Trigger>
																			{category.name} ({category.channel_count})
																		</Accordion.Trigger>
																		<Accordion.Content>
																			<div class="pl-4 text-sm">
																				{#if channelsByCategory[category.category_id]}
																					{#each channelsByCategory[category.category_id] as channel}
																						{@const key = `${provider.id}-${channel.stream_id}`}
																						{@const channelInfo = channelInfoData[key]}
																						<div
																							class="flex w-full items-center gap-1 rounded-sm px-2 py-1 hover:bg-accent/50"
																						>
																							<button
																								class="flex flex-1 items-center text-left"
																								onclick={() =>
																									handleChannelClick(channel, provider.id!)}
																							>
																								<span class="flex-1">{channel.name}</span>
																								{#if channelInfo?.height}
																									<Badge variant="secondary"
																										>{channelInfo.height}p</Badge
																									>
																								{/if}
																							</button>
																							<Button
																								variant="ghost"
																								size="icon"
																								class="h-6 w-6"
																								onclick={(e) =>
																									toggleFavorite(
																										e,
																										provider.id!,
																										channel.stream_id
																									)}
																							>
																								<Heart
																									class="h-4 w-4"
																									fill={favoriteChannels.has(
																										`${provider.id}-${channel.stream_id}`
																									)
																										? 'currentColor'
																										: 'none'}
																								/>
																								<span class="sr-only">Toggle Favorite</span>
																							</Button>
																							<Popover.Root>
																								<Popover.Trigger>
																									<Button
																										variant="ghost"
																										size="icon"
																										class="h-6 w-6"
																									>
																										<MoreVertical class="h-4 w-4" />
																										<span class="sr-only">More Options</span>
																									</Button>
																								</Popover.Trigger>
																								<Popover.Content class="w-48">
																									<div class="flex flex-col gap-1">
																										<Button
																											variant="ghost"
																											class="w-full justify-start"
																											onclick={() => {
																												console.log('View details');
																											}}
																										>
																											View Details
																										</Button>
																										<Button
																											variant="ghost"
																											class="w-full justify-start"
																											onclick={() => {
																												console.log('Add to playlist');
																											}}
																										>
																											Add to Playlist
																										</Button>
																									</div>
																								</Popover.Content>
																							</Popover.Root>
																						</div>
																					{/each}
																				{/if}
																			</div>
																		</Accordion.Content>
																	</Accordion.Item>
																{/each}
															</Accordion.Root>
														</Accordion.Content>
													</Accordion.Item>
												{/if}
											{/each}
										</Accordion.Root>
									{/if}
								</Accordion.Content>
							</Accordion.Item>
						{/each}
					</Accordion.Root>
				</Sidebar.Group>
			</Sidebar.Content>
		</Sidebar.Root>
		<Sidebar.Inset>
			{#if dbReady}
				{@render children()}
			{:else}
				<div class="flex h-screen items-center justify-center">
					<p class="text-muted-foreground">Initializing database...</p>
				</div>
			{/if}
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>

<Dialog.Root bind:open={showAddProviderDialog}>
	<Dialog.Content class="max-w-md">
		<AddProviderForm />
	</Dialog.Content>
</Dialog.Root>
