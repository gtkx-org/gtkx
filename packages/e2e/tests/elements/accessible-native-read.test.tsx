import type * as GtkTypes from "@gtkx/gi/gtk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { readAccessibleFlag, readAccessibleState, readAccessibleString } from "@gtkx/testing/internal";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const accessible = (ref: RefObject<GtkTypes.Label | null>): GtkTypes.Accessible => {
    if (ref.current === null) {
        throw new Error("Expected rendered widget");
    }

    return ref.current;
};

describe("reading accessible attributes from GTK", () => {
    it("reads a string property back verbatim", async () => {
        const ref = createRef<GtkTypes.Label>();
        await render(<GtkLabel ref={ref} accessibleLabel="Written by React" />);
        expect(readAccessibleString(accessible(ref), Gtk.AccessibleProperty.LABEL)).toBe("Written by React");
    });

    it("reads a boolean state GTK does not maintain itself", async () => {
        const set = createRef<GtkTypes.Label>();
        const unset = createRef<GtkTypes.Label>();

        await render(
            <GtkBox>
                <GtkLabel ref={set} accessibleBusy />
                <GtkLabel ref={unset} />
            </GtkBox>,
        );

        expect(readAccessibleFlag(accessible(set), Gtk.AccessibleState.BUSY)).toBe(true);
        expect(readAccessibleFlag(accessible(unset), Gtk.AccessibleState.BUSY)).toBeNull();
    });

    it("reads a tristate state as its enum member", async () => {
        const ref = createRef<GtkTypes.Label>();
        await render(<GtkLabel ref={ref} accessibleChecked={Gtk.AccessibleTristate.MIXED} />);
        expect(readAccessibleState(accessible(ref), Gtk.AccessibleState.CHECKED)).toBe(Gtk.AccessibleTristate.MIXED);
    });
});
