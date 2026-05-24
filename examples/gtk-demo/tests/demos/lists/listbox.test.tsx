import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it, vi } from "vitest";
import { listboxDemo } from "../../../src/demos/lists/listbox.js";
import { fireEvent, renderDemo, screen, within } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

describe("listboxDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listboxDemo.id).toBe("listbox");
        expect(listboxDemo.title).toBe("List Box/Complex");
        expect(listboxDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listboxDemo.keywords)).toBe(true);
        expect(typeof listboxDemo.sourceCode).toBe("string");
        expect(listboxDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(listboxDemo.defaultWidth).toBe(400);
        expect(listboxDemo.defaultHeight).toBe(600);
        expect(listboxDemo.component).toBeTypeOf("function");
    });
});

describe("listboxDemo rendering", () => {
    it("renders the header label inside the demo", async () => {
        await renderDemo(listboxDemo);
        expect(await screen.findByText("Messages from GTK and friends")).toBeInstanceOf(Gtk.Widget);
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

    it("renders the first row with the expected sender content", async () => {
        await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = listBox.getRowAtIndex(0);
        expect(firstRow).toBeInstanceOf(Gtk.ListBoxRow);
    });
});

describe("listboxDemo row interaction", () => {
    it("toggles the message details revealer when a row is activated", async () => {
        await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = listBox.getRowAtIndex(0);
        if (!firstRow) throw new Error("no rows rendered");
        const revealer = within(firstRow).getByName("details-revealer") as Gtk.Revealer;
        const before = revealer.getRevealChild();
        await fireEvent(listBox, "row-activated", firstRow);
        expect(revealer.getRevealChild()).toBe(!before);
    });

    it("returns to the initial revealer state after a second activation", async () => {
        await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = listBox.getRowAtIndex(0);
        if (!firstRow) throw new Error("no rows rendered");
        const revealer = within(firstRow).getByName("details-revealer") as Gtk.Revealer;
        const initial = revealer.getRevealChild();
        await fireEvent(listBox, "row-activated", firstRow);
        await fireEvent(listBox, "row-activated", firstRow);
        expect(revealer.getRevealChild()).toBe(initial);
    });
});

describe("listboxDemo expand / hide button", () => {
    it("toggles the row revealer when the expand button is clicked", async () => {
        await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = listBox.getRowAtIndex(0);
        if (!firstRow) throw new Error("no rows rendered");
        const expandButton = within(firstRow).getByName("expand-button") as Gtk.Button;
        const revealer = within(firstRow).getByName("details-revealer") as Gtk.Revealer;
        const before = revealer.getRevealChild();
        await fireEvent(expandButton, "clicked");
        expect(revealer.getRevealChild()).toBe(!before);
    });
});

describe("listboxDemo row state flags", () => {
    it("reveals the per-row action buttons when state flags change", async () => {
        await renderDemo(listboxDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const firstRow = listBox.getRowAtIndex(0);
        if (!firstRow) throw new Error("no rows rendered");
        await fireEvent(firstRow, "state-flags-changed", 0);
        const buttons = within(firstRow).getAllByRole(Gtk.AccessibleRole.BUTTON);
        const labels = buttons.map((b) => (b as Gtk.Button).getLabel());
        expect(labels).toContain("Reply");
        expect(labels).toContain("Reshare");
        expect(labels).toContain("Favorite");
    });
});
