<!-- SqlQueryBox.svelte -->
<script lang="ts">
	import { query } from '$lib/services/db';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	export let sqlQuery = '';
	let results: any[] = [];
	let error: string | null = null;
	let isLoading = false;

	async function executeQuery() {
		if (!sqlQuery.trim()) return;

		isLoading = true;
		error = null;

		try {
			results = await query(sqlQuery);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			results = [];
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex flex-col gap-2 p-4">
	<textarea
		bind:value={sqlQuery}
		placeholder="Enter SQL query..."
		class="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
	/>

	<Button onclick={executeQuery} disabled={isLoading} class="w-full">
		{isLoading ? 'Executing...' : 'Execute Query'}
	</Button>

	{#if error}
		<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
			{error}
		</div>
	{/if}

	{#if results.length > 0}
		<div class="rounded-md border">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead>
						<tr class="border-b bg-muted/50">
							{#each Object.keys(results[0]) as header}
								<th class="p-2 font-medium">{header}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each results as row}
							<tr class="border-b">
								{#each Object.values(row) as cell}
									<td class="p-2">
										{typeof cell === 'object' ? JSON.stringify(cell) : cell}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
