import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

type Untyped = (...args: unknown[]) => unknown;

const untypedEscape = GLib.Uri.escapeString.bind(GLib.Uri) as Untyped;
const untypedUnescape = GLib.Uri.unescapeString.bind(GLib.Uri) as Untyped;
const untypedParse = GLib.Uri.parse.bind(GLib.Uri) as Untyped;
const untypedAcceleratorParse = Gtk.acceleratorParse as Untyped;

describe("required argument enforcement", () => {
    it("passes calls providing every required argument", () => {
        expect(GLib.Uri.escapeString("a b", null, false)).toBe("a%20b");
        expect(GLib.Uri.parse("https://example.com/", GLib.UriFlags.NONE).getHost()).toBe("example.com");
        expect(Gtk.acceleratorParse("<Control>a")).toEqual([true, expect.any(Number), expect.any(Number)]);
        const label = Gtk.Label.new("initial");
        label.setText("updated");
        expect(label.getText()).toBe("updated");
    });

    it("still allows omitting or skipping nullable arguments", () => {
        expect(untypedUnescape("a%20b")).toBe("a b");
        expect(untypedUnescape("a%20b", undefined)).toBe("a b");
        expect(untypedEscape("a b", undefined, true)).toBe("a%20b");
        expect(Gtk.Label.new(null).getText()).toBe("");
    });

    it("ignores extra trailing arguments", () => {
        expect(untypedUnescape("a%20b", null, "extra")).toBe("a b");
    });

    it("throws when every required argument is missing", () => {
        expect(() => untypedEscape()).toThrow();
        expect(() => untypedParse()).toThrow();
        expect(() => untypedAcceleratorParse()).toThrow();
    });

    it("throws when a later required argument is missing", () => {
        expect(() => untypedEscape("a b")).toThrow();
        expect(() => untypedEscape("a b", null)).toThrow();
        expect(() => untypedEscape("a b", null, undefined)).toThrow();
        expect(() => untypedParse("https://example.com/")).toThrow();
    });

    it("throws when a required method argument is missing", () => {
        const label = Gtk.Label.new("initial");
        const setText = label.setText.bind(label) as Untyped;
        expect(() => setText()).toThrow();
        expect(() => setText(undefined)).toThrow();
    });
});
