<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { testConnectionString } from '$lib/features/db';

	let connectionString = '';
	let testResult = '';
	let loading = false;
	let open = false;

	async function testDatabase() {
		loading = true;
		try {
			const result = await testConnectionString(connectionString);
			testResult = result.success ? 'Connection successful!' : 'Connection failed: ' + result.error;
		} catch (error) {
			testResult = 'Error: ' + (error instanceof Error ? error.message : String(error));
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger asChild>
		<slot />
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Test Database Connection</Dialog.Title>
			<Dialog.Description>
				Enter your database connection string to test the connection.
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="space-y-2">
				<Label for="connectionString">Connection String</Label>
				<Input
					id="connectionString"
					bind:value={connectionString}
					placeholder="Enter connection string"
				/>
			</div>
			{#if testResult}
				<div
					class="text-sm {testResult.includes('successful') ? 'text-green-600' : 'text-red-600'}"
				>
					{testResult}
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button disabled={loading} on:click={testDatabase}>
				{loading ? 'Testing...' : 'Test Connection'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
