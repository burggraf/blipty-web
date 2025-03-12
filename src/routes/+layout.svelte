<script lang="ts">
	import '../app.css';
	import { initializeDB } from '$lib/services/db';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import * as Accordion from '$lib/components/ui/accordion';
	import { MenuIcon, RefreshCw } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import DatabaseTestDialog from '$lib/components/DatabaseTestDialog.svelte';
	import { ProviderRepository } from '$lib/repositories/provider.repository';
	import { CategoryRepository } from '$lib/repositories/category.repository';
	import { ChannelRepository } from '$lib/repositories/channel.repository';
	import type { Provider } from '$lib/repositories/provider.repository';
	import type { Channel } from '$lib/repositories/channel.repository';
	import AddProviderForm from '$lib/components/AddProviderForm.svelte';
	import PlusCircle from 'lucide-svelte/icons/plus-circle';
	import * as Dialog from '$lib/components/ui/dialog';

	let { children } = $props<{ children: any }>();
	let dbReady = $state(false);
	let providers = $state<Provider[]>([]);
	let syncingProviders = $state<Set<number>>(new Set());
	let providerRepo = new ProviderRepository();
	let categoryRepo = new CategoryRepository();
	let channelRepo = new ChannelRepository();
	let showAddProviderDialog = $state(false);

	// Store category stats and channels by provider
	let categoryStatsByProvider = $state<Record<number, { category_type: string; count: number }[]>>(
		{}
	);
	let categoriesByType = $state<
		Record<number, Record<string, { category_id: number; name: string; channel_count: number }[]>>
	>({});
	let channelsByCategory = $state<Record<number, Channel[]>>({});

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
				channelsByCategory[category.category_id] = await channelRepo.findByCategory(
					category.category_id
				);
			}
		}
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

	function getCategoryTypeLabel(type: string): string {
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
																{#each categoriesByType[provider.id][category_type] as category}
																	<Accordion.Item value={`category-${category.category_id}`}>
																		<Accordion.Trigger>
																			{category.name} ({category.channel_count})
																		</Accordion.Trigger>
																		<Accordion.Content>
																			<div class="pl-4 text-sm">
																				{#if channelsByCategory[category.category_id]}
																					{#each channelsByCategory[category.category_id] as channel}
																						<button
																							class="w-full rounded-sm px-2 py-1 text-left hover:bg-accent/50"
																							onclick={() =>
																								handleChannelClick(channel, provider.id!)}
																						>
																							{channel.name}
																						</button>
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
