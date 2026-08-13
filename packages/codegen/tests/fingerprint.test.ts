import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    computeDocsFingerprint,
    computeGiFingerprint,
    computeJsxFingerprint,
    type DocsFingerprintInput,
    FINGERPRINT_FILENAME,
    isDocsOutputFresh,
    isGiStoreFresh,
    type JsxFingerprintInput,
    jsxStoreFreshness,
} from "../src/fingerprint.js";

const docsInput: DocsFingerprintInput = { basePath: "/api", props: {}, omittedProps: {} };

const FOREIGN_SENTINELS: [string, unknown][] = [
    ["an empty object", {}],
    ["a package manifest", { version: "1.0.0" }],
    ["null", null],
    ["an array", []],
    ["a bare string", "fresh"],
];

const GI_SENTINELS: [string, unknown][] = [
    ...FOREIGN_SENTINELS,
    ["no recorded inputs", { value: "cafe" }],
    ["no recorded libraries", { value: "cafe", girFiles: [] }],
    ["no recorded GIR files", { value: "cafe", libraries: ["Gtk-4.0"] }],
    ["a value that is not a string", { value: 7, girFiles: [], libraries: ["Gtk-4.0"], girPath: [] }],
    ["libraries that are a bare string", { value: "cafe", girFiles: [], libraries: "Gtk-4.0", girPath: [] }],
    ["libraries that are not strings", { value: "cafe", girFiles: [], libraries: [1, 2], girPath: [] }],
    ["a search path that is an object", { value: "cafe", girFiles: [], libraries: ["Gtk-4.0"], girPath: {} }],
    ["a search path that is not strings", { value: "cafe", girFiles: [], libraries: ["Gtk-4.0"], girPath: [7, 9] }],
    ["GIR files that are not strings", { value: "cafe", girFiles: [null], libraries: ["Gtk-4.0"], girPath: [] }],
];

const DOCS_SENTINELS: [string, unknown][] = [
    ...FOREIGN_SENTINELS,
    ["no recorded GIR fingerprint", { value: "cafe" }],
    ["a GIR fingerprint that is a bare string", { value: "cafe", gi: "cafe" }],
    ["no value", { gi: { value: "cafe", girFiles: [], libraries: ["Gtk-4.0"], girPath: [] } }],
    ...GI_SENTINELS.map(([name, gi]): [string, unknown] => [`${name} under gi`, { value: "cafe", gi }]),
];

const JSX_SENTINELS: [string, unknown][] = [
    ...FOREIGN_SENTINELS,
    ["no value", { intrinsicElementCount: 12 }],
];

const JSX_ELEMENT_COUNTS: [string, unknown][] = [
    ["absent", undefined],
    ["a string", "12"],
    ["null", null],
    ["an array", [12]],
];

const docsFingerprint = (overrides: Partial<DocsFingerprintInput> = {}): string =>
    computeDocsFingerprint([], ["Gtk-4.0"], [], { ...docsInput, ...overrides }).value;

const jsxInput = (overrides: Partial<JsxFingerprintInput> = {}): JsxFingerprintInput => ({
    reactVersion: "1.0.0",
    components: {},
    lazyElements: [],
    props: {},
    omittedProps: {},
    ...overrides,
});

const jsxFingerprint = (overrides: Partial<JsxFingerprintInput> = {}, intrinsicElementCount = 0): string =>
    computeJsxFingerprint(jsxInput(overrides), intrinsicElementCount).value;

const writeSentinel = (dir: string, sentinel: unknown): void => {
    writeFileSync(join(dir, FINGERPRINT_FILENAME), JSON.stringify(sentinel));
};

const sentinelDir = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix));

describe("computeGiFingerprint", () => {
    it("changes when the libraries change", () => {
        expect(computeGiFingerprint([], ["Gtk-4.0"], []).value).not.toBe(computeGiFingerprint([], ["Adw-1"], []).value);
    });

    it("changes when the GIR search path changes", () => {
        const base = computeGiFingerprint([], ["Gtk-4.0"], ["/usr/share/gir-1.0"]).value;
        expect(computeGiFingerprint([], ["Gtk-4.0"], ["/opt/gir-1.0"]).value).not.toBe(base);
    });
});

describe("isGiStoreFresh", () => {
    let storeDir: string;

    beforeEach(() => {
        storeDir = sentinelDir("gtkx-fingerprint-");
    });

    afterEach(() => {
        rmSync(storeDir, { recursive: true, force: true });
    });

    it("accepts a sentinel it wrote itself", () => {
        writeSentinel(storeDir, computeGiFingerprint([], ["Gtk-4.0"], []));
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(true);
    });

    it("accepts a sentinel that recorded no GIR search path", () => {
        writeSentinel(storeDir, { ...computeGiFingerprint([], ["Gtk-4.0"], []), girPath: undefined });
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(true);
    });

    it("treats a sentinel recorded for other libraries as stale", () => {
        writeSentinel(storeDir, computeGiFingerprint([], ["Adw-1"], []));
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(false);
    });

    it.each(GI_SENTINELS)("treats a sentinel with %s as stale", (_name, sentinel) => {
        writeSentinel(storeDir, sentinel);
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(false);
    });
});

describe("computeDocsFingerprint", () => {
    it("changes when the base path changes", () => {
        expect(docsFingerprint({ basePath: "/reference" })).not.toBe(docsFingerprint());
    });

    it("changes when the element props change", () => {
        const props = { GtkWidget: { module: "@gtkx/react/internal", export: "GtkWidgetProps" } };
        expect(docsFingerprint({ props })).not.toBe(docsFingerprint());
    });

    it("changes when the omitted props change", () => {
        expect(docsFingerprint({ omittedProps: { GtkButton: ["child"] } })).not.toBe(docsFingerprint());
    });

    it("changes when the GIR inputs change while the docs inputs hold", () => {
        expect(computeDocsFingerprint([], ["Adw-1"], [], docsInput).value).not.toBe(docsFingerprint());
    });
});

describe("isDocsOutputFresh", () => {
    let outDir: string;

    beforeEach(() => {
        outDir = sentinelDir("gtkx-docs-fingerprint-");
    });

    afterEach(() => {
        rmSync(outDir, { recursive: true, force: true });
    });

    it("accepts a sentinel it wrote itself", () => {
        writeSentinel(outDir, computeDocsFingerprint([], ["Gtk-4.0"], [], docsInput));
        expect(isDocsOutputFresh(outDir, ["Gtk-4.0"], [], docsInput)).toBe(true);
    });

    it("treats a sentinel recorded for other docs inputs as stale", () => {
        writeSentinel(outDir, computeDocsFingerprint([], ["Gtk-4.0"], [], { ...docsInput, basePath: "/reference" }));
        expect(isDocsOutputFresh(outDir, ["Gtk-4.0"], [], docsInput)).toBe(false);
    });

    it.each(DOCS_SENTINELS)("treats a sentinel with %s as stale", (_name, sentinel) => {
        writeSentinel(outDir, sentinel);
        expect(isDocsOutputFresh(outDir, ["Gtk-4.0"], [], docsInput)).toBe(false);
    });
});

describe("jsxStoreFreshness", () => {
    let storeDir: string;

    beforeEach(() => {
        storeDir = sentinelDir("gtkx-jsx-fingerprint-");
    });

    afterEach(() => {
        rmSync(storeDir, { recursive: true, force: true });
    });

    it("accepts a sentinel it wrote itself and reports the element count it recorded", () => {
        writeSentinel(storeDir, computeJsxFingerprint(jsxInput(), 12));
        expect(jsxStoreFreshness(storeDir, jsxInput())).toEqual({ isFresh: true, intrinsicElementCount: 12 });
    });

    it.each(JSX_SENTINELS)("treats a sentinel with %s as stale", (_name, sentinel) => {
        writeSentinel(storeDir, sentinel);
        expect(jsxStoreFreshness(storeDir, jsxInput())).toEqual({ isFresh: false, intrinsicElementCount: 0 });
    });

    it.each(JSX_ELEMENT_COUNTS)("treats a matching sentinel whose element count is %s as stale", (_name, count) => {
        writeSentinel(storeDir, { value: jsxFingerprint(), intrinsicElementCount: count });
        expect(jsxStoreFreshness(storeDir, jsxInput())).toEqual({ isFresh: false, intrinsicElementCount: 0 });
    });
});

describe("computeJsxFingerprint", () => {
    it("changes when component overrides change", () => {
        const withComponent = jsxFingerprint({
            components: { GtkButton: { module: "@example/wrappers", export: "withButton" } },
        });

        expect(withComponent).not.toBe(jsxFingerprint());
    });

    it("changes when the lazy element set changes", () => {
        expect(jsxFingerprint({ lazyElements: ["GtkStackPage"] })).not.toBe(jsxFingerprint());
    });

    it("changes when the base props change", () => {
        const withProps = jsxFingerprint({
            props: { GtkButton: { module: "@gtkx/react/internal", export: "ChildrenProps" } },
        });

        expect(withProps).not.toBe(jsxFingerprint());
    });

    it("changes when the omitted props change", () => {
        expect(jsxFingerprint({ omittedProps: { AdwBin: ["child"] } })).not.toBe(jsxFingerprint());
    });

    it("is stable regardless of omitted prop order", () => {
        const a = jsxFingerprint({ omittedProps: { AdwBottomSheet: ["content", "sheet"] } });
        const b = jsxFingerprint({ omittedProps: { AdwBottomSheet: ["sheet", "content"] } });
        expect(a).toBe(b);
    });

    it("is stable regardless of component key order", () => {
        const a = jsxFingerprint({
            components: { GtkButton: { module: "m", export: "a" }, GtkLabel: { module: "n", export: "b" } },
        });

        const b = jsxFingerprint({
            components: { GtkLabel: { module: "n", export: "b" }, GtkButton: { module: "m", export: "a" } },
        });

        expect(a).toBe(b);
    });

    it("does not depend on the intrinsic element count", () => {
        expect(jsxFingerprint({}, 5)).toBe(jsxFingerprint({}, 10));
    });
});
