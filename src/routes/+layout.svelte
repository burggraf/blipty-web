<script lang="ts">
	import '../app.css';
	import { initializeDB } from '$lib/services/db';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import * as Accordion from '$lib/components/ui/accordion';
	import { MenuIcon, RefreshCw } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import DatabaseTestDialog from '$lib/components/DatabaseTestDialog.svelte';
	import { ProviderRepository } from '$lib/repositories/provider.repository';
	import type { Provider } from '$lib/repositories/provider.repository';

	let { children } = $props<{ children: any }>();
	let dbReady = $state(false);
	let providers = $state<Provider[]>([]);
	let syncingProviders = $state<Set<number>>(new Set());
	let providerRepo = new ProviderRepository();

	$effect.pre(() => {
		initializeDB()
			.then(async () => {
				dbReady = true;
				providers = await providerRepo.findAll();
			})
			.catch(console.error);
	});

	// Listen for provider:created events
	$effect(() => {
		const handleProviderCreated = async () => {
			providers = await providerRepo.findAll();
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
									<div class="space-y-2 px-2">
										<p class="text-sm text-muted-foreground">Server: {provider.server_url}</p>
										<p class="text-sm text-muted-foreground">Username: {provider.username}</p>
									</div>
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
