import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("marshalling - integer out-params and unsigned widget props", () => {
    it("populates two int32 out-params through gtk_widget_get_size_request", () => {
        const label = Gtk.Label.new("Test");
        label.setSizeRequest(120, 40);
        expect(label.getSizeRequest()).toEqual([120, 40]);
    });

    it("round-trips an unsigned uint32 widget property through gtk_grid_set_row_spacing", () => {
        const grid = Gtk.Grid.new();
        grid.setRowSpacing(7);
        expect(grid.getRowSpacing()).toBe(7);
    });
});
