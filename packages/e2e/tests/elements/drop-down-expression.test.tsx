import type * as Gtk from "@gtkx/gi/gtk";
import { PropertyExpression, StringObject } from "@gtkx/gi/gtk";
import { GtkDropDown, GtkStringList } from "@gtkx/jsx/gtk";
import { getClassType } from "@gtkx/runtime";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("GtkDropDown - expression prop", () => {
    it("takes a Gtk.Expression as an initial prop", async () => {
        const ref = createRef<Gtk.DropDown>();
        const expression = PropertyExpression.new(getClassType(StringObject), null, "string");

        await render(
            <GtkDropDown ref={ref} expression={expression} model={<GtkStringList strings={["a", "b"]} />} />,
        );

        expect(ref.current?.getExpression()).not.toBeNull();
    });
});
