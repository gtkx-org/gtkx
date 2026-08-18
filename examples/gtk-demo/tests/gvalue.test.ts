import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import { describe, expect, it } from "vitest";

describe("content providers the gesture demos build", () => {
    it("carries a string payload under gchararray", () => {
        const provider = Gdk.ContentProvider.newForValue("payload");
        expect(provider.refFormats().containGtype(GObject.TYPE_STRING)).toBe(true);
    });

    it("carries a color payload under GdkRGBA", () => {
        const rgba = new Gdk.RGBA();
        rgba.parse("#804080");
        const provider = Gdk.ContentProvider.newForValue(rgba);
        expect(provider.refFormats().containGtype(GObject.typeFromName("GdkRGBA"))).toBe(true);
    });

    it("carries a file payload under GFile once the value names that interface", () => {
        const value = new GObject.Value();
        value.init(Gio.File.prototype.__type__);
        value.setObject(Gio.File.newForPath("/tmp"));
        const provider = Gdk.ContentProvider.newForValue(value);
        expect(provider.refFormats().containGtype(Gio.File.prototype.__type__)).toBe(true);
    });

    it("carries the concrete type of a file passed on its own, which no GFile drop target matches", () => {
        const provider = Gdk.ContentProvider.newForValue(Gio.File.newForPath("/tmp"));
        expect(provider.refFormats().containGtype(Gio.File.prototype.__type__)).toBe(false);
    });
});
