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
} from "../src/fingerprint.js";

const docsInput: DocsFingerprintInput = { basePath: "/api", props: {}, omittedProps: {} };

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
        storeDir = mkdtempSync(join(tmpdir(), "gtkx-fingerprint-"));
    });

    afterEach(() => {
        rmSync(storeDir, { recursive: true, force: true });
    });

    it("accepts a sentinel it wrote itself", () => {
        writeSentinel(storeDir, computeGiFingerprint([], ["Gtk-4.0"], []));
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(true);
    });

    it("treats a sentinel whose libraries are not strings as stale", () => {
        writeSentinel(storeDir, { value: "cafe", girFiles: [], libraries: [1, 2], girPath: [] });
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(false);
    });

    it("treats a sentinel whose GIR search path is not strings as stale", () => {
        writeSentinel(storeDir, { value: "cafe", girFiles: [], libraries: ["Gtk-4.0"], girPath: [7, 9] });
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], ["/usr/share/gir-1.0"])).toBe(false);
    });

    it("treats a sentinel whose recorded GIR files are not strings as stale", () => {
        writeSentinel(storeDir, { value: "cafe", girFiles: [null], libraries: ["Gtk-4.0"], girPath: [] });
        expect(isGiStoreFresh(storeDir, ["Gtk-4.0"], [])).toBe(false);
    });
});

describe("isDocsOutputFresh", () => {
    let outDir: string;

    beforeEach(() => {
        outDir = mkdtempSync(join(tmpdir(), "gtkx-docs-fingerprint-"));
    });

    afterEach(() => {
        rmSync(outDir, { recursive: true, force: true });
    });

    it("accepts a sentinel it wrote itself", () => {
        writeSentinel(outDir, computeDocsFingerprint([], ["Gtk-4.0"], [], docsInput));
        expect(isDocsOutputFresh(outDir, ["Gtk-4.0"], [], docsInput)).toBe(true);
    });

    it("treats a sentinel whose recorded libraries are not strings as stale", () => {
        writeSentinel(outDir, { value: "cafe", gi: { value: "cafe", girFiles: [], libraries: [1, 2], girPath: [] } });
        expect(isDocsOutputFresh(outDir, ["Gtk-4.0"], [], docsInput)).toBe(false);
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
