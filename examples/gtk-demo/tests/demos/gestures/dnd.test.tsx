import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { dndDemo } from "../../../src/demos/gestures/dnd.js";
import { makeValue } from "../../../src/gvalue.js";
import { act, collectControllersOfType, fireEvent, renderDemo, screen, waitFor } from "../../test-utils.js";

const findChildByName = (root: Gtk.Widget, name: string): Gtk.Widget | null => {
    let child = root.getFirstChild();
    while (child) {
        if (child.getName() === name) return child;
        const found = findChildByName(child, name);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

const findItemLabel = async (id: string): Promise<Gtk.Label> => {
    const canvas = (await screen.findByName("canvas")) as Gtk.Fixed;
    const label = findChildByName(canvas, `item${id}`);
    if (!(label instanceof Gtk.Label)) throw new Error(`item${id} label not found`);
    return label;
};

describe("dndDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(dndDemo.id).toBe("dnd");
        expect(dndDemo.title).toBe("Drag-and-Drop");
        expect(dndDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(dndDemo.keywords)).toBe(true);
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
    it("renders three initial Item 1..3 labels positioned inside a GtkFixed", async () => {
        await renderDemo(dndDemo);
        const fixed = await screen.findByName("canvas");
        expect(fixed).toBeInstanceOf(Gtk.Fixed);
        expect((await findItemLabel("1")).getLabel()).toBe("Item 1");
        expect((await findItemLabel("2")).getLabel()).toBe("Item 2");
        expect((await findItemLabel("3")).getLabel()).toBe("Item 3");
    });

    it("attaches a GtkDropTarget to the canvas to accept string moves", async () => {
        await renderDemo(dndDemo);
        const fixed = (await screen.findByName("canvas")) as Gtk.Fixed;
        const dropTargets = collectControllersOfType(fixed, Gtk.DropTarget);
        expect(dropTargets.length).toBeGreaterThanOrEqual(1);
        const canvasDrop = dropTargets[0];
        if (!canvasDrop) throw new Error("expected canvas drop target");
        expect(canvasDrop.getActions()).toBe(Gdk.DragAction.MOVE);
    });

    it("attaches a GestureClick controller to the canvas configured for button 0 (any)", async () => {
        await renderDemo(dndDemo);
        const fixed = (await screen.findByName("canvas")) as Gtk.Fixed;
        const gestureClicks = collectControllersOfType(fixed, Gtk.GestureClick);
        expect(gestureClicks.length).toBeGreaterThanOrEqual(1);
    });
});

describe("dndDemo canvas drop handler", () => {
    it("invokes the canvas drop handler when the drop target signal fires with an item id", async () => {
        await renderDemo(dndDemo);
        const fixed = (await screen.findByName("canvas")) as Gtk.Fixed;
        const dropTarget = collectControllersOfType(fixed, Gtk.DropTarget)[0];
        if (!dropTarget) throw new Error("canvas drop target missing");
        const item1 = await findItemLabel("1");
        const beforeLabel = item1.getLabel();
        const value = makeValue(GObject.Type.STRING, (v) => v.setString("1"));
        await fireEvent(dropTarget, "drop", value, 250, 250);
        expect(item1.getLabel()).toBe(beforeLabel);
    });
});

describe("dndDemo item controllers", () => {
    it("attaches DragSource and DropTarget controllers to each item label", async () => {
        await renderDemo(dndDemo);
        const firstLabel = await findItemLabel("1");
        const dragSources = collectControllersOfType(firstLabel, Gtk.DragSource);
        const dropTargets = collectControllersOfType(firstLabel, Gtk.DropTarget);
        const rotateGestures = collectControllersOfType(firstLabel, Gtk.GestureRotate);
        expect(dragSources.length).toBeGreaterThanOrEqual(1);
        expect(dropTargets.length).toBeGreaterThanOrEqual(1);
        expect(rotateGestures.length).toBeGreaterThanOrEqual(1);
    });

    it("supports rotate gestures on an item via angle-changed and end", async () => {
        await renderDemo(dndDemo);
        const firstLabel = await findItemLabel("1");
        const rotate = collectControllersOfType(firstLabel, Gtk.GestureRotate)[0];
        if (!rotate) throw new Error("rotate missing");
        await fireEvent(rotate, "angle-changed", 0.5, 0.5);
        await fireEvent(rotate, "end", null);
        expect(firstLabel.getLabel()).toBe("Item 1");
    });
});

describe("dndDemo item editor", () => {
    it("opens an entry editor when a label gesture-click released signal fires on an item", async () => {
        await renderDemo(dndDemo);
        const firstLabel = await findItemLabel("1");
        const gestureClick = collectControllersOfType(firstLabel, Gtk.GestureClick)[0];
        if (!gestureClick) throw new Error("gesture click missing");
        await fireEvent(gestureClick, "released", 1, 0, 0);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect((entry as Gtk.Entry).getText()).toBe("Item 1");
    });

    it("updates the item label as the user changes the editor text", async () => {
        await renderDemo(dndDemo);
        const firstLabel = await findItemLabel("1");
        const gestureClick = collectControllersOfType(firstLabel, Gtk.GestureClick)[0];
        if (!gestureClick) throw new Error("gesture click missing");
        await fireEvent(gestureClick, "released", 1, 0, 0);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await act(() => entry.setText("Renamed"));
        await fireEvent(entry, "changed");
        await waitFor(() => {
            expect(firstLabel.getLabel()).toBe("Renamed");
        });
    });
});

describe("dndDemo styling and chrome", () => {
    it("changes an item style when a string class name drop fires on its drop target", async () => {
        await renderDemo(dndDemo);
        const firstLabel = await findItemLabel("1");
        const dropTarget = collectControllersOfType(firstLabel, Gtk.DropTarget)[0];
        if (!dropTarget) throw new Error("drop target missing");
        const value = makeValue(GObject.Type.STRING, (v) => v.setString("my-custom-class"));
        await fireEvent(dropTarget, "drop", value, 0, 0);
        await waitFor(() => {
            expect(firstLabel.getCssClasses()).toEqual(expect.arrayContaining(["my-custom-class"]));
        });
    });

    it("attaches a Popover element used as the context menu", async () => {
        await renderDemo(dndDemo);
        const popover = await screen.findByName("context-menu");
        expect(popover).toBeInstanceOf(Gtk.Popover);
    });
});
