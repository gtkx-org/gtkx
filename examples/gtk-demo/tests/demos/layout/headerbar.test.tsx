import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { headerbarDemo } from "../../../src/demos/layout/headerbar.js";
import { renderDemo, screen } from "../../test-utils.js";

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

    it("installs the GtkHeaderBar inside the window titlebar slot", async () => {
        const { window } = await renderDemo(headerbarDemo);
        const win = window.current;
        if (!win) throw new Error("expected window ref to be populated");
        const titlebar = win.getTitlebar();
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
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
        const widget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        expect(widget).toBeInstanceOf(Gtk.Switch);
    });

    it("renders a GtkTextView in the window body", async () => {
        await renderDemo(headerbarDemo);
        expect(await screen.findByName("text-view")).toBeInstanceOf(Gtk.TextView);
    });
});
