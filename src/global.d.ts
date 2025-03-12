/// <reference types="svelte" />
/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />

import type { HTMLAttributes } from 'svelte/elements';

declare global {
    namespace svelteHTML {
        interface HTMLAttributes<T> extends HTMLAttributes<T> { }
    }
}