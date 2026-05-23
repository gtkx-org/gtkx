import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { drawingAreaDemo } from "../../../src/demos/drawing/drawingarea.js";
import { fireEvent, renderDemo, screen } from "../../test-utils.js";

const walkWidgetTree = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;
    let child = root.getFirstChild();
    while (child) {
        yield* walkWidgetTree(child);
        child = child.getNextSibling();
    }
};

const findChildLabelByText = (parent: Gtk.Widget, text: string): Gtk.Label | null => {
    for (const widget of walkWidgetTree(parent)) {
        if (widget instanceof Gtk.Label && widget.getLabel() === text) return widget;
    }
    return null;
};

const dragControllersOf = (widget: Gtk.Widget): Gtk.GestureDrag[] => {
    const observer = widget.observeControllers();
    const out: Gtk.GestureDrag[] = [];
    const count = observer.getNItems();
    for (let i = 0; i < count; i++) {
        const controller = observer.getItem(i);
        if (controller instanceof Gtk.GestureDrag) out.push(controller);
    }
    return out;
};

describe("drawingAreaDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(drawingAreaDemo.id).toBe("drawingarea");
        expect(drawingAreaDemo.title).toBe("Drawing Area");
        expect(drawingAreaDemo.description.length).toBeGreaterThan(0);
        expect(drawingAreaDemo.keywords).toEqual(expect.arrayContaining(["GtkDrawingArea"]));
        expect(typeof drawingAreaDemo.sourceCode).toBe("string");
        expect(drawingAreaDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(drawingAreaDemo.defaultWidth).toBe(250);
        expect(drawingAreaDemo.component).toBeTypeOf("function");
    });

    it("populates the host window reference on mount", async () => {
        const { window } = await renderDemo(drawingAreaDemo);
        const win = window.current;
        expect(win).not.toBeNull();
        expect(win).toBeInstanceOf(Gtk.Window);
    });
});

describe("drawingAreaDemo rendering", () => {
    it("renders both the knockout-groups heading and the scribble-area heading", async () => {
        const { container } = await renderDemo(drawingAreaDemo);
        const knockout = findChildLabelByText(container, "Knockout groups");
        const scribble = findChildLabelByText(container, "Scribble area");
        expect(knockout).toBeInstanceOf(Gtk.Label);
        expect(scribble).toBeInstanceOf(Gtk.Label);
        expect(knockout?.hasCssClass("heading")).toBe(true);
        expect(scribble?.hasCssClass("heading")).toBe(true);
    });

    it("renders two GtkDrawingArea widgets each sized 100x100", async () => {
        await renderDemo(drawingAreaDemo);
        const knockout = (await screen.findByName("knockout-area")) as Gtk.DrawingArea;
        const scribble = (await screen.findByName("scribble-area")) as Gtk.DrawingArea;
        for (const area of [knockout, scribble]) {
            expect(area.getContentWidth()).toBe(100);
            expect(area.getContentHeight()).toBe(100);
            expect(area.getAccessibleRole()).toBe(Gtk.AccessibleRole.IMG);
        }
    });

    it("wraps each drawing area in a vertical-expanding frame", async () => {
        await renderDemo(drawingAreaDemo);
        const knockout = (await screen.findByName("knockout-area")) as Gtk.DrawingArea;
        const scribble = (await screen.findByName("scribble-area")) as Gtk.DrawingArea;
        for (const area of [knockout, scribble]) {
            const frame = area.getParent();
            expect(frame).toBeInstanceOf(Gtk.Frame);
            expect((frame as Gtk.Frame).getVexpand()).toBe(true);
        }
    });
});

describe("drawingAreaDemo gestures", () => {
    it("attaches a GtkGestureDrag controller to the scribble drawing area and drives drag callbacks", async () => {
        await renderDemo(drawingAreaDemo);
        const scribble = (await screen.findByName("scribble-area")) as Gtk.DrawingArea;
        await fireEvent(scribble, "resize", 200, 200);
        const dragController = dragControllersOf(scribble)[0];
        expect(dragController).toBeInstanceOf(Gtk.GestureDrag);
        if (!dragController) return;
        await fireEvent(dragController, "drag-begin", 10, 10);
        await fireEvent(dragController, "drag-update", 5, 5);
        await fireEvent(dragController, "drag-end", 15, 15);
        expect(scribble.getContentWidth()).toBe(100);
    });
});
