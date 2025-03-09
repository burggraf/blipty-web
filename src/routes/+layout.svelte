<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { initializeDB } from '$lib/services/db';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import SqlQueryBox from '$lib/components/SqlQueryBox.svelte';
	import { Menu } from 'lucide-svelte';

	let { children } = $props();

	onMount(() => {
		if (browser) {
			initializeDB().catch(console.error);
		}
	});
</script>

<div class="flex">
	<Sidebar.Provider>
		<Sidebar.Root>
			<Sidebar.Header>
				<div class="flex items-center gap-2 px-2">
					<Sidebar.Trigger>
						<Menu />
					</Sidebar.Trigger>
					<span class="font-semibold">Database Testing</span>
				</div>
			</Sidebar.Header>
			<Sidebar.Content>
				<SqlQueryBox />
			</Sidebar.Content>
		</Sidebar.Root>
		<Sidebar.Inset>
			{@render children()}
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>
