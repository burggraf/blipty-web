<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { Provider } from '$lib/repositories/provider.repository';
	import { ProviderRepository } from '$lib/repositories/provider.repository';

	const providerRepo = new ProviderRepository();

	let name = $state('');
	let server_url = $state('');
	let username = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let isSubmitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Trim all inputs
		name = name.trim();
		server_url = server_url.trim();
		username = username.trim();
		password = password.trim();

		if (!name || !server_url || !username || !password) {
			error = 'All fields are required';
			return;
		}

		// Validate server URL format
		try {
			const url = new URL(server_url);
			if (!url.protocol.startsWith('http')) {
				error = 'Server URL must start with http:// or https://';
				return;
			}
			// Remove trailing slashes
			server_url = server_url.replace(/\/+$/, '');
		} catch {
			error = 'Invalid server URL format';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			await providerRepo.create({
				name,
				server_url,
				username,
				password
			});

			// Instead of reloading, we'll emit a success event
			window.dispatchEvent(new CustomEvent('provider:created'));

			// Reset form
			name = '';
			server_url = '';
			username = '';
			password = '';
		} catch (err) {
			console.error('Failed to create provider:', err);
			error = err instanceof Error ? err.message : 'Failed to create provider';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="flex min-h-[50vh] items-center justify-center">
	<div class="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-sm">
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Add IPTV Provider</h1>
			<p class="text-sm text-muted-foreground">Enter your Xtream Codes provider details below</p>
		</div>

		<form class="space-y-4" onsubmit={handleSubmit}>
			<div class="space-y-2">
				<Input type="text" placeholder="Provider Name" bind:value={name} required />
			</div>
			<div class="space-y-2">
				<Input
					type="url"
					placeholder="Server URL (e.g. http://example.com)"
					bind:value={server_url}
					required
					pattern="https?://.+"
				/>
			</div>
			<div class="space-y-2">
				<Input type="text" placeholder="Username" bind:value={username} required />
			</div>
			<div class="space-y-2">
				<Input type="password" placeholder="Password" bind:value={password} required />
			</div>

			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<Button type="submit" class="w-full" disabled={isSubmitting}>
				{isSubmitting ? 'Adding...' : 'Add Provider'}
			</Button>
		</form>
	</div>
</div>
