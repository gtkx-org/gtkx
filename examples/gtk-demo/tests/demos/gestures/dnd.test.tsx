import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { dndDemo } from "../../../src/demos/gestures/dnd.js";
import { makeRgbaValue, makeStringValue, renderDemo } from "../../test-utils.js";

const findCanvas = async (): Promise<Gtk.Fixed> => (await screen.findByName("canvas")) as Gtk.Fixed;
const findItemLabel = async (id: string): Promise<Gtk.Label> => (await screen.findByName(`item${id}`)) as Gtk.Label;

const findController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    type: new (...args: never[]) => T,
): T | null => {
    const list = widget.observeControllers();

    for (let i = 0; i < list.getNItems(); i++) {
        const item = list.getItem(i);

        if (item instanceof type) {
            return item;
        }
    }

    return null;
};

const openInlineEntryForItem1 = async (): Promise<Gtk.Entry> => {
    await renderDemo(dndDemo);
    const item1 = await findItemLabel("1");
    await userEvent.pointer(item1, "click");

    return (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
};

const triggerContextMenu = async (canvas: Gtk.Fixed, x: number, y: number): Promise<void> => {
    const gestureClick = findController(canvas, Gtk.GestureClick);
    expect(gestureClick).toBeInstanceOf(Gtk.GestureClick);

    if (!gestureClick) {
        return;
    }

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

const beginDragRevealingTrash = async (item: Gtk.Label, trash: Gtk.Box): Promise<Gtk.DragSource | null> => {
    const dragSource = findController(item, Gtk.DragSource);
    expect(dragSource).toBeInstanceOf(Gtk.DragSource);

    if (!dragSource) {
        return null;
    }

    await act(() => {
        dragSource.emit("drag-begin", null);
    });

    await waitFor(() => {
        expect(trash.getVisible()).toBe(true);
    });

    return dragSource;
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
        const [width, height] = window.getDefaultSize();
        expect(width).toBe(640);
        expect(height).toBe(480);
    });
});

describe("dndDemo initial canvas", () => {
    it("renders the four labelled items inside the canvas", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        expect(await screen.findByText("Item 1")).toHaveTextContent("Item 1");
        expect(within(canvas).getAllByText(/^Item /)).toHaveLength(4);

        for (const label of ["Item 1", "Item 2", "Item 3", "Item 4"]) {
            expect(within(canvas).getByText(label)).toHaveTextContent(label);
        }
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
        const [beforeX, beforeY] = canvas.getChildPosition(item1);
        await userEvent.drop(canvas, makeStringValue("1"), { x: 250, y: 250 });

        await waitFor(() => {
            const [afterX, afterY] = canvas.getChildPosition(item1);
            expect([afterX, afterY]).not.toEqual([beforeX, beforeY]);
        });
    });
});

describe("dndDemo item styling", () => {
    it("applies a CSS class to an item when a class name is dropped on it", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        await userEvent.drop(item1, makeStringValue("my-custom-class"));

        await waitFor(() => {
            expect(item1.getCssClasses()).toEqual(expect.arrayContaining(["my-custom-class"]));
        });
    });

    it("applies an RGBA color style to an item when a color is dropped on it", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const beforeClasses = new Set(item1.getCssClasses());
        await userEvent.drop(item1, makeRgbaValue(0.1, 0.2, 0.3, 1));

        await waitFor(() => {
            const afterClasses = new Set(item1.getCssClasses());
            expect(afterClasses.difference(beforeClasses).size).toBe(1);
            expect(beforeClasses.difference(afterClasses).size).toBe(1);
        });
    });
});

describe("dndDemo inline editing", () => {
    it("opens an inline entry for the item when the item is clicked", async () => {
        const entry = await openInlineEntryForItem1();
        expect(entry).toHaveDisplayValue("Item 1");
    });

    it("updates the item label as the user types into the inline entry", async () => {
        const entry = await openInlineEntryForItem1();
        await userEvent.clear(entry);
        await userEvent.type(entry, "Renamed");
        expect(await screen.findByText("Renamed")).toBeInstanceOf(Gtk.Widget);
    });

    it("closes the inline entry when Enter is pressed", async () => {
        const entry = await openInlineEntryForItem1();
        await userEvent.keyboard(entry, "{Enter}");

        await waitFor(() => {
            expect(screen.queryAllByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveLength(0);
        });
    });
});

describe("dndDemo item rotation", () => {
    it("changes the item transform while the rotate gesture reports an angle delta", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const before = canvas.getChildTransform(item1);
        await userEvent.rotate(item1, 0.5, 0.5);

        await waitFor(() => {
            const after = canvas.getChildTransform(item1);
            expect(after?.equal(before)).toBe(false);
        });
    });

    it("commits the rotation to the item transform when the rotate gesture ends", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const rotate = findController(item1, Gtk.GestureRotate);
        expect(rotate).toBeInstanceOf(Gtk.GestureRotate);

        if (!rotate) {
            return;
        }

        const before = canvas.getChildTransform(item1);

        await act(() => {
            rotate.emit("angle-changed", 0.5, 0.5);
            rotate.emit("end", null);
        });

        await waitFor(() => {
            const after = canvas.getChildTransform(item1);
            expect(after?.equal(before)).toBe(false);
        });
    });

    it("rotates the item when the inline editor scale value changes", async () => {
        await openInlineEntryForItem1();
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const before = canvas.getChildTransform(item1);
        const scale = (await screen.findByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale;
        await userEvent.slide(scale, 90);

        await waitFor(() => {
            expect(scale.getValue()).toBeCloseTo(90, 1);
            const after = canvas.getChildTransform(item1);
            expect(after?.equal(before)).toBe(false);
        });
    });
});

describe("dndDemo swatch palette", () => {
    it("exposes an RGBA content provider from the red color swatch drag source", async () => {
        await renderDemo(dndDemo);
        const redSwatch = (await screen.findByName("swatch-red")) as Gtk.Box;
        const dragSource = findController(redSwatch, Gtk.DragSource);
        expect(dragSource).toBeInstanceOf(Gtk.DragSource);
        const provider = dragSource?.emit("prepare", 0, 0) as Gdk.ContentProvider | null;
        expect(provider).toBeInstanceOf(Gdk.ContentProvider);
        expect(provider?.refFormats().containGtype(GObject.typeFromName("GdkRGBA"))).toBe(true);
    });

    it("exposes a string css-class content provider from each CSS pattern swatch drag source", async () => {
        await renderDemo(dndDemo);

        for (const id of ["rainbow1", "rainbow2", "rainbow3"]) {
            const swatch = (await screen.findByName(`pattern-${id}`)) as Gtk.Box;
            const dragSource = findController(swatch, Gtk.DragSource);
            expect(dragSource).toBeInstanceOf(Gtk.DragSource);
            const provider = dragSource?.emit("prepare", 0, 0) as Gdk.ContentProvider | null;
            expect(provider).toBeInstanceOf(Gdk.ContentProvider);
            expect(provider?.refFormats().containGtype(GObject.TYPE_STRING)).toBe(true);
        }
    });
});

describe("dndDemo context menu", () => {
    it("adds a new item via the context menu's New button", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const initialItemCount = within(canvas).getAllByText(/^Item /).length;
        await triggerContextMenu(canvas, 50, 50);
        const newButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New" })) as Gtk.Button;
        await userEvent.click(newButton);

        await waitFor(() => {
            expect(within(canvas).getAllByText(/^Item /)).toHaveLength(initialItemCount + 1);
        });
    });

    it("opens an inline edit entry via the context menu's Edit button when right-clicking on an item", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 45, 45);
        const editButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Edit" })) as Gtk.Button;

        await waitFor(() => {
            expect(editButton.getSensitive()).toBe(true);
        });

        await userEvent.click(editButton);

        await waitFor(() => {
            const boxes = screen.queryAllByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(boxes).toHaveLength(1);
            expect(boxes[0]).toHaveDisplayValue("Item 1");
        });
    });

    it("deletes the targeted item via the context menu's Delete button", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 45, 45);
        const menuDeleteButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" })) as Gtk.Button;

        await waitFor(() => {
            expect(menuDeleteButton.getSensitive()).toBe(true);
        });

        await userEvent.click(menuDeleteButton);

        await waitFor(() => {
            expect(screen.queryByName("item1")).toBeNull();
        });
    });

    it("does not enable Edit or Delete when the context menu opens away from any item", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 600, 600);
        const editButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Edit" })) as Gtk.Button;
        const menuDeleteButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" })) as Gtk.Button;
        expect(editButton.getSensitive()).toBe(false);
        expect(menuDeleteButton.getSensitive()).toBe(false);
    });
});

describe("dndDemo non-context-menu click is ignored", () => {
    it("does not open the context menu when the press event reports no context-menu trigger", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const gestureClick = findController(canvas, Gtk.GestureClick);
        expect(gestureClick).toBeInstanceOf(Gtk.GestureClick);

        if (!gestureClick) {
            return;
        }

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
    it("dims the item and reveals the trash zone on drag-begin, then restores them on drag-end", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const trash = (await screen.findByName("trash-zone")) as Gtk.Box;
        expect(trash.getVisible()).toBe(false);
        const dragSource = await beginDragRevealingTrash(item1, trash);

        if (!dragSource) {
            return;
        }

        await waitFor(() => {
            expect(item1.getOpacity()).toBeCloseTo(0.3, 2);
        });

        await act(() => {
            dragSource.emit("drag-end", null, false);
        });

        await waitFor(() => {
            expect(item1.getOpacity()).toBeCloseTo(1, 2);
            expect(trash.getVisible()).toBe(false);
        });
    });

    it("sets the drag icon from a fractional pointer hotspot", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const dragSource = findController(item1, Gtk.DragSource);
        expect(dragSource).toBeInstanceOf(Gtk.DragSource);

        if (!dragSource) {
            return;
        }

        await act(() => {
            dragSource.emit("prepare", 181.5, 7.5);
        });

        await act(() => {
            dragSource.emit("drag-begin", null);
        });

        await waitFor(() => {
            expect(item1.getOpacity()).toBeCloseTo(0.3, 2);
        });
    });
});

describe("dndDemo trash zone", () => {
    it("deletes an item when its id is dropped on the trash zone", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const trash = (await screen.findByName("trash-zone")) as Gtk.Box;

        if (!(await beginDragRevealingTrash(item1, trash))) {
            return;
        }

        await userEvent.drop(trash, makeStringValue("1"));

        await waitFor(() => {
            expect(screen.queryByName("item1")).toBeNull();
        });

        expect(await screen.findByText("Item 2")).toHaveTextContent("Item 2");
    });

    it("highlights the trash zone with a background class on drop-target enter and clears it on leave", async () => {
        await renderDemo(dndDemo);
        const trash = (await screen.findByName("trash-zone")) as Gtk.Box;
        const dropTarget = findController(trash, Gtk.DropTarget);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);

        if (!dropTarget) {
            return;
        }

        const before = new Set(trash.getCssClasses());

        await act(() => {
            dropTarget.emit("enter", 0, 0);
        });

        await waitFor(() => {
            const added = trash.getCssClasses().filter((c) => !before.has(c));
            expect(added).toHaveLength(1);
        });

        await act(() => {
            dropTarget.emit("leave");
        });

        await waitFor(() => {
            expect(new Set(trash.getCssClasses())).toEqual(before);
        });
    });
});

describe("dndDemo z-order", () => {
    it("brings a clicked item to the front of the canvas z-order", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();

        const labelOrder = (): string[] =>
            within(canvas)
                .getAllByText(/^Item /)
                .map((w) => (w as Gtk.Label).getText());

        expect(labelOrder().at(-1)).not.toBe("Item 1");
        const item1 = await findItemLabel("1");
        await userEvent.pointer(item1, "click");

        await waitFor(() => {
            expect(labelOrder().at(-1)).toBe("Item 1");
        });
    });
});
