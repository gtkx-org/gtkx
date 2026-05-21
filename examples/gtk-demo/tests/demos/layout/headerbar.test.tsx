import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { headerbarDemo } from "../../../src/demos/layout/headerbar.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    const visit = (widget: Gtk.Widget): void => {
        if (widget instanceof ctor) matches.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            visit(child);
            child = child.getNextSibling();
        }
    };
    visit(root);
    return matches;
};

describe("headerbarDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(headerbarDemo.id).toBe("headerbar");
        expect(headerbarDemo.title).toBe("Header Bar");
        expect(headerbarDemo.description.length).toBeGreaterThan(0);
        expect(headerbarDemo.keywords).toEqual(
            expect.arrayContaining(["headerbar", "GtkHeaderBar", "GtkWindowHandle", "GtkWindowControls", "titlebar"]),
        );
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
        const { container } = await renderDemo(headerbarDemo);
        const buttons = findAllOfType(container, Gtk.Button);
        const iconNames = buttons.map((b) => b.getIconName());
        expect(iconNames).toContain("go-previous-symbolic");
        expect(iconNames).toContain("go-next-symbolic");
        expect(iconNames).toContain("mail-send-receive-symbolic");
        const tooltips = buttons.map((b) => b.getTooltipText());
        expect(tooltips).toContain("Back");
        expect(tooltips).toContain("Forward");
        expect(tooltips).toContain("Check out");
    });

    it("groups Back and Forward inside a GtkBox with the 'linked' style class", async () => {
        const { container } = await renderDemo(headerbarDemo);
        const buttons = findAllOfType(container, Gtk.Button);
        const back = buttons.find((b) => b.getIconName() === "go-previous-symbolic");
        if (!back) throw new Error("expected back button");
        const parent = back.getParent();
        expect(parent).toBeInstanceOf(Gtk.Box);
        const cssClasses = parent?.getCssClasses() ?? [];
        expect(cssClasses).toContain("linked");
    });

    it("renders a GtkSwitch in the header bar with the 'Change something' accessible label", async () => {
        await renderDemo(headerbarDemo);
        const widget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        expect(widget).toBeInstanceOf(Gtk.Switch);
    });

    it("renders a GtkTextView in the window body", async () => {
        const { container } = await renderDemo(headerbarDemo);
        const textViews = findAllOfType(container, Gtk.TextView);
        expect(textViews).toHaveLength(1);
    });
});
