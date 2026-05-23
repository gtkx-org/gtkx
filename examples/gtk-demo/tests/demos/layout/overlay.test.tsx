import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { overlayDemo } from "../../../src/demos/layout/overlay.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

const findAncestorOverlay = (widget: Gtk.Widget): Gtk.Overlay | null => {
    let current: Gtk.Widget | null = widget.getParent();
    while (current) {
        if (current instanceof Gtk.Overlay) return current;
        current = current.getParent();
    }
    return null;
};

const getNumbersBoxLabel = (overlay: Gtk.Overlay): Gtk.Widget | null => {
    const grid = overlay.getChild();
    if (!grid) return null;
    let candidate = grid.getNextSibling();
    while (candidate) {
        const inner = candidate.getFirstChild();
        if (inner) return inner;
        candidate = candidate.getNextSibling();
    }
    return null;
};

describe("overlayDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(overlayDemo.id).toBe("overlay");
        expect(overlayDemo.title).toBe("Overlay/Interactive Overlay");
        expect(overlayDemo.description.length).toBeGreaterThan(0);
        expect(overlayDemo.keywords).toEqual(["GtkOverlay"]);
        expect(typeof overlayDemo.sourceCode).toBe("string");
        expect(overlayDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(overlayDemo.defaultWidth).toBe(500);
        expect(overlayDemo.defaultHeight).toBe(510);
        expect(overlayDemo.component).toBeTypeOf("function");
    });
});

describe("overlayDemo grid and labels", () => {
    it("renders a 5x5 grid of numbered buttons", async () => {
        await renderDemo(overlayDemo);
        const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
        expect(buttons).toHaveLength(25);
        const labels = buttons.map((b) => (b as Gtk.Button).getLabel());
        for (let i = 0; i < 25; i++) {
            expect(labels).toContain(String(i));
        }
    });

    it("renders the decorative 'Numbers' label using markup", async () => {
        await renderDemo(overlayDemo);
        const firstButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "0" })) as Gtk.Button;
        const grid = firstButton.getParent();
        if (!grid) throw new Error("expected grid parent");
        const overlay = findAncestorOverlay(grid);
        if (!overlay) throw new Error("expected ancestor overlay");
        const numbersLabel = getNumbersBoxLabel(overlay);
        expect(numbersLabel).toBeInstanceOf(Gtk.Label);
        const label = numbersLabel as Gtk.Label;
        expect(label.getUseMarkup()).toBe(true);
        expect(label.getLabel()).toContain("Numbers");
        expect(label.getCanTarget()).toBe(false);
    });

    it("nests the grid inside a GtkOverlay containing the button grid", async () => {
        await renderDemo(overlayDemo);
        const firstButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "0" })) as Gtk.Button;
        const grid = firstButton.getParent();
        expect(grid).toBeInstanceOf(Gtk.Grid);
        if (!grid) throw new Error("expected grid parent");
        const overlay = findAncestorOverlay(grid);
        expect(overlay).toBeInstanceOf(Gtk.Overlay);
    });
});

describe("overlayDemo entry behavior", () => {
    it("renders the entry with the placeholder text 'Your Lucky Number' and empty initial value", async () => {
        await renderDemo(overlayDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        expect(entry.getPlaceholderText()).toBe("Your Lucky Number");
        expect(entry.getText()).toBe("");
    });

    it("updates the entry to the clicked number when a grid button is activated", async () => {
        await renderDemo(overlayDemo);
        const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "13" })) as Gtk.Button;
        await fireEvent(button, "clicked");
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        expect(entry.getText()).toBe("13");
    });

    it("updates the entry text via the changed signal", async () => {
        await renderDemo(overlayDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await act(() => entry.setText("typed"));
        await fireEvent(entry, "changed");
        expect(entry.getText()).toBe("typed");
    });
});
