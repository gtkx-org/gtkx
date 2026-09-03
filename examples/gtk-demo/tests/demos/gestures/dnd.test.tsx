import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act, queryController, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { dndDemo } from "../../../src/demos/gestures/dnd.js";
import { makeRgbaValue, makeStringValue, renderDemo } from "../../test-utils.js";

type ChildTransform = ReturnType<Gtk.Fixed["getChildTransform"]>;

const findCanvas = async (): Promise<Gtk.Fixed> => screen.findByName("canvas", { as: Gtk.Fixed });
const findItemLabel = async (id: string): Promise<Gtk.Label> => screen.findByName(`item${id}`, { as: Gtk.Label });

const openInlineEntryForItem1 = async (): Promise<Gtk.Entry> => {
    await renderDemo(dndDemo);
    const item1 = await findItemLabel("1");
    await userEvent.pointer(item1, "click");

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
};

const triggerContextMenu = async (canvas: Gtk.Fixed, x: number, y: number): Promise<void> => {
    const gestureClick = queryController(canvas, Gtk.GestureClick);
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

const findMenuButton = async (name: string): Promise<Gtk.Button> =>
    screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button });

const openContextMenuAt = async (x: number, y: number): Promise<Gtk.Fixed> => {
    await renderDemo(dndDemo);
    const canvas = await findCanvas();
    await triggerContextMenu(canvas, x, y);

    return canvas;
};

const clickEnabledMenuButton = async (name: string): Promise<void> => {
    const button = await findMenuButton(name);

    await waitFor(() => {
        expect(button).toBeEnabled();
    });

    await userEvent.click(button);
};

const renderCanvasItem = async (): Promise<{ canvas: Gtk.Fixed; item1: Gtk.Label }> => {
    await renderDemo(dndDemo);
    const canvas = await findCanvas();
    const item1 = await findItemLabel("1");

    return { canvas, item1 };
};

const findTrashZone = async (): Promise<Gtk.Box> => screen.findByName("trash-zone", { as: Gtk.Box });

const renderItemWithTrashHidden = async (): Promise<Gtk.Label> => {
    await renderDemo(dndDemo);
    const item1 = await findItemLabel("1");
    expect(screen.queryByName("trash-zone")).toBeNull();

    return item1;
};

const expectTransformChanged = async (canvas: Gtk.Fixed, item: Gtk.Label, before: ChildTransform): Promise<void> => {
    await waitFor(() => {
        const after = canvas.getChildTransform(item);
        expect(after?.equal(before)).toBe(false);
    });
};

const beginItemDrag = async (item: Gtk.Label): Promise<Gtk.DragSource> => {
    const dragSource = queryController(item, Gtk.DragSource);

    if (!dragSource) {
        throw new TypeError("expected a Gtk.DragSource on the item");
    }

    await act(() => {
        Reflect.apply(GObject.signalEmit, undefined, [dragSource, "drag-begin", null]);
    });

    return dragSource;
};

describe("dndDemo metadata", () => {
    it("applies the default 640x480 size to the host window", async () => {
        await renderDemo(dndDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
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

    it("shows no context-menu popover until a context-menu press opens one", async () => {
        await renderDemo(dndDemo);
        expect(screen.queryByName("context-menu")).toBeNull();
        const canvas = await findCanvas();
        await triggerContextMenu(canvas, 50, 50);
        const popover = await screen.findByName("context-menu", { as: Gtk.Popover });
        expect(popover).toBeVisible();
    });
});

describe("dndDemo canvas drop", () => {
    it("moves an item to the dropped location when its id is dropped on the canvas", async () => {
        const { canvas, item1 } = await renderCanvasItem();
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
            expect(item1).toHaveClass("my-custom-class");
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
        expect(await findItemLabel("1")).toHaveTextContent("Renamed");
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
        const { canvas, item1 } = await renderCanvasItem();
        const before = canvas.getChildTransform(item1);
        await userEvent.rotate(item1, 0.5, 0.5);
        await expectTransformChanged(canvas, item1, before);
    });

    it("commits the rotation to the item transform when the rotate gesture ends", async () => {
        const { canvas, item1 } = await renderCanvasItem();
        const rotate = queryController(item1, Gtk.GestureRotate);
        expect(rotate).toBeInstanceOf(Gtk.GestureRotate);

        if (!rotate) {
            return;
        }

        const before = canvas.getChildTransform(item1);

        await act(() => {
            rotate.emit("angle-changed", 0.5, 0.5);
            rotate.emit("end", null);
        });

        await expectTransformChanged(canvas, item1, before);
    });

    it("rotates the item when the inline editor scale value changes", async () => {
        await openInlineEntryForItem1();
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const before = canvas.getChildTransform(item1);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
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
        const redSwatch = await screen.findByName("swatch-red", { as: Gtk.Box });
        const dragSource = queryController(redSwatch, Gtk.DragSource);
        expect(dragSource).toBeInstanceOf(Gtk.DragSource);
        const provider = dragSource?.emit("prepare", 0, 0) as Gdk.ContentProvider | null;
        expect(provider).toBeInstanceOf(Gdk.ContentProvider);
        expect(provider?.refFormats().containGtype(GObject.typeFromName("GdkRGBA"))).toBe(true);
    });

    it("exposes a string css-class content provider from each CSS pattern swatch drag source", async () => {
        await renderDemo(dndDemo);

        for (const id of ["rainbow1", "rainbow2", "rainbow3"]) {
            const swatch = await screen.findByName(`pattern-${id}`, { as: Gtk.Box });
            const dragSource = queryController(swatch, Gtk.DragSource);
            expect(dragSource).toBeInstanceOf(Gtk.DragSource);
            const provider = dragSource?.emit("prepare", 0, 0) as Gdk.ContentProvider | null;
            expect(provider).toBeInstanceOf(Gdk.ContentProvider);
            expect(provider?.refFormats().containGtype(GObject.TYPE_STRING)).toBe(true);
        }
    });
});

describe("dndDemo context menu", () => {
    it("adds a new item via the context menu's New button", async () => {
        const canvas = await openContextMenuAt(50, 50);
        const initialItemCount = within(canvas).getAllByText(/^Item /).length;
        await userEvent.click(await findMenuButton("New"));

        await waitFor(() => {
            expect(within(canvas).getAllByText(/^Item /)).toHaveLength(initialItemCount + 1);
        });
    });

    it("opens an inline edit entry via the context menu's Edit button when right-clicking on an item", async () => {
        await openContextMenuAt(45, 45);
        await clickEnabledMenuButton("Edit");

        await waitFor(() => {
            const boxes = screen.queryAllByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(boxes).toHaveLength(1);
            expect(boxes[0]).toHaveDisplayValue("Item 1");
        });
    });

    it("deletes the targeted item via the context menu's Delete button", async () => {
        await openContextMenuAt(45, 45);
        await clickEnabledMenuButton("Delete");

        await waitFor(() => {
            expect(screen.queryByName("item1")).toBeNull();
        });
    });

    it("rounds fractional pointer coordinates into the popover's integer pointing rectangle", async () => {
        await openContextMenuAt(225.5, 130.25);
        const popover = await screen.findByName("context-menu", { as: Gtk.Popover });
        const [ok, rectangle] = popover.getPointingTo();
        expect(ok).toBe(true);
        expect([rectangle.x, rectangle.y]).toEqual([226, 130]);
    });

    it("does not enable Edit or Delete when the context menu opens away from any item", async () => {
        await openContextMenuAt(600, 600);
        const editButton = await findMenuButton("Edit");
        const menuDeleteButton = await findMenuButton("Delete");
        expect(editButton).toBeDisabled();
        expect(menuDeleteButton).toBeDisabled();
    });
});

describe("dndDemo non-context-menu click is ignored", () => {
    it("does not open the context menu when the press event reports no context-menu trigger", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const gestureClick = queryController(canvas, Gtk.GestureClick);
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

        expect(screen.queryByName("context-menu")).toBeNull();
    });
});

describe("dndDemo item drag-source side effects", () => {
    it("dims the item and reveals the trash zone on drag-begin, then restores them on drag-end", async () => {
        const item1 = await renderItemWithTrashHidden();
        const dragSource = await beginItemDrag(item1);
        await findTrashZone();

        await waitFor(() => {
            expect(item1.getOpacity()).toBeCloseTo(0.3, 2);
        });

        await act(() => {
            Reflect.apply(GObject.signalEmit, undefined, [dragSource, "drag-end", null, false]);
        });

        await waitFor(() => {
            expect(item1.getOpacity()).toBeCloseTo(1, 2);
            expect(screen.queryByName("trash-zone")).toBeNull();
        });
    });

    it("sets the drag icon from a fractional pointer hotspot", async () => {
        await renderDemo(dndDemo);
        const item1 = await findItemLabel("1");
        const dragSource = queryController(item1, Gtk.DragSource);
        expect(dragSource).toBeInstanceOf(Gtk.DragSource);

        if (!dragSource) {
            return;
        }

        await act(() => {
            dragSource.emit("prepare", 181.5, 7.5);
        });

        await act(() => {
            Reflect.apply(GObject.signalEmit, undefined, [dragSource, "drag-begin", null]);
        });

        await waitFor(() => {
            expect(item1.getOpacity()).toBeCloseTo(0.3, 2);
        });
    });
});

describe("dndDemo trash zone", () => {
    it("deletes an item when its id is dropped on the trash zone", async () => {
        const item1 = await renderItemWithTrashHidden();
        await beginItemDrag(item1);
        const trash = await findTrashZone();
        await userEvent.drop(trash, makeStringValue("1"));

        await waitFor(() => {
            expect(screen.queryByName("item1")).toBeNull();
        });

        expect(await screen.findByText("Item 2")).toHaveTextContent("Item 2");
    });

    it("highlights the trash zone with a background class on drop-target enter and clears it on leave", async () => {
        const item1 = await renderItemWithTrashHidden();
        await beginItemDrag(item1);
        const trash = await findTrashZone();
        const dropTarget = queryController(trash, Gtk.DropTarget);
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
                .getAllByText(/^Item /, { as: Gtk.Label })
                .map((w) => w.getText());

        expect(labelOrder().at(-1)).not.toBe("Item 1");
        const item1 = await findItemLabel("1");
        await userEvent.pointer(item1, "click");

        await waitFor(() => {
            expect(labelOrder().at(-1)).toBe("Item 1");
        });
    });
});
