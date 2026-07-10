import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { headerbarDemo } from "../../../src/demos/layout/headerbar.js";
import { renderDemo } from "../../test-utils.js";

describe("headerbarDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(headerbarDemo.id).toBe("headerbar");
        expect(headerbarDemo.title).toBe("Header Bar");
        expect(headerbarDemo.description.length).toBeGreaterThan(0);
        expect(headerbarDemo.keywords).toEqual(expect.arrayContaining(["GtkWindowHandle", "GtkWindowControls"]));
        expect(typeof headerbarDemo.sourceCode).toBe("string");
        expect(headerbarDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(headerbarDemo.defaultWidth).toBe(600);
        expect(headerbarDemo.defaultHeight).toBe(400);
        expect(headerbarDemo.component).toBeTypeOf("function");
    });

    it("installs the named GtkHeaderBar and packs the nav/check-out buttons into it", async () => {
        await renderDemo(headerbarDemo);
        const headerbar = (await screen.findByName("headerbar-titlebar")) as Gtk.HeaderBar;
        expect(headerbar).toBeInstanceOf(Gtk.HeaderBar);
        expect(within(headerbar).getByName("nav-box")).toBeInstanceOf(Gtk.Box);
        expect(within(headerbar).getByName("check-out-button")).toBeInstanceOf(Gtk.Button);
        within(headerbar).getByRole(Gtk.AccessibleRole.SWITCH, { name: "Change something" });
    });
});

describe("headerbarDemo header content", () => {
    it("renders the navigation buttons with the symbolic icons and tooltips", async () => {
        await renderDemo(headerbarDemo);
        const back = (await screen.findByName("back-button")) as Gtk.Button;
        const forward = (await screen.findByName("forward-button")) as Gtk.Button;
        const checkOut = (await screen.findByName("check-out-button")) as Gtk.Button;
        expect(back.getIconName()).toBe("go-previous-symbolic");
        expect(forward.getIconName()).toBe("go-next-symbolic");
        expect(checkOut.getIconName()).toBe("mail-send-receive-symbolic");
        expect(back.getTooltipText()).toBe("Back");
        expect(forward.getTooltipText()).toBe("Forward");
        expect(checkOut.getTooltipText()).toBe("Check out");
    });

    it("groups Back and Forward inside a GtkBox with the 'linked' style class", async () => {
        await renderDemo(headerbarDemo);
        const navBox = (await screen.findByName("nav-box")) as Gtk.Box;
        expect(navBox).toBeInstanceOf(Gtk.Box);
        expect(navBox.getCssClasses()).toContain("linked");
    });

    it("renders a GtkSwitch in the header bar with the 'Change something' accessible label", async () => {
        await renderDemo(headerbarDemo);
        await screen.findByRole(Gtk.AccessibleRole.SWITCH, { name: "Change something" });
    });

    it("renders the body GtkTextView with its 'Content' accessible label", async () => {
        await renderDemo(headerbarDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        expect(textView).toBe(await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Content" }));
    });
});

describe("headerbarDemo interactions", () => {
    it("toggles the header-bar switch on activation", async () => {
        await renderDemo(headerbarDemo);
        const switchEl = (await screen.findByRole(Gtk.AccessibleRole.SWITCH, {
            name: "Change something",
            checked: false,
        })) as Gtk.Switch;

        await userEvent.click(switchEl);
        await screen.findByRole(Gtk.AccessibleRole.SWITCH, { name: "Change something", checked: true });

        await userEvent.click(switchEl);
        await screen.findByRole(Gtk.AccessibleRole.SWITCH, { name: "Change something", checked: false });
    });
});
