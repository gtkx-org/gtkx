import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDragSource,
    GtkDropDown,
    GtkDropTarget,
    GtkEntry,
    GtkGestureDrag,
    GtkGestureLongPress,
    GtkGestureRotate,
    GtkGestureSwipe,
    GtkGestureZoom,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkShortcutController,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "../src/index.js";
import { isEditable } from "../src/widget.js";

const widgetHasFocus = (w: Gtk.Widget): boolean => (w as unknown as { hasFocus: boolean }).hasFocus;

describe("userEvent.click", () => {
    it("emits clicked signal on button", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click me" });
        await userEvent.click(button);

        await waitFor(() => expect(handleClick).toHaveBeenCalledTimes(1));
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

        const active = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { checked: true });
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
        await render(<GtkEntry />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Hello World");

        if (!isEditable(entry)) {
            throw new Error("Element is not editable");
        }

        expect(entry.getText()).toBe("Hello World");
    });

    it("appends text to existing content", async () => {
        await render(<GtkEntry text="Initial " />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "appended");

        if (!isEditable(entry)) {
            throw new Error("Element is not editable");
        }

        expect(entry.getText()).toBe("Initial appended");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await render(<GtkButton label="Test" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
            await expect(userEvent.type(button, "text")).rejects.toThrow(
                "Cannot type into element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
            );
        });
    });
});

describe("userEvent.clear", () => {
    it("clears text from entry", async () => {
        await render(<GtkEntry text="Some text" />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.clear(entry);

        if (!isEditable(entry)) {
            throw new Error("Element is not editable");
        }
        expect(entry.getText()).toBe("");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await render(<GtkButton label="Test" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
            await expect(userEvent.clear(button)).rejects.toThrow(
                "Cannot clear element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
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
        expect(widgetHasFocus(second)).toBe(true);
    });

    it("moves focus backward with shift option", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const second = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        second.grabFocus();
        await userEvent.tab(second, { shift: true });

        const first = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        expect(widgetHasFocus(first)).toBe(true);
    });
});

describe("userEvent.selectOptions", () => {
    it("selects option in dropdown by index", async () => {
        await render(
            <GtkDropDown
                items={[
                    { id: "a", value: "Option A" },
                    { id: "b", value: "Option B" },
                    { id: "c", value: "Option C" },
                ]}
            />,
        );

        const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
        await userEvent.selectOptions(dropdown, 1);
        expect((dropdown as Gtk.DropDown).getSelected()).toBe(1);
    });

    it("selects row in list box by index", async () => {
        await render(
            <GtkListBox>
                <GtkListBoxRow>Item 1</GtkListBoxRow>
                <GtkListBoxRow>Item 2</GtkListBoxRow>
            </GtkListBox>,
        );

        const listBox = await screen.findByRole(Gtk.AccessibleRole.LIST);
        await userEvent.selectOptions(listBox, 0);
        expect((listBox as Gtk.ListBox).getSelectedRow()).not.toBeNull();
    });

    describe("error handling", () => {
        it("throws when element is not selectable", async () => {
            await render(<GtkButton label="Test" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
            await expect(userEvent.selectOptions(button, 0)).rejects.toThrow(
                "Cannot select options: expected selectable widget (COMBO_BOX or LIST)",
            );
        });

        it("throws when selecting multiple options on dropdown", async () => {
            await render(
                <GtkDropDown
                    items={[
                        { id: "a", value: "A" },
                        { id: "b", value: "B" },
                    ]}
                />,
            );

            const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
            await expect(userEvent.selectOptions(dropdown, [0, 1])).rejects.toThrow(
                "Cannot select multiple options: ComboBox only supports single selection",
            );
        });
    });
});

describe("userEvent.deselectOptions", () => {
    it("deselects row in list box", async () => {
        await render(
            <GtkListBox selectionMode={Gtk.SelectionMode.MULTIPLE}>
                <GtkListBoxRow>Item 1</GtkListBoxRow>
                <GtkListBoxRow>Item 2</GtkListBoxRow>
            </GtkListBox>,
        );

        const listBox = await screen.findByRole(Gtk.AccessibleRole.LIST);
        await userEvent.selectOptions(listBox, [0, 1]);
        await userEvent.deselectOptions(listBox, 0);
        expect((listBox as Gtk.ListBox).getSelectedRows()).toHaveLength(1);
    });

    describe("error handling", () => {
        it("throws when element is not a list box", async () => {
            await render(<GtkDropDown items={[{ id: "a", value: "A" }]} />);

            const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
            await expect(userEvent.deselectOptions(dropdown, 0)).rejects.toThrow(
                "Cannot deselect options: only ListBox supports deselection",
            );
        });
    });
});

describe("userEvent.rotate", () => {
    it("emits angle-changed on a widget's GestureRotate controller", async () => {
        const handleAngleChanged = vi.fn();
        await render(
            <GtkLabel name="rotated" label="Rotate me">
                <GtkGestureRotate onAngleChanged={handleAngleChanged} />
            </GtkLabel>,
        );

        const label = await screen.findByName("rotated");
        await userEvent.rotate(label, 1.25);

        const [angle, delta] = handleAngleChanged.mock.calls[0] ?? [];
        expect(angle).toBe(1.25);
        expect(delta).toBe(1.25);
    });

    it("supports a separate delta angle", async () => {
        const handleAngleChanged = vi.fn();
        await render(
            <GtkLabel name="rotated" label="Rotate me">
                <GtkGestureRotate onAngleChanged={handleAngleChanged} />
            </GtkLabel>,
        );

        const label = await screen.findByName("rotated");
        await userEvent.rotate(label, 2.0, 0.5);

        const [angle, delta] = handleAngleChanged.mock.calls[0] ?? [];
        expect(angle).toBe(2.0);
        expect(delta).toBe(0.5);
    });

    it("throws when the widget has no GestureRotate controller", async () => {
        await render(<GtkLabel name="no-gesture" label="No gesture" />);

        const label = await screen.findByName("no-gesture");
        await expect(userEvent.rotate(label, 1)).rejects.toThrow(/GestureRotate/);
    });
});

describe("userEvent.zoom", () => {
    it("emits scale-changed on a widget's GestureZoom controller", async () => {
        const handleScaleChanged = vi.fn();
        await render(
            <GtkLabel name="zoomed" label="Zoom me">
                <GtkGestureZoom onScaleChanged={handleScaleChanged} />
            </GtkLabel>,
        );

        const label = await screen.findByName("zoomed");
        await userEvent.zoom(label, 1.5);

        const [scale] = handleScaleChanged.mock.calls[0] ?? [];
        expect(scale).toBe(1.5);
    });
});

describe("userEvent.swipe", () => {
    it("emits swipe with the given velocity vector", async () => {
        const handleSwipe = vi.fn();
        await render(
            <GtkLabel name="swiped" label="Swipe me">
                <GtkGestureSwipe onSwipe={handleSwipe} />
            </GtkLabel>,
        );

        const label = await screen.findByName("swiped");
        await userEvent.swipe(label, 200, -100);

        const [vx, vy] = handleSwipe.mock.calls[0] ?? [];
        expect(vx).toBe(200);
        expect(vy).toBe(-100);
    });
});

describe("userEvent.longPress", () => {
    it("emits pressed at the given coordinates", async () => {
        const handlePressed = vi.fn();
        await render(
            <GtkLabel name="long-pressed" label="Long press me">
                <GtkGestureLongPress onPressed={handlePressed} />
            </GtkLabel>,
        );

        const label = await screen.findByName("long-pressed");
        await userEvent.longPress(label, 50, 75);

        const [x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(50);
        expect(y).toBe(75);
    });

    it("defaults to (0, 0) when no coordinates are given", async () => {
        const handlePressed = vi.fn();
        await render(
            <GtkLabel name="long-pressed" label="Long press me">
                <GtkGestureLongPress onPressed={handlePressed} />
            </GtkLabel>,
        );

        const label = await screen.findByName("long-pressed");
        await userEvent.longPress(label);

        const [x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(0);
        expect(y).toBe(0);
    });
});

describe("userEvent.drag", () => {
    it("emits drag-begin, drag-update and drag-end in sequence", async () => {
        const events: string[] = [];
        await render(
            <GtkLabel name="dragged" label="Drag me">
                <GtkGestureDrag
                    onDragBegin={() => {
                        events.push("begin");
                    }}
                    onDragUpdate={() => {
                        events.push("update");
                    }}
                    onDragEnd={() => {
                        events.push("end");
                    }}
                />
            </GtkLabel>,
        );

        const label = await screen.findByName("dragged");
        await userEvent.drag(label, 30, -15);

        expect(events).toEqual(["begin", "update", "end"]);
    });

    it("reports a realistic start point so handlers can call getStartPoint()", async () => {
        const startPoints: Array<[boolean, number, number]> = [];
        await render(
            <GtkLabel name="dragged" label="Drag me">
                <GtkGestureDrag
                    onDragUpdate={(_offsetX, _offsetY, self) => {
                        startPoints.push(self.getStartPoint() as [boolean, number, number]);
                    }}
                />
            </GtkLabel>,
        );

        const label = await screen.findByName("dragged");
        await userEvent.drag(label, 30, -15, { startX: 50, startY: 25 });

        expect(startPoints[0]).toEqual([true, 50, 25]);
    });

    it("reports a realistic offset so handlers can call getOffset()", async () => {
        const offsets: Array<[boolean, number, number]> = [];
        await render(
            <GtkLabel name="dragged" label="Drag me">
                <GtkGestureDrag
                    onDragUpdate={(_offsetX, _offsetY, self) => {
                        offsets.push(self.getOffset() as [boolean, number, number]);
                    }}
                />
            </GtkLabel>,
        );

        const label = await screen.findByName("dragged");
        await userEvent.drag(label, 40, -20);

        expect(offsets[0]).toEqual([true, 40, -20]);
    });
});

describe("userEvent.drop", () => {
    it("emits drop on the widget's DropTarget with a string payload", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);
        await render(
            <GtkLabel name="drop-zone" label="Drop here">
                <GtkDropTarget types={[GObject.Type.STRING]} actions={Gdk.DragAction.COPY} onDrop={handleDrop} />
            </GtkLabel>,
        );

        const target = await screen.findByName("drop-zone");
        await userEvent.drop(target, "payload", { x: 10, y: 20 });

        expect(handleDrop).toHaveBeenCalledTimes(1);
        const [value, x, y] = handleDrop.mock.calls[0] ?? [];
        expect((value as GObject.Value).getString()).toBe("payload");
        expect(x).toBe(10);
        expect(y).toBe(20);
    });

    it("auto-marshals numeric payloads", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);
        await render(
            <GtkLabel name="number-zone" label="Drop a number">
                <GtkDropTarget types={[GObject.Type.DOUBLE]} actions={Gdk.DragAction.COPY} onDrop={handleDrop} />
            </GtkLabel>,
        );

        const target = await screen.findByName("number-zone");
        await userEvent.drop(target, 42);

        const [value] = handleDrop.mock.calls[0] ?? [];
        expect((value as GObject.Value).getDouble()).toBe(42);
    });

    it("auto-marshals boolean payloads", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);
        await render(
            <GtkLabel name="bool-zone" label="Drop a flag">
                <GtkDropTarget types={[GObject.Type.BOOLEAN]} actions={Gdk.DragAction.COPY} onDrop={handleDrop} />
            </GtkLabel>,
        );

        const target = await screen.findByName("bool-zone");
        await userEvent.drop(target, true);

        const [value] = handleDrop.mock.calls[0] ?? [];
        expect((value as GObject.Value).getBoolean()).toBe(true);
    });
});

describe("userEvent.drop — value passthrough and errors", () => {
    it("forwards a pre-built GObject.Value unchanged", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);
        await render(
            <GtkLabel name="value-zone" label="Drop a value">
                <GtkDropTarget types={[GObject.Type.STRING]} actions={Gdk.DragAction.COPY} onDrop={handleDrop} />
            </GtkLabel>,
        );

        const target = await screen.findByName("value-zone");
        const value = new GObject.Value();
        value.init(GObject.Type.STRING);
        value.setString("preserved");
        await userEvent.drop(target, value);

        const [received] = handleDrop.mock.calls[0] ?? [];
        expect((received as GObject.Value).getString()).toBe("preserved");
    });

    it("throws when the widget has no DropTarget controller", async () => {
        await render(<GtkLabel name="no-target" label="Nothing here" />);

        const label = await screen.findByName("no-target");
        await expect(userEvent.drop(label, "x")).rejects.toThrow(/DropTarget/);
    });
});

describe("userEvent.dragAndDrop", () => {
    it("fires drop on the target after verifying the source's DragSource", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);
        await render(
            <GtkBox>
                <GtkLabel name="drag-source" label="Drag me">
                    <GtkDragSource actions={Gdk.DragAction.COPY} />
                </GtkLabel>
                <GtkLabel name="drop-target" label="Drop here">
                    <GtkDropTarget types={[GObject.Type.STRING]} actions={Gdk.DragAction.COPY} onDrop={handleDrop} />
                </GtkLabel>
            </GtkBox>,
        );

        const source = await screen.findByName("drag-source");
        const target = await screen.findByName("drop-target");
        await userEvent.dragAndDrop(source, target, "payload");

        const [value] = handleDrop.mock.calls[0] ?? [];
        expect((value as GObject.Value).getString()).toBe("payload");
    });

    it("throws when the source has no DragSource controller", async () => {
        await render(
            <GtkBox>
                <GtkLabel name="not-a-source" label="No source" />
                <GtkLabel name="drop-target" label="Drop here">
                    <GtkDropTarget types={[GObject.Type.STRING]} actions={Gdk.DragAction.COPY} onDrop={() => true} />
                </GtkLabel>
            </GtkBox>,
        );

        const source = await screen.findByName("not-a-source");
        const target = await screen.findByName("drop-target");
        await expect(userEvent.dragAndDrop(source, target, "payload")).rejects.toThrow(/DragSource/);
    });
});

describe("userEvent.keyboard — shortcut dispatch", () => {
    it("activates a KeyvalTrigger shortcut when the matching key is pressed", async () => {
        const onActivate = vi.fn(() => true);
        await render(
            <GtkBox name="host">
                <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                    <GtkShortcutController.Shortcut trigger="F5" onActivate={onActivate} />
                </GtkShortcutController>
                <GtkLabel label="anchor" />
            </GtkBox>,
        );
        const host = (await screen.findByName("host")) as Gtk.Widget;
        await userEvent.keyboard(host, "{F5}");
        expect(onActivate).toHaveBeenCalled();
    });

    it("activates an AlternativeTrigger shortcut from either side", async () => {
        const onActivate = vi.fn(() => true);
        await render(
            <GtkBox name="host">
                <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                    <GtkShortcutController.Shortcut trigger={["F6", "F7"]} onActivate={onActivate} />
                </GtkShortcutController>
                <GtkLabel label="anchor" />
            </GtkBox>,
        );
        const host = (await screen.findByName("host")) as Gtk.Widget;
        await userEvent.keyboard(host, "{F6}");
        await userEvent.keyboard(host, "{F7}");
        expect(onActivate).toHaveBeenCalledTimes(2);
    });

    it("does not activate any shortcut when the key does not match", async () => {
        const onActivate = vi.fn(() => true);
        await render(
            <GtkBox name="host">
                <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                    <GtkShortcutController.Shortcut trigger="F8" onActivate={onActivate} />
                </GtkShortcutController>
                <GtkLabel label="anchor" />
            </GtkBox>,
        );
        const host = (await screen.findByName("host")) as Gtk.Widget;
        await userEvent.keyboard(host, "{F9}");
        expect(onActivate).not.toHaveBeenCalled();
    });
});
