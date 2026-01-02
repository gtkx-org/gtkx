import { describe, expect, it } from "vitest";
import { GIRS_TO_SYNC } from "../../src/commands/sync.js";

describe("GIRS_TO_SYNC", () => {
    it("is a Set", () => {
        expect(GIRS_TO_SYNC).toBeInstanceOf(Set);
    });

    it("contains core GLib files", () => {
        expect(GIRS_TO_SYNC.has("GLib-2.0.gir")).toBe(true);
        expect(GIRS_TO_SYNC.has("GObject-2.0.gir")).toBe(true);
        expect(GIRS_TO_SYNC.has("Gio-2.0.gir")).toBe(true);
    });

    it("contains GTK4 files", () => {
        expect(GIRS_TO_SYNC.has("Gtk-4.0.gir")).toBe(true);
        expect(GIRS_TO_SYNC.has("Gdk-4.0.gir")).toBe(true);
        expect(GIRS_TO_SYNC.has("Gsk-4.0.gir")).toBe(true);
    });

    it("contains Adwaita files", () => {
        expect(GIRS_TO_SYNC.has("Adw-1.gir")).toBe(true);
    });

    it("contains graphics-related files", () => {
        expect(GIRS_TO_SYNC.has("cairo-1.0.gir")).toBe(true);
        expect(GIRS_TO_SYNC.has("Pango-1.0.gir")).toBe(true);
        expect(GIRS_TO_SYNC.has("GdkPixbuf-2.0.gir")).toBe(true);
    });

    it("contains WebKit files", () => {
        expect(GIRS_TO_SYNC.has("WebKit-6.0.gir")).toBe(true);
    });

    it("all entries end with .gir extension", () => {
        for (const file of GIRS_TO_SYNC) {
            expect(file).toMatch(/\.gir$/);
        }
    });

    it("has expected number of entries", () => {
        expect(GIRS_TO_SYNC.size).toBeGreaterThan(20);
    });
});
