import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { alloc, wrapHandle } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const POINTER_SIZE = 8;
const PATH_BUF_SIZE = POINTER_SIZE * 8;

const pathBuf = (path: string): GLib.PathBuf => {
    const buffer = wrapHandle(alloc(PATH_BUF_SIZE), GLib.PathBuf);
    buffer.initFromPath(path);

    return buffer;
};

describe("a plain struct handed to C", () => {
    it("lends its pointer to a transfer-none parameter", () => {
        const buffer = pathBuf("/usr/bin");
        buffer.push("gtkx");
        expect(buffer.toPath()).toBe("/usr/bin/gtkx");
        buffer.clear();
    });

    it("is bound without the sibling method that would hand it over", () => {
        expect(Object.hasOwn(GLib.PathBuf.prototype, "clearToPath")).toBe(true);
        expect(Object.hasOwn(GLib.PathBuf.prototype, "freeToPath")).toBe(false);
    });
});

describe("plain structs handed back from C", () => {
    it("round-trips an array of them through a transfer-none parameter and a transfer-full return", () => {
        const settings = Gtk.PrintSettings.new();
        settings.setPageRanges([new Gtk.PageRange({ start: 2, end: 5 }), new Gtk.PageRange({ start: 9, end: 11 })]);

        expect(settings.getPageRanges().map((range) => [range.start, range.end])).toEqual([
            [2, 5],
            [9, 11],
        ]);
    });

    it("copies each one, so writing a returned struct leaves the settings alone", () => {
        const settings = Gtk.PrintSettings.new();
        settings.setPageRanges([new Gtk.PageRange({ start: 1, end: 3 })]);
        const returned = settings.getPageRanges()[0];

        if (returned === undefined) {
            throw new Error("the settings should hand back the range that was stored");
        }

        returned.end = 99;
        expect(settings.getPageRanges()[0]?.end).toBe(3);
    });
});
