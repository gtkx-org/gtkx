import { describe, expect, it } from "vitest";
import { computeGiFingerprint, computeJsxFingerprint, type JsxFingerprintInput } from "../src/fingerprint.js";

const jsxInput = (overrides: Partial<JsxFingerprintInput> = {}): JsxFingerprintInput => ({
    reactVersion: "1.0.0",
    components: {},
    lazyElements: [],
    props: {},
    ...overrides,
});

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
        const base = computeJsxFingerprint(jsxInput(), 0).value;

        const withComponent = computeJsxFingerprint(
            jsxInput({ components: { GtkButton: { module: "@example/wrappers", export: "withButton" } } }),
            0,
        ).value;

        expect(withComponent).not.toBe(base);
    });

    it("changes when the lazy element set changes", () => {
        const base = computeJsxFingerprint(jsxInput(), 0).value;
        expect(computeJsxFingerprint(jsxInput({ lazyElements: ["GtkStackPage"] }), 0).value).not.toBe(base);
    });

    it("changes when the base props change", () => {
        const base = computeJsxFingerprint(jsxInput(), 0).value;

        const withProps = computeJsxFingerprint(
            jsxInput({ props: { GtkButton: { module: "@gtkx/react/internal", export: "ChildrenProps" } } }),
            0,
        ).value;

        expect(withProps).not.toBe(base);
    });

    it("is stable regardless of component key order", () => {
        const a = computeJsxFingerprint(
            jsxInput({
                components: { GtkButton: { module: "m", export: "a" }, GtkLabel: { module: "n", export: "b" } },
            }),
            0,
        ).value;

        const b = computeJsxFingerprint(
            jsxInput({
                components: { GtkLabel: { module: "n", export: "b" }, GtkButton: { module: "m", export: "a" } },
            }),
            0,
        ).value;

        expect(a).toBe(b);
    });

    it("does not depend on the intrinsic element count", () => {
        expect(computeJsxFingerprint(jsxInput(), 5).value).toBe(computeJsxFingerprint(jsxInput(), 10).value);
    });
});
