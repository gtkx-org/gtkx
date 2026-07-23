import type * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

type Has<T, K extends PropertyKey> = K extends keyof T ? true : false;

describe("generated property types", () => {
    it("types each property with its accessor type", () => {
        const button = new Gtk.Button({ label: "Send" });

        const types: [
            Expect<Equal<Gtk.ButtonProperties["label"], string>>,
            Expect<Equal<Gtk.ButtonProperties["child"], Gtk.Widget | null>>,
            Expect<Equal<Gtk.LabelProperties["wrap"], boolean>>,
        ] = [true, true, true];

        expect(types).toEqual([true, true, true]);
        expect(button.label).toBe("Send");
    });

    it("inherits ancestor properties instead of re-listing them", () => {
        const inherited: [
            Expect<Equal<Gtk.ButtonProperties["visible"], boolean>>,
            Expect<Equal<Gtk.WidgetProperties["visible"], boolean>>,
        ] = [true, true];

        expect(inherited).toEqual([true, true]);
    });

    it("carries properties contributed by implemented interfaces", () => {
        const contributed: [
            Expect<Equal<Gtk.ButtonProperties["actionTarget"], GLib.Variant | null>>,
            Expect<Equal<Gtk.ButtonProperties["actionTarget"], Gtk.Button["actionTarget"]>>,
        ] = [true, true];

        expect(contributed).toEqual([true, true]);
    });

    it("excludes methods and write-only properties", () => {
        const excluded: [
            Expect<Equal<Has<Gtk.ButtonProperties, "setLabel">, false>>,
            Expect<Equal<Has<Gtk.ButtonProperties, "connect">, false>>,
            Expect<Equal<Has<Gtk.CheckButtonProperties, "active">, true>>,
            Expect<Equal<Has<Gtk.CheckButtonProperties, "group">, false>>,
        ] = [true, true, true, true];

        expect(excluded).toEqual([true, true, true, true]);
    });
});
