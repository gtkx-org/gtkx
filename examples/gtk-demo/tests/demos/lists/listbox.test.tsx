import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listboxDemo } from "../../../src/demos/lists/listbox.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("listboxDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listboxDemo, { id: "listbox", title: "List Box/Complex" });
        expect(typeof listboxDemo.sourceCode).toBe("string");
        expect(listboxDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(listboxDemo.keywords).toContain("gtklistbox");
        expect(listboxDemo.defaultWidth).toBe(400);
        expect(listboxDemo.defaultHeight).toBe(600);
        expect(listboxDemo.component).toBeTypeOf("function");
    });
});

describe("listboxDemo rendering", () => {
    it("renders the header label inside the demo", async () => {
        const { container } = await renderDemo(listboxDemo);
        const titles = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(titles).toContain("Messages from GTK and friends");
    });

    it("wraps the list box in a scrolled window with the expected policies", async () => {
        await renderDemo(listboxDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const [h, v] = sw.getPolicy();
        expect(h).toBe(Gtk.PolicyType.NEVER);
        expect(v).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("renders a GtkListBox configured for double-click activation", async () => {
        await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        expect(listBox).toBeInstanceOf(Gtk.ListBox);
        expect(listBox.getActivateOnSingleClick()).toBe(false);
    });

    it("renders one row per message in the parsed dataset", async () => {
        const { container } = await renderDemo(listboxDemo);
        const rows = findAllOfType(container, Gtk.ListBoxRow);
        expect(rows.length).toBeGreaterThan(0);
        const labels = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("GTKtoolkit");
    });
});

describe("listboxDemo row interaction", () => {
    it("toggles the message details revealer when a row is activated", async () => {
        const { container } = await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = findAllOfType(container, Gtk.ListBoxRow)[0];
        if (!firstRow) throw new Error("no rows rendered");
        const revealer = findAllOfType(firstRow, Gtk.Revealer)[0];
        if (!revealer) throw new Error("no revealer found in the first row");
        const before = revealer.getRevealChild();
        await fireEvent(listBox, "row-activated", firstRow);
        const after = revealer.getRevealChild();
        expect(after).toBe(!before);
    });

    it("returns to the initial revealer state after a second activation", async () => {
        const { container } = await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = findAllOfType(container, Gtk.ListBoxRow)[0];
        if (!firstRow) throw new Error("no rows rendered");
        const revealer = findAllOfType(firstRow, Gtk.Revealer)[0];
        if (!revealer) throw new Error("no revealer found in the first row");
        const initial = revealer.getRevealChild();
        await fireEvent(listBox, "row-activated", firstRow);
        await fireEvent(listBox, "row-activated", firstRow);
        expect(revealer.getRevealChild()).toBe(initial);
    });
});

describe("listboxDemo expand / hide button", () => {
    it("toggles the row revealer when the expand button is clicked", async () => {
        const { container } = await renderDemo(listboxDemo);
        const firstRow = findAllOfType(container, Gtk.ListBoxRow)[0];
        if (!firstRow) throw new Error("no rows rendered");
        const buttons = findAllOfType(firstRow, Gtk.Button);
        const expandButton = buttons.find((b) => b.getLabel() === "Expand" || b.getLabel() === "Hide");
        if (!expandButton) throw new Error("no expand/hide button found");
        const revealer = findAllOfType(firstRow, Gtk.Revealer)[0];
        if (!revealer) throw new Error("no revealer found");
        const before = revealer.getRevealChild();
        await fireEvent(expandButton, "clicked");
        expect(revealer.getRevealChild()).toBe(!before);
    });
});

describe("listboxDemo row state flags", () => {
    it("reveals the per-row action buttons when state flags change", async () => {
        const { container } = await renderDemo(listboxDemo);
        const firstRow = findAllOfType(container, Gtk.ListBoxRow)[0];
        if (!firstRow) throw new Error("no rows rendered");
        await fireEvent(firstRow, "state-flags-changed", 0);
        const buttons = findAllOfType(firstRow, Gtk.Button);
        const labels = buttons.map((b) => b.getLabel());
        expect(labels).toContain("Reply");
        expect(labels).toContain("Reshare");
        expect(labels).toContain("Favorite");
    });
});
