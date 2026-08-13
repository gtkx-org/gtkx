import { CssProvider } from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";
import { createCss } from "../src/create-css.js";
import { StyleSheet } from "../src/stylesheet.js";

type RuleCase = { kind: string; rule: string };
type Applied = { flushedDocument: string; loadedDocuments: string[]; warnings: string };

const NUL = "\u{0}";
const GOOD_FIRST = ".first{color:rgb(255, 0, 0);}";
const GOOD_LAST = ".last{color:rgb(0, 0, 255);}";
const NUL_RULE = `.nul{font-family:"Canta${NUL}rell";}`;
const URL_RULE = ".iconic{--icon:url(https://x.dev/a/*b.png);}";
const DROP_WARNING = "Dropped a malformed CSS rule";

const DROPPED_RULES: RuleCase[] = [
    { kind: "an unbalanced parenthesis", rule: ".broken{color:rgb(0;font-weight:bold;};}" },
    { kind: "an unterminated string", rule: '.broken{font-family:"Cantarell;}' },
    { kind: "an unterminated comment", rule: ".broken{color:red;/*}" },
    { kind: "a block that is never closed", rule: ".broken{color:red;" },
    { kind: "an unquoted url that never closes", rule: ".broken{--icon:url(https://x.dev/a/*b.png;}" },
    { kind: "a comment opener inside a function named after a url", rule: ".broken{--icon:myurl(a/*b);}" },
    { kind: "a declaration with no selector around it", rule: "font-weight:bold;" },
    { kind: "a declaration that never reaches its semicolon", rule: "font-weight:bold" },
    { kind: "a stray semicolon after a closed block", rule: ".broken{color:red;};" },
    { kind: "a selector left dangling after a closed block", rule: ".broken{color:red;}.dangling" },
    { kind: "an at-rule statement that never reaches its semicolon", rule: '@import url("theme.css")' },
    { kind: "an at-rule with an empty name", rule: "@;" },
    { kind: "a lone semicolon", rule: ";" },
];

const KEPT_RULES: RuleCase[] = [
    { kind: "a selector carrying a pseudo-class", rule: ".kept:hover{color:red;}" },
    { kind: "a descendant selector", rule: "window.demo .kept{color:red;}" },
    { kind: "a media query around a rule", rule: "@media (prefers-color-scheme: dark){.dark{color:red;}}" },
    { kind: "an at-rule statement", rule: '@import url("theme.css");' },
    { kind: "an at-rule that carries a block", rule: "@keyframes gtkx-spin{from{opacity:0;}to{opacity:1;}}" },
    { kind: "a declaration GTK4 does not recognize", rule: ".kept{not-a-real-property:1;}" },
    { kind: "an unquoted url carrying a comment opener", rule: URL_RULE },
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

const applied = async (write: () => void): Promise<Applied> => {
    const warnings: string[] = [];

    const warn = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
        warnings.push(String(chunk));

        return true;
    });

    const load = vi.spyOn(CssProvider.prototype, "loadFromString");

    try {
        write();
        const beforeFlush = load.mock.calls.length;
        await flushMicrotasks();
        const loadedDocuments = load.mock.calls.map(([text]) => text);

        return {
            flushedDocument: loadedDocuments.slice(beforeFlush).at(-1) ?? "",
            loadedDocuments,
            warnings: warnings.join(""),
        };
    } finally {
        load.mockRestore();
        warn.mockRestore();
    }
};

const appliedAround = async (rule: string): Promise<Applied> =>
    applied(() => {
        insertAll([GOOD_FIRST, rule, GOOD_LAST]);
    });

const ignoreParsingError = (): undefined => undefined;

const parsedDocument = (document: string): string => {
    const provider = new CssProvider();
    provider.on("parsing-error", ignoreParsingError);
    provider.loadFromString(document);

    return provider.toString();
};

const hasSelector = (parsed: string, selector: string): boolean => parsed.split("\n").includes(`${selector} {`);

const styleThroughUnclosedValue = (): void => {
    const { css } = createCss();
    css({ color: "rgb(255, 0, 0)" });
    css({ color: "rgb(0", fontWeight: "bold" });
    css({ color: "rgb(0, 0, 255)" });
};

const styleThroughValueClosingEarly = (): void => {
    const { css } = createCss();
    css({ color: "rgb(255, 0, 0)" });
    css({ color: "} font-weight:bold" });
    css({ color: "rgb(0, 0, 255)" });
};

const styleThroughUnscopedDeclarations = (): void => {
    const { css, injectGlobal } = createCss();
    injectGlobal({ color: "rgb(255, 0, 0)" });
    css({ color: "rgb(0, 0, 255)" });
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
        const { warnings } = await applied(() => {
            insertAll([".bad { not-a-real-property: 1; }"]);
        });

        expect(warnings).toContain("[gtkx:css]");
        expect(warnings).toContain("GTK4 rejected CSS");
    });
});

describe("StyleSheet, rules GTK4 would not parse whole", () => {
    it.each(DROPPED_RULES)("keeps the rules inserted after $kind", async ({ rule }) => {
        const { flushedDocument } = await appliedAround(rule);
        const parsed = parsedDocument(flushedDocument);
        expect(hasSelector(parsed, ".first")).toBe(true);
        expect(hasSelector(parsed, ".last")).toBe(true);
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it.each(DROPPED_RULES)("warns and names the rule it drops for $kind", async ({ rule }) => {
        const { flushedDocument, warnings } = await applied(() => {
            insertAll([rule]);
        });

        expect(warnings).toContain("[gtkx:css]");
        expect(warnings).toContain(DROP_WARNING);
        expect(warnings).toContain(rule);
        expect(flushedDocument).toBe("");
    });
});

describe("StyleSheet, rules GTK4 parses whole", () => {
    it.each(KEPT_RULES)("installs $kind", async ({ rule }) => {
        const { flushedDocument } = await appliedAround(rule);
        const parsed = parsedDocument(flushedDocument);
        expect(flushedDocument).toContain(rule);
        expect(hasSelector(parsed, ".first")).toBe(true);
        expect(hasSelector(parsed, ".last")).toBe(true);
    });

    it.each(KEPT_RULES)("never reports $kind as malformed", async ({ rule }) => {
        const { warnings } = await applied(() => {
            insertAll([rule]);
        });

        expect(warnings).not.toContain(DROP_WARNING);
    });

    it("installs the declarations of a rule whose unquoted url carries a comment opener", async () => {
        const { flushedDocument } = await appliedAround(URL_RULE);
        expect(parsedDocument(flushedDocument)).toContain("--icon: url(https://x.dev/a/*b.png)");
    });

    it("installs a rule whose brackets sit inside a string or a comment", async () => {
        const { flushedDocument } = await applied(() => {
            insertAll(['.quoted{font-family:"Cantarell{(";/* } ( */}']);
        });

        expect(parsedDocument(flushedDocument)).toContain(".quoted");
    });
});

describe("StyleSheet, styles written through css and injectGlobal", () => {
    it("keeps the styles created after a value that never closes", async () => {
        const { flushedDocument } = await applied(styleThroughUnclosedValue);
        const parsed = parsedDocument(flushedDocument);
        expect(parsed).toContain("rgb(255,0,0)");
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it("keeps the styles created after a value that closes the rule early", async () => {
        const { flushedDocument } = await applied(styleThroughValueClosingEarly);
        const parsed = parsedDocument(flushedDocument);
        expect(parsed).toContain("rgb(255,0,0)");
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it("drops declarations injected without a selector and keeps the styles after them", async () => {
        const { flushedDocument, warnings } = await applied(styleThroughUnscopedDeclarations);
        expect(warnings).toContain(DROP_WARNING);
        expect(warnings).toContain("color:rgb(255, 0, 0);");
        expect(parsedDocument(flushedDocument)).toContain("rgb(0,0,255)");
    });

    it("keeps a style injected with an unquoted url carrying a comment opener", async () => {
        const { flushedDocument } = await applied(() => {
            const { injectGlobal } = createCss();
            injectGlobal(URL_RULE);
            injectGlobal(GOOD_LAST);
        });

        const parsed = parsedDocument(flushedDocument);
        expect(parsed).toContain("--icon: url(https://x.dev/a/*b.png)");
        expect(parsed).toContain("rgb(0,0,255)");
    });
});

describe("StyleSheet, values GTK4 cannot load", () => {
    it("stays alive when an interpolated style value carries a NUL byte", async () => {
        const { warnings } = await applied(() => {
            const { injectGlobal } = createCss();
            injectGlobal({ fontFamily: `"Canta${NUL}rell"` });
        });

        expect(warnings).toContain("[gtkx:css]");
        expect(warnings).toContain("NUL byte");
        expect(warnings).toContain(String.raw`Canta\0rell`);
    });

    it("keeps the rules inserted after one carrying a NUL byte", async () => {
        const { flushedDocument } = await appliedAround(NUL_RULE);
        const parsed = parsedDocument(flushedDocument);
        expect(hasSelector(parsed, ".first")).toBe(true);
        expect(hasSelector(parsed, ".last")).toBe(true);
        expect(parsed).toContain("rgb(0,0,255)");
    });

    it("never hands a provider a document carrying a NUL byte", async () => {
        const { loadedDocuments } = await applied(() => {
            insertAll([GOOD_FIRST, NUL_RULE, GOOD_LAST]);
        });

        expect(loadedDocuments.length).toBeGreaterThan(0);

        for (const text of loadedDocuments) {
            expect(text).not.toContain(NUL);
        }
    });
});
