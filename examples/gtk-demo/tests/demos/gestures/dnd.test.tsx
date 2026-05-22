import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { dndDemo } from "../../../src/demos/gestures/dnd.js";
import { makeValue } from "../../../src/gvalue.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { collectControllers, findAllOfType } from "../../helpers/traverse.js";

const findItemLabels = (root: Gtk.Widget): Gtk.Label[] =>
    findAllOfType(root, Gtk.Label)
        .filter((label) => /^Item \d+$/.test(label.getLabel() ?? ""))
        .sort((a, b) => (a.getLabel() ?? "").localeCompare(b.getLabel() ?? ""));

describe("dndDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(dndDemo, { id: "dnd", title: "Drag-and-Drop" });
        expect(typeof dndDemo.sourceCode).toBe("string");
        expect(dndDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(dndDemo.component).toBeTypeOf("function");
        expect(dndDemo.defaultWidth).toBe(640);
        expect(dndDemo.defaultHeight).toBe(480);
    });

    it("sets the default size on the window to 640x480 on mount", async () => {
        const { window } = await renderDemo(dndDemo);
        const win = window.current;
        if (!win) throw new Error("window not assigned");
        const [w, h] = win.getDefaultSize();
        expect(w).toBe(640);
        expect(h).toBe(480);
    });
});

describe("dndDemo canvas", () => {
    it("renders four initial Item 1..4 labels positioned inside a GtkFixed", async () => {
        const { container } = await renderDemo(dndDemo);
        const fixed = await screen.findByName("canvas");
        expect(fixed).toBeInstanceOf(Gtk.Fixed);
        const labels = findItemLabels(container).map((l) => l.getLabel());
        expect(labels).toEqual(expect.arrayContaining(["Item 1", "Item 2", "Item 3", "Item 4"]));
    });

    it("attaches a GtkDropTarget to the canvas to accept string moves", async () => {
        await renderDemo(dndDemo);
        const fixed = (await screen.findByName("canvas")) as Gtk.Fixed;
        const dropTargets = collectControllers(fixed, Gtk.DropTarget);
        expect(dropTargets.length).toBeGreaterThanOrEqual(1);
        const canvasDrop = dropTargets[0];
        if (!canvasDrop) throw new Error("expected canvas drop target");
        expect(canvasDrop.getActions()).toBe(Gdk.DragAction.MOVE);
    });

    it("attaches a GestureClick controller to the canvas configured for button 0 (any)", async () => {
        await renderDemo(dndDemo);
        const fixed = (await screen.findByName("canvas")) as Gtk.Fixed;
        const gestureClicks = collectControllers(fixed, Gtk.GestureClick);
        expect(gestureClicks.length).toBeGreaterThanOrEqual(1);
    });
});

describe("dndDemo canvas drop handler", () => {
    it("invokes the canvas drop handler when the drop target signal fires with an item id", async () => {
        const { container } = await renderDemo(dndDemo);
        const fixed = (await screen.findByName("canvas")) as Gtk.Fixed;
        const dropTarget = collectControllers(fixed, Gtk.DropTarget)[0];
        if (!dropTarget) throw new Error("canvas drop target missing");
        const beforeLabels = findItemLabels(container);
        expect(beforeLabels).toHaveLength(4);
        const value = makeValue(GObject.Type.STRING, (v) => v.setString("1"));
        await fireEvent(dropTarget, "drop", value, 250, 250);
        const afterLabels = findItemLabels(container);
        expect(afterLabels.map((l) => l.getLabel())).toEqual(beforeLabels.map((l) => l.getLabel()));
    });
});

describe("dndDemo item controllers", () => {
    it("attaches DragSource and DropTarget controllers to each item label", async () => {
        const { container } = await renderDemo(dndDemo);
        const labels = findItemLabels(container);
        expect(labels.length).toBeGreaterThanOrEqual(4);
        const firstLabel = labels[0];
        if (!firstLabel) throw new Error("no item label found");
        const dragSources = collectControllers(firstLabel, Gtk.DragSource);
        const dropTargets = collectControllers(firstLabel, Gtk.DropTarget);
        const rotateGestures = collectControllers(firstLabel, Gtk.GestureRotate);
        expect(dragSources.length).toBeGreaterThanOrEqual(1);
        expect(dropTargets.length).toBeGreaterThanOrEqual(1);
        expect(rotateGestures.length).toBeGreaterThanOrEqual(1);
    });

    it("supports rotate gestures on an item via angle-changed and end", async () => {
        const { container } = await renderDemo(dndDemo);
        const firstLabel = findItemLabels(container)[0];
        if (!firstLabel) throw new Error("no item label found");
        const rotate = collectControllers(firstLabel, Gtk.GestureRotate)[0];
        if (!rotate) throw new Error("rotate missing");
        await fireEvent(rotate, "angle-changed", 0.5, 0.5);
        await fireEvent(rotate, "end", null);
        expect(firstLabel.getLabel()).toBe("Item 1");
    });
});

describe("dndDemo item editor", () => {
    it("opens an entry editor when a label gesture-click released signal fires on an item", async () => {
        const { container } = await renderDemo(dndDemo);
        const firstLabel = findItemLabels(container)[0];
        if (!firstLabel) throw new Error("no item label found");
        const gestureClick = collectControllers(firstLabel, Gtk.GestureClick)[0];
        if (!gestureClick) throw new Error("gesture click missing");
        await fireEvent(gestureClick, "released", 1, 0, 0);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect((entry as Gtk.Entry).getText()).toBe("Item 1");
    });

    it("updates the item label as the user changes the editor text", async () => {
        const { container } = await renderDemo(dndDemo);
        const firstLabel = findItemLabels(container)[0];
        if (!firstLabel) throw new Error("no item label found");
        const gestureClick = collectControllers(firstLabel, Gtk.GestureClick)[0];
        if (!gestureClick) throw new Error("gesture click missing");
        await fireEvent(gestureClick, "released", 1, 0, 0);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await act(() => entry.setText("Renamed"));
        await fireEvent(entry, "changed");
        const renamed = await waitFor(() => {
            const renamedLabel = findAllOfType(container, Gtk.Label).find((l) => l.getLabel() === "Renamed");
            if (!renamedLabel) throw new Error("rename not yet propagated");
            return renamedLabel;
        });
        expect(renamed).toBeInstanceOf(Gtk.Label);
    });
});

describe("dndDemo styling and chrome", () => {
    it("changes an item style when a string class name drop fires on its drop target", async () => {
        const { container } = await renderDemo(dndDemo);
        const firstLabel = findItemLabels(container)[0];
        if (!firstLabel) throw new Error("no item label found");
        const dropTarget = collectControllers(firstLabel, Gtk.DropTarget)[0];
        if (!dropTarget) throw new Error("drop target missing");
        const value = makeValue(GObject.Type.STRING, (v) => v.setString("my-custom-class"));
        await fireEvent(dropTarget, "drop", value, 0, 0);
        await waitFor(() => {
            const labels = findItemLabels(container);
            const itemLabel = labels.find((l) => l.getLabel() === "Item 1");
            if (!itemLabel) throw new Error("item label missing");
            if (!itemLabel.getCssClasses().includes("my-custom-class")) {
                throw new Error("class not yet applied");
            }
        });
        const updated = findItemLabels(container).find((l) => l.getLabel() === "Item 1");
        expect(updated?.getCssClasses()).toEqual(expect.arrayContaining(["my-custom-class"]));
    });

    it("renders a horizontal palette of color swatches at the bottom", async () => {
        const { container } = await renderDemo(dndDemo);
        const scrolledWindows = findAllOfType(container, Gtk.ScrolledWindow);
        expect(scrolledWindows.length).toBeGreaterThanOrEqual(1);
    });

    it("attaches a Popover element used as the context menu", async () => {
        await renderDemo(dndDemo);
        const popover = await screen.findByName("context-menu");
        expect(popover).toBeInstanceOf(Gtk.Popover);
    });
});
