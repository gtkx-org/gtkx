import type { ComponentProps } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDropDown,
    GtkDropTarget,
    GtkEntry,
    GtkEventControllerKey,
    GtkEventControllerMotion,
    GtkGestureClick,
    GtkGestureDrag,
    GtkGestureLongPress,
    GtkGestureRotate,
    GtkGestureSwipe,
    GtkGestureZoom,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "../src/index.js";
import {
    renderClickButton,
    renderDragAndDropPair,
    renderGesturedLabel,
    renderShortcutHost,
} from "./event-render-setup.js";

const hasWidgetFocus = (w: Gtk.Widget): boolean => w.isFocus();

const editableText = (entry: Gtk.Widget): string => {
    if (!(entry instanceof Gtk.Editable)) {
        throw new TypeError("Element is not editable");
    }

    return entry.getText();
};

const renderTextBox = async (text?: string): Promise<Gtk.Widget> => {
    await render(<GtkEntry text={text} />);

    return screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
};

const renderDropDown = async (options: string[]): Promise<Gtk.Widget> => {
    await render(<GtkDropDown model={Gtk.StringList.new(options)} />);

    return screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
};

const actOnPlainButton = async (action: (button: Gtk.Widget) => Promise<unknown>): Promise<unknown> => {
    await render(<GtkButton label="Test" />);
    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });

    return action(button);
};

const renderTwoItemListBox = async (selectionMode?: Gtk.SelectionMode): Promise<Gtk.Widget> => {
    await render(
        <GtkListBox selectionMode={selectionMode}>
            <GtkListBoxRow>
                <GtkLabel>Item 1</GtkLabel>
            </GtkListBoxRow>
            <GtkListBoxRow>
                <GtkLabel>Item 2</GtkLabel>
            </GtkListBoxRow>
        </GtkListBox>,
    );

    return screen.findByRole(Gtk.AccessibleRole.LIST);
};

const selectAll = (widget: Gtk.Widget): void => {
    if (widget instanceof Gtk.Editable) {
        widget.selectRegion(0, -1);
    }
};

const renderSelectedEntryPair = async (text: string): Promise<{ source: Gtk.Widget; dest: Gtk.Widget }> => {
    await render(
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkEntry text={text} name="source" />
            <GtkEntry name="dest" />
        </GtkBox>,
    );

    const source = await screen.findByName("source");
    const dest = await screen.findByName("dest");
    selectAll(source);

    return { source, dest };
};

const record = (events: string[]) => ({
    onDragBegin: () => {
        events.push("begin");
    },
    onDragUpdate: () => {
        events.push("update");
    },
    onDragEnd: () => {
        events.push("end");
    },
});

const renderDropZone = async (
    name: string,
    label: string,
    gtype: GObject.Type,
    onDrop: ComponentProps<typeof GtkDropTarget>["onDrop"],
): Promise<Gtk.Widget> => {
    await render(
        <GtkLabel
            name={name}
            controllers={<GtkDropTarget types={[gtype]} actions={Gdk.DragAction.COPY} onDrop={onDrop} />}
        >
            {label}
        </GtkLabel>,
    );

    return screen.findByName(name);
};

async function renderDragUpdateCapture() {
    const updates: [number, number][] = [];

    const label = await renderGesturedLabel(
        "dragged",
        "Drag me",
        <GtkGestureDrag
            onDragUpdate={(offsetX, offsetY) => {
                updates.push([offsetX, offsetY]);
            }}
        />,
    );

    return { label, updates };
}

async function renderDragSelfCapture<T>(read: (self: Gtk.GestureDrag) => T) {
    const values: T[] = [];

    const label = await renderGesturedLabel(
        "dragged",
        "Drag me",
        <GtkGestureDrag
            onDragUpdate={(_offsetX, _offsetY, self) => {
                values.push(read(self));
            }}
        />,
    );

    return { label, values };
}

async function renderRotateLabel() {
    const handleAngleChanged = vi.fn<(angle: number, delta: number) => void>();

    const label = await renderGesturedLabel(
        "rotated",
        "Rotate me",
        <GtkGestureRotate onAngleChanged={handleAngleChanged} />,
    );

    return { label, handleAngleChanged };
}

async function renderLongPressLabel() {
    const handlePressed = vi.fn<(x: number, y: number) => void>();

    const label = await renderGesturedLabel(
        "long-pressed",
        "Long press me",
        <GtkGestureLongPress onPressed={handlePressed} />,
    );

    return { label, handlePressed };
}

async function renderFanOutButton() {
    const handleClick = vi.fn();
    const handlePressed = vi.fn();
    const handleReleased = vi.fn();

    await render(
        <GtkButton
            label="Fan out"
            onClicked={handleClick}
            controllers={<GtkGestureClick onPressed={handlePressed} onReleased={handleReleased} />}
        />,
    );

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Fan out" });

    return { button, handleClick, handlePressed, handleReleased };
}

async function renderDoubleMotionLabel() {
    const firstEnter = vi.fn();
    const secondEnter = vi.fn();
    const firstLeave = vi.fn();
    const secondLeave = vi.fn();

    const label = await renderGesturedLabel(
        "hovered",
        "Hover me",
        <>
            <GtkEventControllerMotion onEnter={firstEnter} onLeave={firstLeave} />
            <GtkEventControllerMotion onEnter={secondEnter} onLeave={secondLeave} />
        </>,
    );

    return { label, firstEnter, secondEnter, firstLeave, secondLeave };
}

async function renderDoubleDragLabel() {
    const firstEvents: string[] = [];
    const secondEvents: string[] = [];

    const label = await renderGesturedLabel(
        "multi-dragged",
        "Drag me",
        <>
            <GtkGestureDrag {...record(firstEvents)} />
            <GtkGestureDrag {...record(secondEvents)} />
        </>,
    );

    return { label, firstEvents, secondEvents };
}

async function renderDoubleKeyEntry() {
    const firstPressed = vi.fn();
    const secondPressed = vi.fn();

    await render(
        <GtkEntry
            name="multi-key"
            controllers={(
                <>
                    <GtkEventControllerKey onKeyPressed={firstPressed} />
                    <GtkEventControllerKey onKeyPressed={secondPressed} />
                </>
            )}
        />,
    );

    const entry = await screen.findByName("multi-key");

    return { entry, firstPressed, secondPressed };
}

describe("userEvent.click", () => {
    it("emits clicked signal on button", async () => {
        const { handleClick, button } = await renderClickButton();
        await userEvent.click(button);

        await waitFor(() => {
            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    it("toggles checkbox state", async () => {
        await render(<GtkCheckButton label="Option" />);
        const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX);
        await userEvent.click(checkbox);
        const checked = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checked).toBeDefined();
    });

    it("toggles switch state", async () => {
        await render(<GtkSwitch />);
        const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        await userEvent.click(switchWidget);
        const active = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(active).toBeDefined();
    });

    it("toggles toggle button state", async () => {
        await render(<GtkToggleButton label="Toggle" />);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON);
        await userEvent.click(toggle);
        const active = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true });
        expect(active).toBeDefined();
    });
});

describe("userEvent.dblClick", () => {
    it("emits clicked signal twice", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Double click me" onClicked={handleClick} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Double click me" });
        await userEvent.dblClick(button);
        expect(handleClick).toHaveBeenCalledTimes(2);
    });
});

describe("userEvent.tripleClick", () => {
    it("emits clicked signal three times", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Triple click me" onClicked={handleClick} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Triple click me" });
        await userEvent.tripleClick(button);
        expect(handleClick).toHaveBeenCalledTimes(3);
    });
});

describe("userEvent.type", () => {
    it("types text into entry", async () => {
        const entry = await renderTextBox();
        await userEvent.type(entry, "Hello World");
        expect(editableText(entry)).toBe("Hello World");
    });

    it("appends text to existing content", async () => {
        const entry = await renderTextBox("Initial ");
        await userEvent.type(entry, "appended");
        expect(editableText(entry)).toBe("Initial appended");
    });

    it("inserts at a collapsed initial selection", async () => {
        const entry = await renderTextBox("ac");
        await userEvent.type(entry, "b", { initialSelectionStart: 1 });
        expect(editableText(entry)).toBe("abc");
    });

    it("replaces the text under an initial selection range", async () => {
        const entry = await renderTextBox("Hello World");
        await userEvent.type(entry, "Goodbye", { initialSelectionStart: 0, initialSelectionEnd: 5 });
        expect(editableText(entry)).toBe("Goodbye World");
    });

    it("skips grabFocus when shouldFocus is false", async () => {
        const entry = await renderTextBox();
        const grabFocus = vi.spyOn(entry, "grabFocus");
        await userEvent.type(entry, "typed", { shouldFocus: false });
        expect(grabFocus).not.toHaveBeenCalled();
        expect(editableText(entry)).toBe("typed");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await expect(actOnPlainButton((button) => userEvent.type(button, "text"))).rejects.toThrow(
                "Cannot type into element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
            );
        });
    });
});

describe("userEvent.keyboard — held modifier state", () => {
    it("retains a held modifier across calls until it is released", async () => {
        const onActivate = vi.fn(() => true);
        const host = await renderShortcutHost(Gtk.ShortcutTrigger.parseString("<Shift>F5"), onActivate);
        await userEvent.keyboard(host, "{Shift>}");
        await userEvent.keyboard(host, "{F5}");
        expect(onActivate).toHaveBeenCalledTimes(1);
        await userEvent.keyboard(host, "{/Shift}");
        await userEvent.keyboard(host, "{F5}");
        expect(onActivate).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent.clear", () => {
    it("clears text from entry", async () => {
        const entry = await renderTextBox("Some text");
        await userEvent.clear(entry);
        expect(editableText(entry)).toBe("");
    });

    it("delivers the clear sequence through the instance's held modifiers", async () => {
        const presses: [number, number, number][] = [];

        const onKeyPressed = vi.fn((keyval: number, keycode: number, modifiers: number): boolean => {
            presses.push([keyval, keycode, modifiers]);

            return false;
        });

        await render(<GtkEntry text="abc" controllers={<GtkEventControllerKey onKeyPressed={onKeyPressed} />} />);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        const user = userEvent.setup();
        await user.keyboard(entry, "{Shift>}");
        await user.clear(entry);
        await user.keyboard(entry, "{/Shift}");

        const isShiftCarried = presses.some(
            ([keyval, , modifiers]) =>
                keyval === Gdk.KEY_a &&
                (modifiers & Gdk.ModifierType.SHIFT_MASK) !== 0 &&
                (modifiers & Gdk.ModifierType.CONTROL_MASK) !== 0,
        );

        expect(isShiftCarried).toBe(true);
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await expect(actOnPlainButton((button) => userEvent.clear(button))).rejects.toThrow(
                "Cannot clear element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
            );
        });

        it("throws when the widget refuses edits", async () => {
            await render(<GtkEntry text="Locked" editable={false} />);
            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);

            await expect(userEvent.clear(entry)).rejects.toThrow(
                "Cannot clear element: the widget is not editable",
            );
        });
    });
});

describe("userEvent.tab", () => {
    it("moves focus forward", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const first = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        first.grabFocus();
        await userEvent.tab(first);
        const second = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        expect(hasWidgetFocus(second)).toBe(true);
    });

    it("moves focus backward with isShiftHeld option", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const second = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        second.grabFocus();
        await userEvent.tab(second, { isShiftHeld: true });
        const first = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        expect(hasWidgetFocus(first)).toBe(true);
    });
});

describe("userEvent clipboard", () => {
    it("copies a selection and pastes it into another editable", async () => {
        const { source, dest } = await renderSelectedEntryPair("copy me");
        await userEvent.copy(source);
        await userEvent.paste(dest);
        expect(editableText(dest)).toBe("copy me");
    });

    it("cuts a selection, emptying the source, and pastes it elsewhere", async () => {
        const { source, dest } = await renderSelectedEntryPair("cut me");
        await userEvent.cut(source);
        expect(editableText(source)).toBe("");
        await userEvent.paste(dest);
        expect(editableText(dest)).toBe("cut me");
    });

    it("pastes explicit text", async () => {
        await render(<GtkEntry name="literal" />);
        const entry = await screen.findByName("literal");
        await userEvent.paste(entry, "pasted literal");
        expect(editableText(entry)).toBe("pasted literal");
    });

    describe("error handling", () => {
        it("rejects copy on a non-editable widget", async () => {
            await expect(actOnPlainButton((button) => userEvent.copy(button))).rejects.toThrow("Cannot copy");
        });

        it("rejects paste on a non-editable widget", async () => {
            await expect(actOnPlainButton((button) => userEvent.paste(button, "text"))).rejects.toThrow(
                "Cannot paste",
            );
        });
    });
});

describe("userEvent.selectOptions", () => {
    it("selects option in dropdown by index", async () => {
        const dropdown = await renderDropDown(["Option A", "Option B", "Option C"]);
        await userEvent.selectOptions(dropdown, 1);
        expect((dropdown as Gtk.DropDown).getSelected()).toBe(1);
    });

    it("selects row in list box by index", async () => {
        const listBox = await renderTwoItemListBox();
        await userEvent.selectOptions(listBox, 0);
        expect((listBox as Gtk.ListBox).getSelectedRow()).not.toBeNull();
    });

    describe("error handling", () => {
        it("throws when element is not selectable", async () => {
            await expect(actOnPlainButton((button) => userEvent.selectOptions(button, 0))).rejects.toThrow(
                "Cannot select options: expected selectable widget (COMBO_BOX, GRID, or LIST)",
            );
        });

        it("throws when selecting multiple options on dropdown", async () => {
            const dropdown = await renderDropDown(["A", "B"]);

            await expect(userEvent.selectOptions(dropdown, [0, 1])).rejects.toThrow(
                "Cannot select multiple options: a drop-down only supports single selection",
            );
        });
    });
});

describe("userEvent.deselectOptions", () => {
    it("deselects row in list box", async () => {
        const listBox = await renderTwoItemListBox(Gtk.SelectionMode.MULTIPLE);
        await userEvent.selectOptions(listBox, [0, 1]);
        await userEvent.deselectOptions(listBox, 0);
        expect((listBox as Gtk.ListBox).getSelectedRows()).toHaveLength(1);
    });

    describe("error handling", () => {
        it("throws when the widget has no indexed children", async () => {
            const dropdown = await renderDropDown(["A"]);

            await expect(userEvent.deselectOptions(dropdown, 0)).rejects.toThrow(
                "Cannot deselect options: the widget exposes no children to deselect by index",
            );
        });
    });
});

describe("userEvent.rotate", () => {
    it("emits angle-changed on a widget's GestureRotate controller", async () => {
        const { label, handleAngleChanged } = await renderRotateLabel();
        await userEvent.rotate(label, 1.25);
        const [angle, delta] = handleAngleChanged.mock.calls[0] ?? [];
        expect(angle).toBe(1.25);
        expect(delta).toBe(1.25);
    });

    it("supports a separate delta angle", async () => {
        const { label, handleAngleChanged } = await renderRotateLabel();
        await userEvent.rotate(label, 2, 0.5);
        const [angle, delta] = handleAngleChanged.mock.calls[0] ?? [];
        expect(angle).toBe(2);
        expect(delta).toBe(0.5);
    });

    it("throws when the widget has no GestureRotate controller", async () => {
        await render(<GtkLabel name="no-gesture">No gesture</GtkLabel>);
        const label = await screen.findByName("no-gesture");
        await expect(userEvent.rotate(label, 1)).rejects.toThrow(/GestureRotate/);
    });
});

describe("userEvent.zoom", () => {
    it("emits scale-changed on a widget's GestureZoom controller", async () => {
        const handleScaleChanged = vi.fn<(scale: number) => void>();

        const label = await renderGesturedLabel(
            "zoomed",
            "Zoom me",
            <GtkGestureZoom onScaleChanged={handleScaleChanged} />,
        );

        await userEvent.zoom(label, 1.5);
        const [scale] = handleScaleChanged.mock.calls[0] ?? [];
        expect(scale).toBe(1.5);
    });
});

describe("userEvent.swipe", () => {
    it("emits swipe with the given velocity vector", async () => {
        const handleSwipe = vi.fn<(vx: number, vy: number) => void>();
        const label = await renderGesturedLabel("swiped", "Swipe me", <GtkGestureSwipe onSwipe={handleSwipe} />);
        await userEvent.swipe(label, 200, -100);
        const [vx, vy] = handleSwipe.mock.calls[0] ?? [];
        expect(vx).toBe(200);
        expect(vy).toBe(-100);
    });
});

describe("userEvent.longPress", () => {
    it("emits pressed at the given coordinates", async () => {
        const { label, handlePressed } = await renderLongPressLabel();
        await userEvent.longPress(label, 50, 75);
        const [x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(50);
        expect(y).toBe(75);
    });

    it("defaults to (0, 0) when no coordinates are given", async () => {
        const { label, handlePressed } = await renderLongPressLabel();
        await userEvent.longPress(label);
        const [x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(0);
        expect(y).toBe(0);
    });
});

describe("userEvent.drag", () => {
    it("emits drag-begin, one drag-update per step and drag-end in sequence", async () => {
        const events: string[] = [];
        const label = await renderGesturedLabel("dragged", "Drag me", <GtkGestureDrag {...record(events)} />);
        await userEvent.drag(label, 30, -15);
        expect(events).toEqual(["begin", "update", "update", "end"]);
    });

    it("emits a single drag-update when steps is 1", async () => {
        const { label, updates } = await renderDragUpdateCapture();
        await userEvent.drag(label, 30, -15, { steps: 1 });
        expect(updates).toEqual([[30, -15]]);
    });

    it("interpolates drag-update offsets across steps", async () => {
        const { label, updates } = await renderDragUpdateCapture();
        await userEvent.drag(label, 40, -20, { steps: 4 });

        expect(updates).toEqual([
            [10, -5],
            [20, -10],
            [30, -15],
            [40, -20],
        ]);
    });

    it("emits explicit intermediate offsets before the final one", async () => {
        const { label, updates } = await renderDragUpdateCapture();

        await userEvent.drag(label, 40, -20, {
            offsets: [
                { x: 5, y: 0 },
                { x: 25, y: -10 },
            ],
        });

        expect(updates).toEqual([
            [5, 0],
            [25, -10],
            [40, -20],
        ]);
    });

    it("reports a realistic start point so handlers can call getStartPoint()", async () => {
        const { label, values } = await renderDragSelfCapture((self) => self.getStartPoint());
        await userEvent.drag(label, 30, -15, { startX: 50, startY: 25 });
        expect(values[0]).toEqual([true, 50, 25]);
    });

    it("reports a realistic offset so handlers can call getOffset()", async () => {
        const { label, values } = await renderDragSelfCapture((self) => self.getOffset());
        await userEvent.drag(label, 40, -20);

        expect(values).toEqual([
            [true, 20, -10],
            [true, 40, -20],
        ]);
    });
});

describe("controller fan-out", () => {
    it("delivers a click to every GestureClick controller alongside the button's own", async () => {
        const { button, handleClick, handlePressed, handleReleased } = await renderFanOutButton();
        await userEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handlePressed).toHaveBeenCalledTimes(1);
        expect(handleReleased).toHaveBeenCalledTimes(1);
    });

    it("emits pressed at the center of the widget's allocation", async () => {
        const handlePressed = vi.fn<(nPress: number, x: number, y: number) => void>();
        await render(<GtkButton label="Centered" controllers={<GtkGestureClick onPressed={handlePressed} />} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Centered" });
        await userEvent.click(button);
        const [, x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(button.getWidth() / 2);
        expect(y).toBe(button.getHeight() / 2);
        expect(x).toBeGreaterThan(0);
        expect(y).toBeGreaterThan(0);
    });

    it("delivers hover enter and leave to every motion controller", async () => {
        const { label, firstEnter, secondEnter, firstLeave, secondLeave } = await renderDoubleMotionLabel();
        await userEvent.hover(label);
        await userEvent.unhover(label);
        expect(firstEnter).toHaveBeenCalledTimes(1);
        expect(secondEnter).toHaveBeenCalledTimes(1);
        expect(firstLeave).toHaveBeenCalledTimes(1);
        expect(secondLeave).toHaveBeenCalledTimes(1);
    });

    it("delivers a drag sequence to every drag gesture controller", async () => {
        const { label, firstEvents, secondEvents } = await renderDoubleDragLabel();
        await userEvent.drag(label, 30, -15);
        expect(firstEvents).toEqual(["begin", "update", "update", "end"]);
        expect(secondEvents).toEqual(["begin", "update", "update", "end"]);
    });

    it("delivers key events to every key controller", async () => {
        const { entry, firstPressed, secondPressed } = await renderDoubleKeyEntry();
        await userEvent.keyboard(entry, "{Enter}");
        expect(firstPressed).toHaveBeenCalledTimes(1);
        expect(secondPressed).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent.drop", () => {
    it("emits drop on the widget's DropTarget with a string payload", async () => {
        const handleDrop = vi.fn<(value: GObject.Value, x: number, y: number) => boolean>().mockReturnValue(true);
        const target = await renderDropZone("drop-zone", "Drop here", GObject.TYPE_STRING, handleDrop);
        await userEvent.drop(target, "payload", { x: 10, y: 20 });
        expect(handleDrop).toHaveBeenCalledTimes(1);
        const [value, x, y] = handleDrop.mock.calls[0] ?? [];
        expect(value?.getString()).toBe("payload");
        expect(x).toBe(10);
        expect(y).toBe(20);
    });

    it("auto-marshals numeric payloads", async () => {
        const handleDrop = vi.fn<(value: GObject.Value, x: number, y: number) => boolean>().mockReturnValue(true);
        const target = await renderDropZone("number-zone", "Drop a number", GObject.TYPE_DOUBLE, handleDrop);
        await userEvent.drop(target, 42);
        const [value] = handleDrop.mock.calls[0] ?? [];
        expect(value?.getDouble()).toBe(42);
    });

    it("auto-marshals boolean payloads", async () => {
        const handleDrop = vi.fn<(value: GObject.Value, x: number, y: number) => boolean>().mockReturnValue(true);
        const target = await renderDropZone("bool-zone", "Drop a flag", GObject.TYPE_BOOLEAN, handleDrop);
        await userEvent.drop(target, true);
        const [value] = handleDrop.mock.calls[0] ?? [];
        expect(value?.getBoolean()).toBe(true);
    });
});

describe("userEvent.drop — value passthrough and errors", () => {
    it("forwards a pre-built GObject.Value unchanged", async () => {
        const handleDrop = vi.fn<(value: GObject.Value, x: number, y: number) => boolean>().mockReturnValue(true);
        const target = await renderDropZone("value-zone", "Drop a value", GObject.TYPE_STRING, handleDrop);
        const value = new GObject.Value();
        value.init(GObject.TYPE_STRING);
        value.setString("preserved");
        await userEvent.drop(target, value);
        const [received] = handleDrop.mock.calls[0] ?? [];
        expect(received?.getString()).toBe("preserved");
    });

    it("throws when the widget has no DropTarget controller", async () => {
        await render(<GtkLabel name="no-target">Nothing here</GtkLabel>);
        const label = await screen.findByName("no-target");
        await expect(userEvent.drop(label, "x")).rejects.toThrow(/DropTarget/);
    });
});

describe("userEvent.dragAndDrop", () => {
    it("fires drop on the target after verifying the source's DragSource", async () => {
        const handleDrop = vi.fn<(value: GObject.Value, x: number, y: number) => boolean>().mockReturnValue(true);
        const { source, target } = await renderDragAndDropPair({ onDrop: handleDrop });
        await userEvent.dragAndDrop(source, target, "payload");
        const [value] = handleDrop.mock.calls[0] ?? [];
        expect(value?.getString()).toBe("payload");
    });

    it("throws when the source has no DragSource controller", async () => {
        const { source, target } = await renderDragAndDropPair({ onDrop: () => true, hasDragSource: false });
        await expect(userEvent.dragAndDrop(source, target, "payload")).rejects.toThrow(/DragSource/);
    });
});

describe("userEvent.keyboard — shortcut dispatch", () => {
    it("activates a KeyvalTrigger shortcut when the matching key is pressed", async () => {
        const onActivate = vi.fn(() => true);
        const host = await renderShortcutHost(Gtk.ShortcutTrigger.parseString("F5"), onActivate);
        await userEvent.keyboard(host, "{F5}");
        expect(onActivate).toHaveBeenCalled();
    });

    it("activates an AlternativeTrigger shortcut from either side", async () => {
        const onActivate = vi.fn(() => true);

        const host = await renderShortcutHost(
            Gtk.AlternativeTrigger.new(Gtk.ShortcutTrigger.parseString("F6"), Gtk.ShortcutTrigger.parseString("F7")),
            onActivate,
        );

        await userEvent.keyboard(host, "{F6}");
        await userEvent.keyboard(host, "{F7}");
        expect(onActivate).toHaveBeenCalledTimes(2);
    });

    it("does not activate any shortcut when the key does not match", async () => {
        const onActivate = vi.fn(() => true);
        const host = await renderShortcutHost(Gtk.ShortcutTrigger.parseString("F8"), onActivate);
        await userEvent.keyboard(host, "{F9}");
        expect(onActivate).not.toHaveBeenCalled();
    });
});
