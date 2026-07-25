import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/fingerprint.js";

describe("computeFingerprint", () => {
    it("changes when component overrides change", () => {
        const base = computeFingerprint([], ["Gtk-4.0"]);
        const withComponent = computeFingerprint([], ["Gtk-4.0"], {
            components: { GtkButton: { module: "@example/wrappers", export: "withButton" } },
        });
        expect(withComponent).not.toBe(base);
    });

    it("changes when the lazy element set changes", () => {
        const base = computeFingerprint([], ["Gtk-4.0"]);
        expect(computeFingerprint([], ["Gtk-4.0"], { lazyElements: ["GtkStackPage"] })).not.toBe(base);
    });

    it("changes when the react prop-interface surface changes", () => {
        const base = computeFingerprint([], ["Gtk-4.0"]);
        expect(computeFingerprint([], ["Gtk-4.0"], { propInterfaces: { GtkButtonProps: "@gtkx/react" } })).not.toBe(
            base,
        );
    });

    it("is stable regardless of component key order", () => {
        const a = computeFingerprint([], ["Gtk-4.0"], {
            components: { GtkButton: { module: "m", export: "a" }, GtkLabel: { module: "n", export: "b" } },
        });
        const b = computeFingerprint([], ["Gtk-4.0"], {
            components: { GtkLabel: { module: "n", export: "b" }, GtkButton: { module: "m", export: "a" } },
        });
        expect(a).toBe(b);
    });

    it("treats an empty and an omitted react surface alike", () => {
        expect(computeFingerprint([], ["Gtk-4.0"], {})).toBe(computeFingerprint([], ["Gtk-4.0"]));
    });
});
