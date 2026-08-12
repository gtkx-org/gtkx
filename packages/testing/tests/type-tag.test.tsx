import * as Gtk from "@gtkx/gi/gtk";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkButton, GtkMenuButton } from "@gtkx/jsx/gtk";
import { afterEach, describe, expect, it } from "vitest";
import { configure, getConfig, prettyRoles, prettyWidget, render, screen, userEvent } from "../src/index.js";
import { getTypeTag } from "../src/widget-getters.js";

const initialConfig = { ...getConfig() };

const renderMenuItem = async (): Promise<Gtk.Widget> => {
    await render(
        <GtkMenuButton
            tooltipText="Main Menu"
            menuModel={<GMenu items={[{ label: "New Task", action: "win.new" }]} />}
        />,
    );

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));

    return screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "New Task" });
};

afterEach(() => {
    configure(initialConfig);
});

describe("getTypeTag", () => {
    it("falls back to the GType name when no wrapper class is generated for the type", async () => {
        const item = await renderMenuItem();
        expect(getTypeTag(item)).toBe("GtkModelButton");
    });

    it("keeps the wrapper class name when one is registered for the type", async () => {
        await render(<GtkButton label="Tagged" />);
        expect(getTypeTag(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Tagged" }))).toBe("Button");
    });
});

describe("prettyWidget on a type with no generated wrapper class", () => {
    it("names the widget in both tags", async () => {
        const item = await renderMenuItem();
        const dump = prettyWidget(item, { shouldHighlight: false });
        expect(dump).toContain("<GtkModelButton");
        expect(dump).toContain("</GtkModelButton>");
        expect(dump).not.toContain("</>");
    });
});

describe("prettyRoles on a type with no generated wrapper class", () => {
    it("names the widget next to its role", async () => {
        const item = await renderMenuItem();
        expect(prettyRoles(item)).toContain('<GtkModelButton role="menu_item">');
    });
});

describe("userEvent actionability errors", () => {
    it("names a widget whose type has no generated wrapper class", async () => {
        configure({ actionabilityTimeout: 60 });
        const item = await renderMenuItem();

        await expect(userEvent.click(item)).rejects.toThrow(
            'Cannot dispatch user event: <GtkModelButton role="menu_item"> did not become actionable',
        );
    });

    it("omits the name attribute when the widget carries GTK's default name", async () => {
        configure({ actionabilityTimeout: 60 });
        await render(<GtkButton label="Save" sensitive={false} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });

        await expect(userEvent.click(button)).rejects.toThrow(
            'Cannot dispatch user event: <Button role="button"> did not become actionable',
        );
    });
});
