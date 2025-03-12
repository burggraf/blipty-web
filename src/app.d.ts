/// <reference types="@sveltejs/kit" />
/// <reference types="svelte" />

declare module "$app/environment" {
	export const browser: boolean;
	export const dev: boolean;
	export const building: boolean;
	export const version: string;
}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Add Svelte 5 runes types to the global scope
	const $state: typeof import('svelte/runes').$state;
	const $props: typeof import('svelte/runes').$props;
	const $effect: typeof import('svelte/runes').$effect;
	const $derived: typeof import('svelte/runes').$derived;
}

declare namespace svelteHTML {
	interface HTMLAttributes<T> {
		[key: string]: any;
	}
}

export { };
