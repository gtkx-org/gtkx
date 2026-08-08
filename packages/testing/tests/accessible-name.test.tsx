import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkCheckButton } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { getWidgetText, render, screen } from "../src/index.js";

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

describe("accessible name computation - access keys", () => {
    it("drops the mnemonic marker from a button that uses an underline", async () => {
        await render(<GtkButton label="_Add Connection" useUnderline />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Add Connection" });
        expect(button).toHaveAccessibleName("Add Connection");
    });

    it("keeps an underscore in a label that does not use an underline", async () => {
        await render(<GtkButton label="_Add Connection" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Add Connection" });
        expect(button).toHaveAccessibleName("_Add Connection");
    });

    it("drops the mnemonic marker from a check button, not only from a label", async () => {
        await render(<GtkCheckButton label="_Read Only" useUnderline />);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Read Only" });
        expect(check).toHaveAccessibleName("Read Only");
    });

    it("renders a doubled underscore as the single literal underscore GTK draws", async () => {
        await render(<GtkButton label="_Export __ Range" useUnderline />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Export _ Range" });
        expect(button).toHaveAccessibleName("Export _ Range");
    });

    it("reports the drawn text, without the marker, as the node's text content", async () => {
        await render(<GtkButton label="_Save" useUnderline />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(getWidgetText(button)).toBe("Save");
    });
});
