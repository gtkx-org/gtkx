import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { dndDemo } from "../../../src/demos/gestures/dnd.js";
import { renderDemo } from "../../test-utils.js";

const findCanvas = async (): Promise<Gtk.Fixed> => (await screen.findByName("canvas")) as Gtk.Fixed;
const findItemLabel = async (id: string): Promise<Gtk.Label> => (await screen.findByName(`item${id}`)) as Gtk.Label;

const findController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    type: new (...args: never[]) => T,
): T | null => {
    const list = widget.observeControllers();
    for (let i = 0; i < list.getNItems(); i++) {
        const item = list.getItem(i);
        if (item instanceof type) return item;
    }
    return null;
};

const makeStringValue = (s: string): GObject.Value => {
    const v = new GObject.Value();
    v.init(GObject.Type.STRING);
    v.setString(s);
    return v;
};

const makeRgbaValue = (r: number, g: number, b: number, a: number): GObject.Value => {
    const rgba = new Gdk.RGBA();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;
    const v = new GObject.Value();
    v.init(GObject.typeFromName("GdkRGBA"));
    v.setBoxed(rgba);
    return v;
};

const triggerContextMenu = async (canvas: Gtk.Fixed, x: number, y: number): Promise<void> => {
    const gestureClick = findController(canvas, Gtk.GestureClick);
    expect(gestureClick).toBeInstanceOf(Gtk.GestureClick);
    if (!gestureClick) return;
    const fakeEvent = { triggersContextMenu: () => true };
    const getCurrentEventSpy = vi.spyOn(gestureClick, "getCurrentEvent").mockReturnValue(fakeEvent as never);
    try {
        await act(() => {
            gestureClick.emit("pressed", 1, x, y);
        });
    } finally {
        getCurrentEventSpy.mockRestore();
    }
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

    it("applies the default 640x480 size to the host window", async () => {
        await renderDemo(dndDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const [width, height] = window.getDefaultSize() ?? [];
        expect(width).toBe(640);
        expect(height).toBe(480);
    });
});

describe("dndDemo initial canvas", () => {
    it("renders three labelled items inside the canvas", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        expect(canvas).toBeInstanceOf(Gtk.Fixed);
        expect((await findItemLabel("1")).getLabel()).toBe("Item 1");
        expect((await findItemLabel("2")).getLabel()).toBe("Item 2");
        expect((await findItemLabel("3")).getLabel()).toBe("Item 3");
    });

    it("attaches a hidden context-menu popover at startup", async () => {
        await renderDemo(dndDemo);
        const popover = (await screen.findByName("context-menu")) as Gtk.Popover;
        expect(popover).toBeInstanceOf(Gtk.Popover);
        expect(popover.isVisible()).toBe(false);
    });
});

describe("dndDemo canvas drop", () => {
    it("moves an item to the dropped location when its id is dropped on the canvas", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const [beforeX, beforeY] = canvas.getChildPosition(item1) as [number, number];
        const dropTarget = findController(canvas, Gtk.DropTarget);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);
        if (!dropTarget) return;
        await act(() => {
            dropTarget.emit("drop", makeStringValue("1"), 250, 250);
        });
        await waitFor(() => {
            const [afterX, afterY] = canvas.getChildPosition(item1) as [number, number];
            expect([afterX, afterY]).not.toEqual([beforeX, beforeY]);
        });
    });
});

describe("dndDemo item styling", () => {
    it("applies a CSS class to an item when a class name is dropped on it", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const dropTarget = findController(item1, Gtk.DropTarget);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);
        if (!dropTarget) return;
        await act(() => {
            dropTarget.emit("drop", makeStringValue("my-custom-class"), 0, 0);
        });
        await waitFor(() => {
            expect(item1.getCssClasses()).toEqual(expect.arrayContaining(["my-custom-class"]));
        });
    });

    it("applies an RGBA color style to an item when a color is dropped on it", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const beforeClasses = new Set(item1.getCssClasses());
        const dropTarget = findController(item1, Gtk.DropTarget);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);
        if (!dropTarget) return;
        await act(() => {
            dropTarget.emit("drop", makeRgbaValue(0.1, 0.2, 0.3, 1), 0, 0);
        });
        await waitFor(() => {
            const afterClasses = new Set(item1.getCssClasses());
            const added = [...afterClasses].filter((c) => !beforeClasses.has(c));
            expect(added.length).toBeGreaterThan(0);
        });
    });
});

describe("dndDemo inline editing", () => {
    it("opens an inline entry for the item when the item is clicked", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        await userEvent.pointer(item1, "click");

        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        expect(entry.getText()).toBe("Item 1");
    });

    it("updates the item label as the user types into the inline entry", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        await userEvent.pointer(item1, "click");

        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await userEvent.clear(entry);
        await userEvent.type(entry, "Renamed");

        await waitFor(() => {
            expect(item1.getLabel()).toBe("Renamed");
        });
    });

    it("closes the inline entry when Enter is pressed", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        await userEvent.pointer(item1, "click");
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await userEvent.keyboard(entry, "{Enter}");
        await waitFor(() => {
            expect(screen.queryAllByRole(Gtk.AccessibleRole.TEXT_BOX).length).toBe(0);
        });
    });
});

describe("dndDemo item rotation", () => {
    it("supports rotating an item without throwing or removing it", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        await userEvent.rotate(item1, 0.5, 0.5);
        expect(item1.getLabel()).toBe("Item 1");
    });

    it("commits the rotation when the rotate gesture ends", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const rotate = findController(item1, Gtk.GestureRotate);
        expect(rotate).toBeInstanceOf(Gtk.GestureRotate);
        if (!rotate) return;
        await act(() => {
            rotate.emit("angle-changed", 0.5, 0.5);
            rotate.emit("end", null);
        });
        expect(item1.getLabel()).toBe("Item 1");
    });
});

describe("dndDemo swatch palette", () => {
    it("renders a named color swatch for the first palette color", async () => {
        await renderDemo(dndDemo);
        const redSwatch = (await screen.findByName("swatch-red")) as Gtk.Box;
        expect(redSwatch).toBeInstanceOf(Gtk.Box);
        expect(findController(redSwatch, Gtk.DragSource)).toBeInstanceOf(Gtk.DragSource);
    });

    it("renders the three named CSS pattern swatches", async () => {
        await renderDemo(dndDemo);
        expect(await screen.findByName("pattern-rainbow1")).toBeInstanceOf(Gtk.Box);
        expect(await screen.findByName("pattern-rainbow2")).toBeInstanceOf(Gtk.Box);
        expect(await screen.findByName("pattern-rainbow3")).toBeInstanceOf(Gtk.Box);
    });
});

describe("dndDemo context menu", () => {
    it("adds a new item via the context menu's New button", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const initialItemCount = canvas.observeChildren().getNItems();
        await triggerContextMenu(canvas, 50, 50);
        const newButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New" })) as Gtk.Button;
        expect(newButton).toBeInstanceOf(Gtk.Button);
        await userEvent.click(newButton);
        await waitFor(() => {
            expect(canvas.observeChildren().getNItems()).toBeGreaterThan(initialItemCount);
        });
    });

    it("opens an inline edit entry via the context menu's Edit button when right-clicking on an item", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 155, 105);
        const editButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Edit" })) as Gtk.Button;
        await waitFor(() => expect(editButton.getSensitive()).toBe(true));
        await userEvent.click(editButton);
        await waitFor(() => {
            const boxes = screen.queryAllByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(boxes.length).toBeGreaterThan(0);
        });
    });

    it("deletes the targeted item via the context menu's Delete button", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 155, 105);
        const deleteButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" })) as Gtk.Button;
        await waitFor(() => expect(deleteButton.getSensitive()).toBe(true));
        await userEvent.click(deleteButton);
        await waitFor(() => {
            expect(screen.queryByName("item1")).toBeNull();
        });
    });

    it("does not enable Edit or Delete when the context menu opens away from any item", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 600, 600);
        const editButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Edit" })) as Gtk.Button;
        const deleteButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" })) as Gtk.Button;
        expect(editButton.getSensitive()).toBe(false);
        expect(deleteButton.getSensitive()).toBe(false);
    });
});

describe("dndDemo non-context-menu click is ignored", () => {
    it("does not open the context menu when the press event reports no context-menu trigger", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const gestureClick = findController(canvas, Gtk.GestureClick);
        expect(gestureClick).toBeInstanceOf(Gtk.GestureClick);
        if (!gestureClick) return;
        const fakeEvent = { triggersContextMenu: () => false };
        const spy = vi.spyOn(gestureClick, "getCurrentEvent").mockReturnValue(fakeEvent as never);
        try {
            await act(() => {
                gestureClick.emit("pressed", 1, 100, 100);
            });
        } finally {
            spy.mockRestore();
        }
        const popover = (await screen.findByName("context-menu")) as Gtk.Popover;
        expect(popover.isVisible()).toBe(false);
    });
});

describe("dndDemo item drag-source side effects", () => {
    it("invokes the drag-begin handler on an item without throwing", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const dragSource = findController(item1, Gtk.DragSource);
        expect(dragSource).toBeInstanceOf(Gtk.DragSource);
        if (!dragSource) return;
        await act(() => {
            dragSource.emit("drag-begin", null);
            dragSource.emit("drag-end", null, false);
        });
        expect(item1.getLabel()).toBe("Item 1");
    });
});
