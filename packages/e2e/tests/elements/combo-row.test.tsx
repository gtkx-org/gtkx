import type * as Adw from "@gtkx/gi/adw";
import { AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkStringList } from "@gtkx/jsx/gtk";
import { render, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("userEvent selection - AdwComboRow", () => {
    it("selects an option on a row that is not a Gtk.DropDown", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["a", "b", "c"]} />} />
            </AdwPreferencesGroup>,
        );

        await userEvent.selectOptions(ref.current as Adw.ComboRow, 2);
        expect(ref.current).toHaveObjectProperty("selected", 2);
    });
});
