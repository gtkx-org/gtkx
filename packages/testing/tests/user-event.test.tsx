import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
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
    GtkShortcut,
    GtkShortcutController,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { isEditable } from "../src/editable.js";
import { render, screen, userEvent, waitFor } from "../src/index.js";
import { renderClickButton } from "./event-render-setup.js";

const widgetHasFocus = (w: Gtk.Widget): boolean => w.hasFocus();

const expectEditableText = (entry: Gtk.Widget, expected: string): void => {
    if (!isEditable(entry)) {
        throw new Error("Element is not editable");
    }
    expect(entry.getText()).toBe(expected);
};

const renderGesturedLabel = async (name: string, label: string, gesture: ReactNode): Promise<Gtk.Widget> => {
    await render(
        <GtkLabel name={name} label={label}>
            {gesture}
        </GtkLabel>,
    );
    return screen.findByName(name);
};

const expectActionRejectsOnButton = async (
    action: (button: Gtk.Widget) => Promise<unknown>,
    message: string,
): Promise<void> => {
    await render(<GtkButton label="Test" />);

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
    await expect(action(button)).rejects.toThrow(message);
};

describe("userEvent.click", () => {
    it("emits clicked signal on button", async () => {
        const { handleClick, button } = await renderClickButton();
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

        expectEditableText(entry, "Hello World");
    });

    it("appends text to existing content", async () => {
        await render(<GtkEntry text="Initial " />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "appended");

        expectEditableText(entry, "Initial appended");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await expectActionRejectsOnButton(
                (button) => userEvent.type(button, "text"),
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

        expectEditableText(entry, "");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await expectActionRejectsOnButton(
                (button) => userEvent.clear(button),
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
            await expectActionRejectsOnButton(
                (button) => userEvent.selectOptions(button, 0),
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
        const label = await renderGesturedLabel(
            "rotated",
            "Rotate me",
            <GtkGestureRotate onAngleChanged={handleAngleChanged} />,
        );
        await userEvent.rotate(label, 1.25);

        const [angle, delta] = handleAngleChanged.mock.calls[0] ?? [];
        expect(angle).toBe(1.25);
        expect(delta).toBe(1.25);
    });

    it("supports a separate delta angle", async () => {
        const handleAngleChanged = vi.fn();
        const label = await renderGesturedLabel(
            "rotated",
            "Rotate me",
            <GtkGestureRotate onAngleChanged={handleAngleChanged} />,
        );
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
        const handleSwipe = vi.fn();
        const label = await renderGesturedLabel("swiped", "Swipe me", <GtkGestureSwipe onSwipe={handleSwipe} />);
        await userEvent.swipe(label, 200, -100);

        const [vx, vy] = handleSwipe.mock.calls[0] ?? [];
        expect(vx).toBe(200);
        expect(vy).toBe(-100);
    });
});

describe("userEvent.longPress", () => {
    it("emits pressed at the given coordinates", async () => {
        const handlePressed = vi.fn();
        const label = await renderGesturedLabel(
            "long-pressed",
            "Long press me",
            <GtkGestureLongPress onPressed={handlePressed} />,
        );
        await userEvent.longPress(label, 50, 75);

        const [x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(50);
        expect(y).toBe(75);
    });

    it("defaults to (0, 0) when no coordinates are given", async () => {
        const handlePressed = vi.fn();
        const label = await renderGesturedLabel(
            "long-pressed",
            "Long press me",
            <GtkGestureLongPress onPressed={handlePressed} />,
        );
        await userEvent.longPress(label);

        const [x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(0);
        expect(y).toBe(0);
    });
});

describe("userEvent.drag", () => {
    it("emits drag-begin, drag-update and drag-end in sequence", async () => {
        const events: string[] = [];
        const label = await renderGesturedLabel(
            "dragged",
            "Drag me",
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
            />,
        );
        await userEvent.drag(label, 30, -15);

        expect(events).toEqual(["begin", "update", "end"]);
    });

    it("reports a realistic start point so handlers can call getStartPoint()", async () => {
        const startPoints: [boolean, number, number][] = [];
        const label = await renderGesturedLabel(
            "dragged",
            "Drag me",
            <GtkGestureDrag
                onDragUpdate={(_offsetX, _offsetY, self) => {
                    startPoints.push(self.getStartPoint() as [boolean, number, number]);
                }}
            />,
        );
        await userEvent.drag(label, 30, -15, { startX: 50, startY: 25 });

        expect(startPoints[0]).toEqual([true, 50, 25]);
    });

    it("reports a realistic offset so handlers can call getOffset()", async () => {
        const offsets: [boolean, number, number][] = [];
        const label = await renderGesturedLabel(
            "dragged",
            "Drag me",
            <GtkGestureDrag
                onDragUpdate={(_offsetX, _offsetY, self) => {
                    offsets.push(self.getOffset() as [boolean, number, number]);
                }}
            />,
        );
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
                    <GtkShortcut
                        trigger={Gtk.ShortcutTrigger.parseString("F5")}
                        action={Gtk.CallbackAction.new(onActivate)}
                    />
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
                    <GtkShortcut
                        trigger={Gtk.AlternativeTrigger.new(
                            Gtk.ShortcutTrigger.parseString("F6"),
                            Gtk.ShortcutTrigger.parseString("F7"),
                        )}
                        action={Gtk.CallbackAction.new(onActivate)}
                    />
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
                    <GtkShortcut
                        trigger={Gtk.ShortcutTrigger.parseString("F8")}
                        action={Gtk.CallbackAction.new(onActivate)}
                    />
                </GtkShortcutController>
                <GtkLabel label="anchor" />
            </GtkBox>,
        );
        const host = (await screen.findByName("host")) as Gtk.Widget;
        await userEvent.keyboard(host, "{F9}");
        expect(onActivate).not.toHaveBeenCalled();
    });
});
