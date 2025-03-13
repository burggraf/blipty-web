/// <reference types="svelte" />
/// <reference types="@sveltejs/kit" />

declare namespace svelteHTML {
    interface HTMLAttributes<T> {
        [key: string]: any;
    }
}