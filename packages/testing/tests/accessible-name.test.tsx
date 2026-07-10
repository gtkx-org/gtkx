import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { render, screen } from "../src/index.js";

describe("accessible name computation", () => {
    it("falls back to tooltip text for an icon-only button (the title step)", async () => {
        await render(<GtkButton tooltipText="Search" iconName="edit-find-symbolic" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Search" });
        expect(button).toHaveAccessibleName("Search");
    });

    it("prefers a real label over the tooltip", async () => {
        await render(<GtkButton label="Save" tooltipText="Save the file" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(button).toHaveAccessibleName("Save");
    });
});
