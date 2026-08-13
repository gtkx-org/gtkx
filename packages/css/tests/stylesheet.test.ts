import { CssProvider } from "@gtkx/gi/gtk";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
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
const PROBE_CLASS = "gtkx-probe";
const ROOT = join(import.meta.dirname, "..", "..", "..");
const CREATE_CSS = pathToFileURL(join(import.meta.dirname, "..", "src", "create-css.ts")).href;
const runNode = promisify(execFile);

const DROPPED_RULES: RuleCase[] = [
    { kind: "an unbalanced parenthesis", rule: ".broken{color:rgb(0;font-weight:bold;};}" },
    { kind: "an unterminated string", rule: '.broken{font-family:"Cantarell;}' },
    { kind: "an unterminated comment", rule: ".broken{color:red;/*}" },
    { kind: "a newline inside a string", rule: ".broken{content:'Canta\nrell';}" },
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
    { kind: "a rule that spells the probe and then opens a url", rule: `.${PROBE_CLASS}{color:rgb(0, 0, 0);b:url(}` },
    { kind: "a rule that spells the probe and then opens a parenthesis", rule: `.${PROBE_CLASS}{color:rgb(0;}` },
    { kind: "a rule that spells the probe and then opens a comment", rule: `.${PROBE_CLASS}{color:rgb(0, 0, 0);/*}` },
];

const KEPT_RULES: RuleCase[] = [
    { kind: "a selector carrying a pseudo-class", rule: ".kept:hover{color:red;}" },
    { kind: "a descendant selector", rule: "window.demo .kept{color:red;}" },
    { kind: "a media query around a rule", rule: "@media (prefers-color-scheme: dark){.dark{color:red;}}" },
    { kind: "an at-rule statement", rule: '@import url("theme.css");' },
    { kind: "an at-rule that carries a block", rule: "@keyframes gtkx-spin{from{opacity:0;}to{opacity:1;}}" },
    { kind: "a color definition", rule: "@define-color mine rgb(1, 2, 3);" },
    { kind: "an unquoted url carrying a comment opener", rule: URL_RULE },
    { kind: "brackets sitting inside a string and a comment", rule: '.quoted{font-family:"Cantarell{(";/* } ( */}' },
];

const REPORTED_RULES: RuleCase[] = [
    { kind: "a declaration GTK4 does not recognize", rule: ".kept{not-a-real-property:1;}" },
    { kind: "an at-rule GTK4 does not recognize", rule: '@charset "utf-8";' },
];

const CHILD_SOURCE = [
    `const { createCss } = await import(${JSON.stringify(CREATE_CSS)});`,
    "const { css } = createCss();",
    'css({ backgroundImage: "url(" });',
    String.raw`css({ fontFamily: "'Canta\nrell'" });`,
    'css({ color: "rgb(0, 0, 255)" });',
    "await Promise.resolve();",
    "await Promise.resolve();",
].join("\n");

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

const manyRules = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `.many-${String(index)}{color:rgb(0, 0, ${String(index)});}`);

const loadsFor = async (count: number): Promise<number> => {
    const { loadedDocuments } = await applied(() => {
        insertAll(manyRules(count));
    });

    return loadedDocuments.length;
};

const connectionsFor = async (count: number): Promise<number> => {
    const connect = vi.spyOn(CssProvider.prototype, "on");

    try {
        await applied(() => {
            insertAll(manyRules(count));
        });

        return connect.mock.calls.length;
    } finally {
        connect.mockRestore();
    }
};

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

const styleThroughForgedProbe = (): void => {
    const { css, injectGlobal } = createCss();
    injectGlobal(`.${PROBE_CLASS}{color:rgb(0, 0, 0);background-image:url(}`);
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

    it.each(KEPT_RULES)("stays silent about $kind", async ({ rule }) => {
        const { warnings } = await applied(() => {
            insertAll([rule]);
        });

        expect(warnings).toBe("");
    });

    it.each(REPORTED_RULES)("installs $kind and reports what GTK4 rejected in it", async ({ rule }) => {
        const { flushedDocument, warnings } = await applied(() => {
            insertAll([rule]);
        });

        expect(flushedDocument).toContain(rule);
        expect(warnings).toContain("GTK4 rejected CSS");
        expect(warnings).not.toContain(DROP_WARNING);
    });

    it("installs the declarations of a rule whose unquoted url carries a comment opener", async () => {
        const { flushedDocument } = await appliedAround(URL_RULE);
        expect(parsedDocument(flushedDocument)).toContain("--icon: url(https://x.dev/a/*b.png)");
    });

    it("never hands the display a rule of its own", async () => {
        const { loadedDocuments, flushedDocument } = await appliedAround(GOOD_LAST);
        expect(flushedDocument).not.toContain(PROBE_CLASS);
        expect(loadedDocuments.at(-1)).toBe(flushedDocument);
    });
});

describe("StyleSheet, the work one insert costs", () => {
    it("parses each rule once, however many arrive", async () => {
        await loadsFor(1);
        const few = await loadsFor(4);
        const many = await loadsFor(24);
        expect(few).toBe(5);
        expect(many).toBe(25);
    });

    it("checks every rule through one provider", async () => {
        await connectionsFor(1);
        expect(await connectionsFor(4)).toBe(1);
        expect(await connectionsFor(24)).toBe(1);
    });

    it("keeps GTK4 parser output off stdout when a value is malformed", async () => {
        const { stdout, stderr } = await runNode(
            "node",
            ["--import", "tsx", "--input-type=module", "-e", CHILD_SOURCE],
            { cwd: ROOT },
        );

        expect(stdout).toBe("");
        expect(stderr).toContain(DROP_WARNING);
        expect(stderr).toContain("url(");
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

    it("keeps the styles created after a rule that spells out the probe", async () => {
        const { flushedDocument, warnings } = await applied(styleThroughForgedProbe);
        expect(warnings).toContain(DROP_WARNING);
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
