import type { Plugin } from "vite";
import { codeToHtml } from "shiki";
import { type Snippet, SNIPPETS } from "./snippets.js";

const VIRTUAL_ID = "virtual:gtkx-snippets";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const THEMES = { light: "github-light", dark: "github-dark" } as const;

const highlight = async ([id, snippet]: [string, Snippet]): Promise<[string, { code: string; html: string }]> => {
    const html = await codeToHtml(snippet.code.replace(/\n$/, ""), {
        lang: snippet.lang,
        themes: THEMES,
        defaultColor: false,
    });

    return [id, { code: snippet.code, html }];
};

const loadSnippets = async (): Promise<string> => {
    const entries = await Promise.all(Object.entries(SNIPPETS).map((entry) => highlight(entry)));

    return `export default ${JSON.stringify(Object.fromEntries(entries))};`;
};

const highlightPlugin = (): Plugin => ({
    name: "gtkx:snippets",
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load: (id) => (id === RESOLVED_ID ? loadSnippets() : undefined),
});

export { highlightPlugin };
