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

    it("derives the emit result from the same handler map", () => {
        const button = new Gtk.Button();
        // The typed overload returns the signal's result (`void` for `clicked`);
        // the untyped `string` fallback would return `unknown`, which a `void`
        // binding rejects — so this assignment only compiles when `emit` is typed.
        const result: void = button.emit("clicked");
        expect(result).toBeUndefined();
    });
});
