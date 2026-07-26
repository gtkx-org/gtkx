import type * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, expectTypeOf, it } from "vitest";

type Has<T, K extends PropertyKey> = K extends keyof T ? true : false;

describe("generated property types", () => {
    it("types each property with its accessor type", () => {
        const button = new Gtk.Button({ label: "Send" });
        expectTypeOf<Gtk.ButtonProperties["label"]>().toEqualTypeOf<string>();
        expectTypeOf<Gtk.ButtonProperties["child"]>().toEqualTypeOf<Gtk.Widget | null>();
        expectTypeOf<Gtk.LabelProperties["wrap"]>().toEqualTypeOf<boolean>();
        expect(button.label).toBe("Send");
    });

    it("inherits ancestor properties instead of re-listing them", () => {
        expectTypeOf<Gtk.ButtonProperties["visible"]>().toEqualTypeOf<boolean>();
        expectTypeOf<Gtk.WidgetProperties["visible"]>().toEqualTypeOf<boolean>();
    });

    it("carries properties contributed by implemented interfaces", () => {
        expectTypeOf<Gtk.ButtonProperties["actionTarget"]>().toEqualTypeOf<GLib.Variant | null>();
        expectTypeOf<Gtk.ButtonProperties["actionTarget"]>().toEqualTypeOf<Gtk.Button["actionTarget"]>();
    });

    it("excludes methods and write-only properties", () => {
        expectTypeOf<Has<Gtk.ButtonProperties, "setLabel">>().toEqualTypeOf<false>();
        expectTypeOf<Has<Gtk.ButtonProperties, "connect">>().toEqualTypeOf<false>();
        expectTypeOf<Has<Gtk.CheckButtonProperties, "active">>().toEqualTypeOf<true>();
        expectTypeOf<Has<Gtk.CheckButtonProperties, "group">>().toEqualTypeOf<false>();
    });
});
