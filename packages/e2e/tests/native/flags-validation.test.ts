import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const KEY_A = 97;

const getAllBits = (flags: Record<string, string | number>): number =>
    Object.values(flags)
        .filter((value): value is number => typeof value === "number")
        .reduce((mask, value) => mask | value, 0);

describe("flags argument validation", () => {
    it("accepts a valid combination of registered flags", () => {
        const label = Gtk.acceleratorGetLabel(KEY_A, Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.SHIFT_MASK);
        expect(label.length).toBeGreaterThan(0);
    });

    it("accepts a valid combination of flags without a GType", () => {
        const formatted = GLib.formatSizeFull(2048n, GLib.FormatSizeFlags.IEC_UNITS | GLib.FormatSizeFlags.LONG_FORMAT);
        expect(formatted).toContain("KiB");
    });

    it("accepts zero", () => {
        expect(Gtk.acceleratorGetLabel(KEY_A, 0).length).toBeGreaterThan(0);
        expect(GLib.formatSizeFull(1000n, GLib.FormatSizeFlags.DEFAULT).length).toBeGreaterThan(0);
    });

    it("accepts the union of every defined bit", () => {
        expect(Gtk.acceleratorGetLabel(KEY_A, getAllBits(Gdk.ModifierType)).length).toBeGreaterThan(0);
        const keyFile = GLib.KeyFile.new();
        const data = "[group]\nkey=1\n";
        expect(keyFile.loadFromData(data, data.length, getAllBits(GLib.KeyFileFlags))).toBe(true);
    });

    it("rejects a bit outside registered flags", () => {
        expect(() => Gtk.acceleratorGetLabel(KEY_A, 1 << 15)).toThrow();
    });

    it("rejects a valid bit combined with an undefined bit", () => {
        expect(() => Gtk.acceleratorGetLabel(KEY_A, Gdk.ModifierType.CONTROL_MASK | (1 << 15))).toThrow();
    });

    it("rejects a bit outside flags without a GType", () => {
        expect(() => GLib.formatSizeFull(1000n, 1 << 20)).toThrow();
    });
});
