import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { headerbarDemo } from "../../../src/demos/layout/headerbar.js";
import { renderDemo } from "../../test-utils.js";

describe("headerbarDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(headerbarDemo.id).toBe("headerbar");
        expect(headerbarDemo.title).toBe("Header Bar");
        expect(headerbarDemo.description).toContain("GtkHeaderBar is a container that is suitable");
        expect(headerbarDemo.keywords).toEqual(["GtkWindowHandle", "GtkWindowControls"]);
        expect(headerbarDemo.sourceCode).toContain("const headerbarDemo: Demo = {");
        expect(headerbarDemo.defaultWidth).toBe(600);
        expect(headerbarDemo.defaultHeight).toBe(400);
        expect(headerbarDemo.component).toBeTypeOf("function");
    });

    it("installs the named GtkHeaderBar and packs the nav/check-out buttons into it", async () => {
        await renderDemo(headerbarDemo);
        const headerbar = await screen.findByName("headerbar-titlebar", { as: Gtk.HeaderBar });
        expect(headerbar).toContainElement(await screen.findByName("nav-box", { as: Gtk.Box }));
        expect(headerbar).toContainElement(await screen.findByName("check-out-button", { as: Gtk.Button }));
        expect(headerbar).toContainOneByRole(Gtk.AccessibleRole.SWITCH, { name: "Change something" });
    });
});

describe("headerbarDemo header content", () => {
    it("renders the navigation buttons with the symbolic icons and tooltips", async () => {
        await renderDemo(headerbarDemo);
        const back = await screen.findByName("back-button", { as: Gtk.Button });
        const forward = await screen.findByName("forward-button", { as: Gtk.Button });
        const checkOut = await screen.findByName("check-out-button", { as: Gtk.Button });
        expect(back).toHaveObjectProperty("iconName", "go-previous-symbolic");
        expect(forward).toHaveObjectProperty("iconName", "go-next-symbolic");
        expect(checkOut).toHaveObjectProperty("iconName", "mail-send-receive-symbolic");
        expect(back).toHaveObjectProperty("tooltipText", "Back");
        expect(forward).toHaveObjectProperty("tooltipText", "Forward");
        expect(checkOut).toHaveObjectProperty("tooltipText", "Check out");
    });

    it("groups Back and Forward inside a GtkBox with the 'linked' style class", async () => {
        await renderDemo(headerbarDemo);
        const navBox = await screen.findByName("nav-box", { as: Gtk.Box });
        expect(navBox).toHaveClass("linked");
    });

    it("renders the body GtkTextView with its 'Content' accessible label", async () => {
        await renderDemo(headerbarDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        expect(textView).toBe(await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Content" }));
    });
});

describe("headerbarDemo interactions", () => {
    it("toggles the header-bar switch on activation", async () => {
        await renderDemo(headerbarDemo);

        const switchEl = await screen.findByRole(Gtk.AccessibleRole.SWITCH, {
            name: "Change something",
            checked: false,
            as: Gtk.Switch,
        });

        await userEvent.click(switchEl);

        const checkedSwitch = await screen.findByRole(Gtk.AccessibleRole.SWITCH, {
            name: "Change something",
            checked: true,
        });

        expect(checkedSwitch).toBe(switchEl);
        await userEvent.click(switchEl);

        const uncheckedSwitch = await screen.findByRole(Gtk.AccessibleRole.SWITCH, {
            name: "Change something",
            checked: false,
        });

        expect(uncheckedSwitch).toBe(switchEl);
    });
});
