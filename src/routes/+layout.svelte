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
	import type { Category, CategoryType } from '$lib/repositories/category.repository';
	import type { Channel } from '$lib/repositories/channel.repository';

	let { children } = $props<{ children: any }>();
	let dbReady = $state(false);
	let providers = $state<Provider[]>([]);
	let syncingProviders = $state<Set<number>>(new Set());
	let providerRepo = new ProviderRepository();
	let categoryRepo = new CategoryRepository();
	let channelRepo = new ChannelRepository();

	// Store categories and channels by provider
	let categoriesByProvider = $state<Record<number, Record<CategoryType, Category[]>>>({});
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
			// Refresh providers after sync
			providers = await providerRepo.findAll();
		} catch (err) {
			console.error('Failed to sync provider:', err);
		} finally {
			syncingProviders.delete(providerId);
		}
	}

	async function loadProviderData(providerId: number) {
		// Load live categories
		const liveCategories = await categoryRepo.findByProvider(providerId, 'live');
		const movieCategories = await categoryRepo.findByProvider(providerId, 'vod_movie');
		const seriesCategories = await categoryRepo.findByProvider(providerId, 'vod_series');

		categoriesByProvider[providerId] = {
			live: liveCategories,
			vod_movie: movieCategories,
			vod_series: seriesCategories
		};

		// Load channels for each category
		for (const category of [...liveCategories, ...movieCategories, ...seriesCategories]) {
			if (category.id) {
				channelsByCategory[category.id] = await channelRepo.findByCategory(category.id);
			}
		}
	}
</script>

<!-- svelte-ignore a11y_missing_attribute -->
<div class="flex">
	<Sidebar.Provider>
		<Sidebar.Root>
			<Sidebar.Header>
				<div class="flex items-center gap-2 px-2">
					<Sidebar.Trigger>
						<MenuIcon />
					</Sidebar.Trigger>
					<span class="font-semibold">Database Testing</span>
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
									{#if provider.id && categoriesByProvider[provider.id]}
										<Accordion.Root type="multiple" class="pl-4">
											{#if categoriesByProvider[provider.id].live?.length}
												<Accordion.Item value={`${provider.id}-live`}>
													<Accordion.Trigger>Live TV</Accordion.Trigger>
													<Accordion.Content>
														<Accordion.Root type="multiple" class="pl-4">
															{#each categoriesByProvider[provider.id].live as category}
																<Accordion.Item value={`category-${category.id}`}>
																	<Accordion.Trigger>{category.name}</Accordion.Trigger>
																	<Accordion.Content>
																		<div class="pl-4 text-sm">
																			{#if category.id && channelsByCategory[category.id]}
																				{#each channelsByCategory[category.id] as channel}
																					<div class="py-1">{channel.name}</div>
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

											{#if categoriesByProvider[provider.id].vod_movie?.length}
												<Accordion.Item value={`${provider.id}-movies`}>
													<Accordion.Trigger>Movies</Accordion.Trigger>
													<Accordion.Content>
														<Accordion.Root type="multiple" class="pl-4">
															{#each categoriesByProvider[provider.id].vod_movie as category}
																<Accordion.Item value={`category-${category.id}`}>
																	<Accordion.Trigger>{category.name}</Accordion.Trigger>
																	<Accordion.Content>
																		<div class="pl-4 text-sm">
																			{#if category.id && channelsByCategory[category.id]}
																				{#each channelsByCategory[category.id] as channel}
																					<div class="py-1">{channel.name}</div>
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

											{#if categoriesByProvider[provider.id].vod_series?.length}
												<Accordion.Item value={`${provider.id}-series`}>
													<Accordion.Trigger>Series</Accordion.Trigger>
													<Accordion.Content>
														<Accordion.Root type="multiple" class="pl-4">
															{#each categoriesByProvider[provider.id].vod_series as category}
																<Accordion.Item value={`category-${category.id}`}>
																	<Accordion.Trigger>{category.name}</Accordion.Trigger>
																	<Accordion.Content>
																		<div class="pl-4 text-sm">
																			{#if category.id && channelsByCategory[category.id]}
																				{#each channelsByCategory[category.id] as channel}
																					<div class="py-1">{channel.name}</div>
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
