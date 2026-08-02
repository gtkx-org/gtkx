import type { Plugin } from "vite";
import { codeToHtml, type ThemeRegistrationRaw } from "shiki";
import { type Snippet, SNIPPETS } from "./snippets.js";

const VIRTUAL_ID = "virtual:gtkx-snippets";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const THEME: ThemeRegistrationRaw = {
    name: "gtkx",
    fg: "var(--syntax-plain)",
    bg: "transparent",
    settings: [
        {
            scope: ["keyword.control", "storage.type", "storage.modifier", "keyword.operator.new",
                "keyword.operator.expression", "constant.language", "variable.language"],
            settings: { foreground: "var(--syntax-keyword)" },
        },
        {
            scope: ["storage.type.function.arrow"],
            settings: { foreground: "var(--syntax-plain)" },
        },
        {
            scope: ["support.class.component", "entity.name.tag"],
            settings: { foreground: "var(--syntax-tag)" },
        },
        {
            scope: ["string", "punctuation.definition.string"],
            settings: { foreground: "var(--syntax-string)" },
        },
        {
            scope: ["support.type.property-name"],
            settings: { foreground: "var(--syntax-plain)" },
        },
        {
            scope: ["punctuation.definition.tag"],
            settings: { foreground: "var(--syntax-punctuation)" },
        },
        {
            scope: ["comment"],
            settings: { foreground: "var(--syntax-comment)", fontStyle: "italic" },
        },
    ],
};

const highlight = async ([id, snippet]: [string, Snippet]): Promise<[string, { code: string; html: string }]> => {
    const html = await codeToHtml(snippet.code.replace(/\n$/, ""), { lang: snippet.lang, theme: THEME });

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
