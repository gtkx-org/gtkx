import type * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

describe("generated signal handler types", () => {
    it("types each signal name with its own handler signature", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.connect("clicked", () => {
            calls += 1;
        });
        button.emit("clicked");

        const signatures: [
            Expect<Equal<Gtk.ButtonSignalHandlers["clicked"], () => void>>,
            Expect<
                Equal<
                    Gtk.RangeSignalHandlers["change-value"],
                    (scroll: Gtk.ScrollType, value: number) => boolean | undefined
                >
            >,
            Expect<Equal<Gtk.WidgetSignalHandlers["notify"], (pspec: GObject.ParamSpec) => void>>,
        ] = [true, true, true];

        expect(signatures).toEqual([true, true, true]);
        expect(calls).toBe(1);
    });

    it("types emit() arguments and result per signal off the emit map", () => {
        const button = new Gtk.Button();
        const result = button.emit("clicked");
        const clickedEmitIsTyped: Expect<Equal<typeof result, void>> = true;
        expect(clickedEmitIsTyped).toBe(true);
        expect(result).toBeUndefined();

        const emitSignatures: [
            Expect<Equal<Gtk.ButtonSignalEmit["clicked"]["result"], void>>,
            Expect<Equal<Gtk.SpinButtonSignalEmit["output"]["result"], boolean>>,
            Expect<Equal<Gtk.SpinButtonSignalEmit["input"]["result"], [number, number]>>,
            Expect<Equal<Gtk.OverlaySignalEmit["get-child-position"]["args"], [widget: Gtk.Widget]>>,
            Expect<Equal<Gtk.OverlaySignalEmit["get-child-position"]["result"], [boolean, Gdk.Rectangle]>>,
        ] = [true, true, true, true, true];

        expect(emitSignatures).toEqual([true, true, true, true, true]);
    });
});
