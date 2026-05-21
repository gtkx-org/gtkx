import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewColorsDemo } from "../../../src/demos/lists/listview-colors.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findApplicationWindow, findFirst } from "./helpers.js";

describe("listviewColorsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewColorsDemo, { id: "listview-colors", title: "Lists/Colors" });
        expect(typeof listviewColorsDemo.sourceCode).toBe("string");
        expect(listviewColorsDemo.keywords).toContain("gridview");
        expect(listviewColorsDemo.keywords).toContain("colors");
        expect(listviewColorsDemo.defaultWidth).toBe(600);
        expect(listviewColorsDemo.defaultHeight).toBe(400);
        expect(listviewColorsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewColorsDemo header bar", () => {
    it("installs a header bar via the titlebar slot", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("application window not found");
        const titlebar = window.getTitlebar();
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("renders the Refill button", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("application window not found");
        const buttons = findAll(window, Gtk.Button).filter(
            (b) => !(b instanceof Gtk.ToggleButton) && b.getLabel() !== null,
        );
        expect(buttons.some((b) => b.getLabel() === "_Refill")).toBe(true);
    });

    it("renders three drop-downs in the header bar (limit, sort, display)", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("application window not found");
        const dropdowns = findAll(window, Gtk.DropDown);
        expect(dropdowns.length).toBe(3);
    });

    it("renders a selection-info toggle button", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("application window not found");
        const toggles = findAll(window, Gtk.ToggleButton);
        const selectionToggle = toggles.find((t) => t.getIconName() === "emblem-important-symbolic");
        expect(selectionToggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(selectionToggle?.getActive()).toBe(false);
    });
});

describe("listviewColorsDemo grid view", () => {
    it("renders a GtkGridView with multiple selection and rubberband enabled", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const gridView = findFirst(container, Gtk.GridView);
        expect(gridView).toBeInstanceOf(Gtk.GridView);
        const model = gridView?.getModel();
        expect(model).toBeInstanceOf(Gtk.MultiSelection);
        expect(gridView?.getEnableRubberband()).toBe(true);
    });

    it("wraps the grid view in a scrolled window inside an overlay", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const overlay = findFirst(container, Gtk.Overlay);
        expect(overlay).toBeInstanceOf(Gtk.Overlay);
        const sw = overlay && findFirst(overlay, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });
});

describe("listviewColorsDemo selection info revealer", () => {
    it("starts collapsed (revealer not revealing children)", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const revealers = findAll(container, Gtk.Revealer);
        const mainRevealer = revealers[0];
        expect(mainRevealer?.getRevealChild()).toBe(false);
    });

    it("expands when the selection-info toggle is activated", async () => {
        const { container } = await renderDemo(listviewColorsDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("application window not found");
        const toggle = findAll(window, Gtk.ToggleButton).find((t) => t.getIconName() === "emblem-important-symbolic");
        if (!toggle) throw new Error("selection toggle not found");
        toggle.setActive(true);
        await fireEvent(toggle as Gtk.Widget, "toggled");
        const revealer = findAll(container, Gtk.Revealer)[0];
        expect(revealer?.getRevealChild()).toBe(true);
    });
});
