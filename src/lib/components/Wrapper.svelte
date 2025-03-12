<script lang="ts">
	let { class: className = '', tag = 'div' } = $props<{ class?: string; tag?: string }>();
</script>

{#if tag === 'div'}
	<div class={className}><slot /></div>
{:else if tag === 'h1'}
	<h1 class={className}><slot /></h1>
{:else if tag === 'h2'}
	<h2 class={className}><slot /></h2>
{:else if tag === 'p'}
	<p class={className}><slot /></p>
{:else if tag === 'span'}
	<span class={className}><slot /></span>
{/if}
