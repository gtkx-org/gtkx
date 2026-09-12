/// <reference types="vitepress/client" />

declare module "*.vue" {
    import type { DefineComponent } from "vue";
    const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
    export default component;
}

declare module "virtual:gtkx-snippets" {
    import type { SNIPPETS } from "./.vitepress/snippets.js";
    export type HighlightedSnippet = { code: string; html: string };
    const snippets: Record<keyof typeof SNIPPETS, HighlightedSnippet>;
    export default snippets;
}
