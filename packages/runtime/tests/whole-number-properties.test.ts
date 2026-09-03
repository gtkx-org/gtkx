import * as Gtk from "@gtkx/gi/gtk";
import { setProperty, t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

type TruncatedCase = { written: number; held: number; described: string };

const TRUNCATED: TruncatedCase[] = [
    { written: 12.7, held: 12, described: "a positive fraction" },
    { written: 0.9, held: 0, described: "a fraction below one" },
    { written: 40, held: 40, described: "a whole number" },
];

describe("whole-number properties", () => {
    it.each(TRUNCATED)("truncates $described toward zero through the generated setter", ({ written, held }) => {
        const label = new Gtk.Label();
        label.marginStart = written;
        expect(label.marginStart).toBe(held);
    });

    it("truncates a fraction written to an enum property", () => {
        const label = new Gtk.Label();
        setProperty(label, "halign", t.enum("libgtk-4.so.1", "gtk_align_get_type", false), 1.9);
        expect(label.halign).toBe(Gtk.Align.START);
    });

    it("truncates a fraction written through setProperty", () => {
        const label = new Gtk.Label();
        setProperty(label, "width-request", t.int32, 99.99);
        expect(label.widthRequest).toBe(99);
    });

    it("truncates a fraction handed to setProperty as an inferred GValue", () => {
        const label = new Gtk.Label();
        label.setProperty("margin-start", 12.7);
        expect(label.marginStart).toBe(12);
    });

    it("leaves a double property its fraction", () => {
        const label = new Gtk.Label();
        label.opacity = 0.37;
        expect(label.opacity).toBeCloseTo(0.37);
    });
});

describe("whole-number properties - values still refused", () => {
    it("throws for a number that is not finite", () => {
        const label = new Gtk.Label();

        expect(() => {
            label.marginStart = NaN;
        }).toThrow();
    });

    it("throws for a number outside the type's range", () => {
        const label = new Gtk.Label();

        expect(() => {
            label.marginStart = 1e12;
        }).toThrow();
    });
});
