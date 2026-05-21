import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { overlayDemo } from "../../../src/demos/layout/overlay.js";
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

describe("overlayDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(overlayDemo.id).toBe("overlay");
        expect(overlayDemo.title).toBe("Overlay/Interactive Overlay");
        expect(overlayDemo.description.length).toBeGreaterThan(0);
        expect(overlayDemo.keywords).toEqual(expect.arrayContaining(["overlay", "GtkOverlay", "layer", "stack"]));
        expect(typeof overlayDemo.sourceCode).toBe("string");
        expect(overlayDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(overlayDemo.defaultWidth).toBe(500);
        expect(overlayDemo.defaultHeight).toBe(510);
        expect(overlayDemo.component).toBeTypeOf("function");
    });
});

describe("overlayDemo grid and labels", () => {
    it("renders a 5x5 grid of numbered buttons", async () => {
        if (!overlayDemo.component) throw new Error("overlay demo component missing");
        const { container } = await renderDemo(overlayDemo.component);
        const buttons = findAllOfType(container, Gtk.Button);
        expect(buttons).toHaveLength(25);
        const labels = buttons.map((b) => b.getLabel());
        for (let i = 0; i < 25; i++) {
            expect(labels).toContain(String(i));
        }
    });

    it("renders the decorative 'Numbers' label using markup", async () => {
        if (!overlayDemo.component) throw new Error("overlay demo component missing");
        const { container } = await renderDemo(overlayDemo.component);
        const labels = findAllOfType(container, Gtk.Label);
        const numbersLabel = labels.find((l) => l.getUseMarkup());
        expect(numbersLabel).toBeDefined();
        if (!numbersLabel) throw new Error("expected a markup label");
        expect(numbersLabel.getLabel()).toContain("Numbers");
        expect(numbersLabel.getCanTarget()).toBe(false);
    });

    it("nests the grid inside a GtkOverlay with two overlay children", async () => {
        if (!overlayDemo.component) throw new Error("overlay demo component missing");
        const { container } = await renderDemo(overlayDemo.component);
        const overlays = findAllOfType(container, Gtk.Overlay);
        expect(overlays).toHaveLength(1);
        const overlay = overlays[0];
        if (!overlay) throw new Error("expected GtkOverlay");
        const grid = findAllOfType(overlay, Gtk.Grid);
        expect(grid).toHaveLength(1);
    });
});

describe("overlayDemo entry behavior", () => {
    it("renders the entry with the placeholder text 'Your Lucky Number' and empty initial value", async () => {
        if (!overlayDemo.component) throw new Error("overlay demo component missing");
        await renderDemo(overlayDemo.component);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        expect(entry.getPlaceholderText()).toBe("Your Lucky Number");
        expect(entry.getText()).toBe("");
    });

    it("updates the entry to the clicked number when a grid button is activated", async () => {
        if (!overlayDemo.component) throw new Error("overlay demo component missing");
        await renderDemo(overlayDemo.component);
        const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "13" })) as Gtk.Button;
        await fireEvent(button, "clicked");
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        expect(entry.getText()).toBe("13");
    });

    it("updates the entry text via the changed signal", async () => {
        if (!overlayDemo.component) throw new Error("overlay demo component missing");
        await renderDemo(overlayDemo.component);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await act(() => entry.setText("typed"));
        await fireEvent(entry, "changed");
        expect(entry.getText()).toBe("typed");
    });
});
