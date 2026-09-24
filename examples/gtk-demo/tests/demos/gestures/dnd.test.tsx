import * as Graphene from "@gtkx/gi/graphene";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { dndDemo } from "../../../src/demos/gestures/dnd.js";
import { collectWidgets, makeRgbaValue, makeStringValue, renderDemo } from "../../test-utils.js";

type ChildTransform = ReturnType<Gtk.Fixed["getChildTransform"]>;

const findCanvas = async (): Promise<Gtk.Fixed> => screen.findByName("canvas", { as: Gtk.Fixed });
const findItemLabel = async (id: string): Promise<Gtk.Label> => screen.findByName(`item${id}`, { as: Gtk.Label });

const openInlineEntryForItem1 = async (): Promise<Gtk.Entry> => {
    await renderDemo(dndDemo);
    const item1 = await findItemLabel("1");
    await userEvent.pointer(item1, "click");

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
};

const findMenuButton = async (name: string): Promise<Gtk.Button> =>
    screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button });

const openContextMenuAt = async (x: number, y: number): Promise<Gtk.Fixed> => {
    await renderDemo(dndDemo);
    const canvas = await findCanvas();
    await userEvent.longPress(canvas, x, y);

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

const expectTransformChanged = async (canvas: Gtk.Fixed, item: Gtk.Label, before: ChildTransform): Promise<void> => {
    await waitFor(() => {
        const after = canvas.getChildTransform(item);
        expect(after?.equal(before)).toBe(false);
    });
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
        await userEvent.longPress(canvas, 50, 50);
        const popover = await screen.findByName("context-menu", { as: Gtk.Popover });
        expect(popover).toBeVisible();
    });

    it("opens the context menu after a touch long press", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await userEvent.longPress(canvas, 50, 50);
        const popover = await screen.findByName("context-menu", { as: Gtk.Popover });
        expect(popover).toBeVisible();
    });
});

describe("dndDemo canvas drop", () => {
    it.each([0, 90])("keeps the grab point under the pointer after a %s degree rotation", async (angle) => {
        const entry = await openInlineEntryForItem1();
        const canvas = await findCanvas();
        const item = await findItemLabel("1");
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        await userEvent.slide(scale, angle);
        await userEvent.keyboard(entry, "{Enter}");
        await waitFor(() => {
            const [, origin] = item.computePoint(canvas, new Graphene.Point({ x: 0, y: 0 }));
            const [, right] = item.computePoint(canvas, new Graphene.Point({ x: 10, y: 0 }));
            expect(right.x - origin.x).toBeCloseTo(angle === 0 ? 10 : 0, 0);
            expect(right.y - origin.y).toBeCloseTo(angle === 0 ? 0 : 10, 0);
        });
        await userEvent.dragAndDrop(item, canvas, undefined, { x: 250, y: 200 });

        await waitFor(() => {
            const [isTranslated, point] = item.computePoint(canvas, new Graphene.Point({ x: 0, y: 0 }));
            expect(isTranslated).toBe(true);
            expect(point.x).toBeCloseTo(250, 0);
            expect(point.y).toBeCloseTo(200, 0);
        });
    });

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
    it("keeps the editor below the rotated item as its label grows", async () => {
        const entry = await openInlineEntryForItem1();
        const canvas = await findCanvas();
        const item = await findItemLabel("1");
        await userEvent.slide(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale }), 90);

        const expectEditorBelowItem = async () => {
            await waitFor(() => {
                const [hasItemBounds, itemBounds] = item.computeBounds(canvas);
                const [hasEntryBounds, entryBounds] = entry.computeBounds(canvas);
                expect(hasItemBounds).toBe(true);
                expect(hasEntryBounds).toBe(true);
                expect(entryBounds.getY()).toBeGreaterThanOrEqual(itemBounds.getY() + itemBounds.getHeight());
            });
        };

        await expectEditorBelowItem();
        await userEvent.clear(entry);
        await userEvent.type(entry, "A longer item label");
        await expectEditorBelowItem();
    });

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

describe("dndDemo item targeting", () => {
    it("closes the inline editor when its item is clicked again", async () => {
        await openInlineEntryForItem1();
        await userEvent.pointer(await findItemLabel("1"), "click");

        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX)).toBeNull();
        });
    });

    it("does not target the empty area beside an item", async () => {
        const { canvas, item1 } = await renderCanvasItem();
        const [isMeasured, bounds] = item1.computeBounds(canvas);
        expect(isMeasured).toBe(true);
        await userEvent.longPress(canvas, bounds.getX() + bounds.getWidth() + 5, bounds.getY() + 5);
        expect(await findMenuButton("Edit")).toBeDisabled();
        expect(await findMenuButton("Delete")).toBeDisabled();
    });

    it("targets the visible shape after rotating an item", async () => {
        const entry = await openInlineEntryForItem1();
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        await userEvent.slide(scale, 90);
        await userEvent.keyboard(entry, "{Enter}");
        const local = new Graphene.Point();
        local.init(2, item1.getHeight() / 2);
        const [isTranslated, point] = item1.computePoint(canvas, local);
        expect(isTranslated).toBe(true);
        await userEvent.longPress(canvas, point.x, point.y);
        await clickEnabledMenuButton("Edit");
        expect(await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Item 1");
    });

    it("targets the frontmost item where two items overlap", async () => {
        const { canvas, item1 } = await renderCanvasItem();
        const item2 = await findItemLabel("2");
        await userEvent.drop(canvas, makeStringValue("2"), { x: 100, y: 100 });
        const [firstX, firstY] = canvas.getChildPosition(item1);
        const [secondX, secondY] = canvas.getChildPosition(item2);
        await userEvent.longPress(canvas, Math.max(firstX, secondX) + 5, Math.max(firstY, secondY) + 5);
        await clickEnabledMenuButton("Delete");

        await waitFor(() => {
            expect(screen.queryByName("item2")).toBeNull();
        });
        expect(await findItemLabel("1")).toHaveTextContent("Item 1");
    });
});

describe("dndDemo item rotation", () => {
    it("changes the item transform while the rotate gesture reports an angle delta", async () => {
        const { canvas, item1 } = await renderCanvasItem();
        const before = canvas.getChildTransform(item1);
        await userEvent.rotate(item1, 0.5, 0.5);
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

    it("shows a negative gesture angle as its equivalent positive rotation", async () => {
        const { item1 } = await renderCanvasItem();
        await userEvent.rotate(item1, -Math.PI / 2);
        await userEvent.pointer(item1, "click");
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        expect(scale.getValue()).toBeCloseTo(270, 1);
    });
});

describe("dndDemo context menu", () => {
    it("starts new item numbering from five each time the demo opens", async () => {
        const first = await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await userEvent.longPress(canvas, 50, 50);
        const initialItemCount = within(canvas).getAllByText(/^Item /).length;
        await userEvent.click(await findMenuButton("New"));

        await waitFor(() => {
            expect(within(canvas).getAllByText(/^Item /)).toHaveLength(initialItemCount + 1);
            expect(within(canvas).getByText("Item 5")).toBeVisible();
        });

        await first.unmount();
        await renderDemo(dndDemo);
        const reopenedCanvas = await findCanvas();
        await userEvent.longPress(reopenedCanvas, 50, 50);
        await userEvent.click(await findMenuButton("New"));
        expect(within(reopenedCanvas).getByText("Item 5")).toBeVisible();
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
    it("does not open the context menu for a primary click", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        await userEvent.click(canvas);

        expect(screen.queryByName("context-menu")).toBeNull();
    });
});

describe("dndDemo trash zone", () => {
    it("deletes an item when its id is dropped on the trash zone", async () => {
        await renderDemo(dndDemo);
        const canvas = await findCanvas();
        const item1 = await findItemLabel("1");
        const trash = collectWidgets(canvas, Gtk.Box).find((box) => box.getName() === "trash-zone");

        if (!trash) {
            throw new Error("the drag canvas has no trash zone");
        }

        await userEvent.dragAndDrop(item1, trash, makeStringValue("1"));

        await waitFor(() => {
            expect(screen.queryByName("item1")).toBeNull();
        });

        expect(await screen.findByText("Item 2")).toHaveTextContent("Item 2");
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
