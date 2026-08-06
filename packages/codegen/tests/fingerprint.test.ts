import { describe, expect, it } from "vitest";
import { computeGiFingerprint, computeJsxFingerprint, type JsxFingerprintInput } from "../src/fingerprint.js";

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

describe("computeGiFingerprint", () => {
    it("changes when the libraries change", () => {
        expect(computeGiFingerprint([], ["Gtk-4.0"], []).value).not.toBe(computeGiFingerprint([], ["Adw-1"], []).value);
    });

    it("changes when the GIR search path changes", () => {
        const base = computeGiFingerprint([], ["Gtk-4.0"], ["/usr/share/gir-1.0"]).value;
        expect(computeGiFingerprint([], ["Gtk-4.0"], ["/opt/gir-1.0"]).value).not.toBe(base);
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
