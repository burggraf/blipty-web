<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { initializeDB } from '$lib/services/db';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { MenuIcon } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import DatabaseTestDialog from '$lib/components/DatabaseTestDialog.svelte';

	let { children } = $props();
	let dbReady = $state(false);

	$effect.pre(() => {
		if (browser) {
			initializeDB()
				.then(() => {
					dbReady = true;
				})
				.catch(console.error);
		}
	});
</script>

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
				<div class="p-2">
					<DatabaseTestDialog>
						<Button variant="outline" class="w-full">Execute SQL Query</Button>
					</DatabaseTestDialog>
				</div>
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
