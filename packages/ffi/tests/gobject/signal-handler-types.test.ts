import type * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

/**
 * Resolves to `true` only when `A` and `B` are the identical type, including
 * function parameter and return positions.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compiles only when its argument is exactly `true`. */
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
            // no-argument signal
            Expect<Equal<Gtk.ButtonSignalHandlers["clicked"], () => void>>,
            // multi-argument signal carrying an enum parameter and a boolean return
            Expect<
                Equal<
                    Gtk.RangeSignalHandlers["change-value"],
                    (scroll: Gtk.ScrollType, value: number) => boolean | undefined
                >
            >,
            // signal inherited from GObject.Object with a cross-namespace parameter
            Expect<Equal<Gtk.WidgetSignalHandlers["notify"], (pspec: GObject.ParamSpec) => void>>,
        ] = [true, true, true];

        expect(signatures).toEqual([true, true, true]);
        expect(calls).toBe(1);
    });

    it("types emit() arguments and result per signal off the emit map", () => {
        const button = new Gtk.Button();
        // The typed overload returns the signal's result (`void` for `clicked`);
        // the untyped `string` fallback would return `unknown`, which a `void`
        // binding rejects — so this assignment only compiles when `emit` is typed.
        const result: void = button.emit("clicked");
        expect(result).toBeUndefined();

        const emitSignatures: [
            // void signal: no arguments, void result
            Expect<Equal<Gtk.ButtonSignalEmit["clicked"]["result"], void>>,
            // non-void, no out-parameters: the concrete value, never the handler's opt-out undefined
            Expect<Equal<Gtk.SpinButtonSignalEmit["output"]["result"], boolean>>,
            // pure scalar out: dropped from the arguments, returned in the result tuple
            Expect<Equal<Gtk.SpinButtonSignalEmit["input"]["result"], [number, number]>>,
            // caller-allocated out: dropped from the arguments (emit allocates it)…
            Expect<Equal<Gtk.OverlaySignalEmit["get-child-position"]["args"], [widget: Gtk.Widget]>>,
            // …and surfaced in the result tuple, so the call needs no cast
            Expect<Equal<Gtk.OverlaySignalEmit["get-child-position"]["result"], [boolean, Gdk.Rectangle]>>,
        ] = [true, true, true, true, true];

        expect(emitSignatures).toEqual([true, true, true, true, true]);
    });
});
