import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/fingerprint.js";

describe("computeFingerprint", () => {
    it("changes when component overrides change", () => {
        const base = computeFingerprint([], ["Gtk-4.0"]);
        const withComponent = computeFingerprint([], ["Gtk-4.0"], {
            GtkButton: { module: "@example/wrappers", export: "withButton" },
        });
        expect(withComponent).not.toBe(base);
    });

    it("is stable regardless of component key order", () => {
        const a = computeFingerprint([], ["Gtk-4.0"], {
            GtkButton: { module: "m", export: "a" },
            GtkLabel: { module: "n", export: "b" },
        });
        const b = computeFingerprint([], ["Gtk-4.0"], {
            GtkLabel: { module: "n", export: "b" },
            GtkButton: { module: "m", export: "a" },
        });
        expect(a).toBe(b);
    });

    it("treats an empty and an omitted component map alike", () => {
        expect(computeFingerprint([], ["Gtk-4.0"], {})).toBe(computeFingerprint([], ["Gtk-4.0"]));
    });
});
