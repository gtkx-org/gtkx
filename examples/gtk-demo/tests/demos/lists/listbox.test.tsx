import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listboxDemo } from "../../../src/demos/lists/listbox.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findFirst } from "./helpers.js";

describe("listboxDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listboxDemo, { id: "listbox", title: "List Box/Complex" });
        expect(typeof listboxDemo.sourceCode).toBe("string");
        expect(listboxDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(listboxDemo.keywords).toContain("listbox");
        expect(listboxDemo.keywords).toContain("GtkListBox");
        expect(listboxDemo.defaultWidth).toBe(400);
        expect(listboxDemo.defaultHeight).toBe(600);
        expect(listboxDemo.component).toBeTypeOf("function");
    });
});

describe("listboxDemo rendering", () => {
    it("renders the header label inside the demo", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const labels = findAll(container, Gtk.Label);
        const titles = labels.map((l) => l.getLabel());
        expect(titles).toContain("Messages from GTK and friends");
    });

    it("wraps the list box in a scrolled window with the expected policies", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const sw = findFirst(container, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const [h, v] = (sw as Gtk.ScrolledWindow).getPolicy();
        expect(h).toBe(Gtk.PolicyType.NEVER);
        expect(v).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("renders a GtkListBox configured for double-click activation", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const listBox = findFirst(container, Gtk.ListBox);
        expect(listBox).toBeInstanceOf(Gtk.ListBox);
        expect(listBox?.getActivateOnSingleClick()).toBe(false);
    });

    it("renders one row per message in the parsed dataset", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const rows = findAll(container, Gtk.ListBoxRow);
        expect(rows.length).toBeGreaterThan(0);
        const labels = findAll(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("GTKtoolkit");
    });
});

describe("listboxDemo row interaction", () => {
    it("toggles the message details revealer when a row is activated", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const listBox = findFirst(container, Gtk.ListBox);
        const firstRow = findAll(container, Gtk.ListBoxRow)[0];
        if (!listBox || !firstRow) throw new Error("list box / row not rendered");
        const revealer = findAll(firstRow, Gtk.Revealer)[0];
        if (!revealer) throw new Error("no revealer found in the first row");
        const before = revealer.getRevealChild();
        await fireEvent(listBox as Gtk.Widget, "row-activated", firstRow);
        const after = revealer.getRevealChild();
        expect(after).toBe(!before);
    });

    it("returns to the initial revealer state after a second activation", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const listBox = findFirst(container, Gtk.ListBox);
        const firstRow = findAll(container, Gtk.ListBoxRow)[0];
        if (!listBox || !firstRow) throw new Error("list box / row not rendered");
        const revealer = findAll(firstRow, Gtk.Revealer)[0];
        if (!revealer) throw new Error("no revealer found in the first row");
        const initial = revealer.getRevealChild();
        await fireEvent(listBox as Gtk.Widget, "row-activated", firstRow);
        await fireEvent(listBox as Gtk.Widget, "row-activated", firstRow);
        expect(revealer.getRevealChild()).toBe(initial);
    });
});

describe("listboxDemo expand / hide button", () => {
    it("toggles the row revealer when the expand button is clicked", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const firstRow = findAll(container, Gtk.ListBoxRow)[0];
        if (!firstRow) throw new Error("no rows rendered");
        const buttons = findAll(firstRow, Gtk.Button);
        const expandButton = buttons.find((b) => b.getLabel() === "Expand" || b.getLabel() === "Hide");
        if (!expandButton) throw new Error("no expand/hide button found");
        const revealer = findAll(firstRow, Gtk.Revealer)[0];
        if (!revealer) throw new Error("no revealer found");
        const before = revealer.getRevealChild();
        await fireEvent(expandButton as Gtk.Widget, "clicked");
        expect(revealer.getRevealChild()).toBe(!before);
    });
});

describe("listboxDemo row state flags", () => {
    it("reveals the per-row action buttons when state flags change", async () => {
        if (!listboxDemo.component) throw new Error("listbox demo component missing");
        const { container } = await renderDemo(listboxDemo.component);
        const firstRow = findAll(container, Gtk.ListBoxRow)[0];
        if (!firstRow) throw new Error("no rows rendered");
        await fireEvent(firstRow as Gtk.Widget, "state-flags-changed", 0);
        const buttons = findAll(firstRow, Gtk.Button);
        const labels = buttons.map((b) => b.getLabel());
        expect(labels).toContain("Reply");
        expect(labels).toContain("Reshare");
        expect(labels).toContain("Favorite");
    });
});
