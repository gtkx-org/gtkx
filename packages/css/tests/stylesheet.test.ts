import { CssProvider } from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";
import { createCss } from "../src/create-css.js";
import { StyleSheet } from "../src/stylesheet.js";

type BrokenRule = { kind: string; rule: string };

const NUL = "\u{0}";
const GOOD_FIRST = ".first{color:rgb(255, 0, 0);}";
const GOOD_LAST = ".last{color:rgb(0, 0, 255);}";
const NUL_RULE = `.nul{font-family:"Canta${NUL}rell";}`;

const BROKEN_RULES: BrokenRule[] = [
    { kind: "an unbalanced parenthesis", rule: ".broken{color:rgb(0;font-weight:bold;};}" },
    { kind: "an unterminated string", rule: '.broken{font-family:"Cantarell;}' },
    { kind: "an unterminated comment", rule: ".broken{color:red;/*}" },
    { kind: "a block that is never closed", rule: ".broken{color:red;" },
];

const flushMicrotasks = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
        queueMicrotask(resolve);
    });
};

const insertAll = (rules: string[]): void => {
    const stylesheet = new StyleSheet();

    for (const rule of rules) {
        stylesheet.insert(rule);
    }
};

const loadedDocument = async (write: () => void): Promise<string> => {
    const documents: string[] = [];
    const warn = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const load = vi.spyOn(CssProvider.prototype, "loadFromString").mockImplementation((text: string) => {
        documents.push(text);
    });

    try {
        write();
        await flushMicrotasks();
    } finally {
        load.mockRestore();
        warn.mockRestore();
    }

    return documents.at(-1) ?? "";
};

const parsedDocument = (document: string): string => {
    const provider = new CssProvider();
    provider.loadFromString(document);

    return provider.toString();
};

const styleThroughCss = (): void => {
    const { css } = createCss();
    css({ color: "rgb(255, 0, 0)" });
    css({ color: "rgb(0", fontWeight: "bold" });
    css({ color: "rgb(0, 0, 255)" });
};

const parseAround = async (broken: string): Promise<string> => {
    const document = await loadedDocument(() => {
        insertAll([GOOD_FIRST, broken, GOOD_LAST]);
    });

    return parsedDocument(document);
};

describe("StyleSheet", () => {
    it("accepts a rule via insert", () => {
        const stylesheet = new StyleSheet();

        expect(() => {
            stylesheet.insert(".test { color: red; }");
        }).not.toThrow();
    });

    it("accepts multiple rules via insert", () => {
        const stylesheet = new StyleSheet();

        expect(() => {
            stylesheet.insert(".rule1 { color: red; }");
            stylesheet.insert(".rule2 { color: blue; }");
            stylesheet.insert(".rule3 { color: green; }");
        }).not.toThrow();
    });

    it("warns when GTK4 rejects a declaration", async () => {
        const warn = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        try {
            const stylesheet = new StyleSheet();
            stylesheet.insert(".bad { not-a-real-property: 1; }");
            await flushMicrotasks();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("[gtkx:css]"));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("GTK4 rejected CSS"));
        } finally {
            warn.mockRestore();
        }
    });
});

describe("StyleSheet — rules that never close what they open", () => {
    it.each(BROKEN_RULES)("keeps the rules inserted after one with $kind", async ({ rule }) => {
        const parsed = await parseAround(rule);
        expect(parsed).toContain(".first");
        expect(parsed).toContain(".last");
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it("warns and names the rule it drops", () => {
        const warn = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        try {
            insertAll([".broken{color:rgb(0;}"]);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("[gtkx:css]"));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining(".broken{color:rgb(0;}"));
        } finally {
            warn.mockRestore();
        }
    });

    it("keeps the styles created after a css call whose value never closes", async () => {
        const parsed = parsedDocument(await loadedDocument(styleThroughCss));
        expect(parsed).toContain("rgb(255,0,0)");
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it("installs a rule whose brackets sit inside a string or a comment", async () => {
        const document = await loadedDocument(() => {
            insertAll(['.quoted{font-family:"Cantarell{(";/* } ( */}']);
        });

        expect(parsedDocument(document)).toContain(".quoted");
    });
});

describe("StyleSheet — values GTK4 cannot load", () => {
    it("stays alive when an interpolated style value carries a NUL byte", async () => {
        const warn = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        try {
            const { injectGlobal } = createCss();
            injectGlobal({ fontFamily: `"Canta${NUL}rell"` });
            await flushMicrotasks();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("[gtkx:css]"));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("NUL byte"));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining(String.raw`Canta\0rell`));
        } finally {
            warn.mockRestore();
        }
    });

    it("keeps the rules inserted after one carrying a NUL byte", async () => {
        const parsed = await parseAround(NUL_RULE);
        expect(parsed).toContain(".first");
        expect(parsed).toContain(".last");
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it("never hands the provider a document carrying a NUL byte", async () => {
        const document = await loadedDocument(() => {
            insertAll([GOOD_FIRST, NUL_RULE, GOOD_LAST]);
        });

        expect(document).not.toContain(NUL);
    });
});
