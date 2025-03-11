<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { query } from '$lib/services/db';
	import { cn } from '$lib/utils';

	let sqlQuery = '';
	let results: any[] = [];
	let error: string | null = null;
	let isLoading = false;
	let open = false;

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

<Dialog.Root bind:open>
	<Dialog.Trigger asChild>
		<slot />
	</Dialog.Trigger>
	<Dialog.Content class="flex max-h-[80vh] max-w-3xl flex-col">
		<Dialog.Header>
			<Dialog.Title>Execute SQL Query</Dialog.Title>
			<Dialog.Description>Enter a SQL query to execute against the database.</Dialog.Description>
		</Dialog.Header>
		<div class="flex-1 overflow-y-auto">
			<div class="space-y-4 p-4">
				<textarea
					bind:value={sqlQuery}
					placeholder="Enter SQL query..."
					class="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				/>

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
		</div>
		<Dialog.Footer>
			<Button disabled={isLoading} onclick={executeQuery}>
				{isLoading ? 'Executing...' : 'Execute Query'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
