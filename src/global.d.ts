/// <reference types="svelte" />
/// <reference types="@sveltejs/kit" />

// Extend existing HTML attributes for Svelte components
declare namespace svelteHTML {
    interface HTMLAttributes<T> {
        // Allow any attribute
        [key: string]: any;
    }

    // Specific element interfaces if needed
    interface HTMLVideoElementAttributes<T extends HTMLVideoElement> extends HTMLAttributes<T> {
        playsinline?: boolean | string;
        crossorigin?: string;
    }
}

// Fix TypeScript errors with the $props, $state, and $effect keywords in Svelte 5
declare global {
    // Add any global types needed for your project
}

export { };