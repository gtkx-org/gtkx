import type { ComponentProps, ReactNode } from "react";
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
    GtkTextBuffer,
    GtkTextTag,
    GtkTextView,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { type BoundQueries, queryAllControllers, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, type Mock, vi } from "vitest";
import {
    renderClickButton,
    renderDragAndDropPair,
    renderGesturedLabel,
    renderShortcutHost,
    type ShortcutHostOptions,
} from "./event-render-setup.js";
import { bufferText } from "./text-buffer-helpers.js";

type KeyProbeOptions = {
    ancestorPhase?: Gtk.PropagationPhase;
    ancestorResult?: boolean;
    fieldPhase?: Gtk.PropagationPhase;
};

type KeyProbe = {
    handleAncestorPressed: Mock<() => boolean>;
    handleFieldPressed: Mock<() => boolean>;
};

type DropHandler = Mock<(value: GObject.Value, x: number, y: number) => boolean>;

const stoppingKeyController = <GtkEventControllerKey onKeyPressed={() => Gdk.EVENT_STOP} />;

const editableText = (entry: Gtk.Widget): string => {
    if (!(entry instanceof Gtk.Editable)) {
        throw new TypeError("Element is not editable");
    }

    return entry.getText();
};

const renderScoped = async (element: ReactNode): Promise<BoundQueries> => {
    const { container } = await render(element);

    return within(container);
};

const renderColumn = (children: ReactNode): Promise<BoundQueries> =>
    renderScoped(<GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>);

const renderTextBox = async (text?: string): Promise<Gtk.Entry> => {
    const { findByRole } = await renderScoped(<GtkEntry text={text} />);

    return findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
};

const renderTextView = async (): Promise<Gtk.TextView> => {
    const { findByRole } = await renderScoped(<GtkTextView />);

    return findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

const typeOverTextViewSelection = async (text: string, length: number): Promise<Gtk.TextView> => {
    const view = await renderTextView();
    await userEvent.type(view, text);
    const buffer = view.getBuffer();
    buffer.selectRange(buffer.getIterAtOffset(0), buffer.getIterAtOffset(length));
    await userEvent.type(view, "Z");

    return view;
};

const renderUnfocusedEntry = async (name: string, text: string): Promise<Gtk.Entry> => {
    const { findByName } = await renderColumn(
        <>
            <GtkButton label="Focused first" />
            <GtkEntry text={text} name={name} />
        </>,
    );

    return findByName(name, { as: Gtk.Entry });
};

const renderDropDown = async (options: string[]): Promise<Gtk.Widget> => {
    const { findByRole } = await renderScoped(<GtkDropDown model={Gtk.StringList.new(options)} />);

    return findByRole(Gtk.AccessibleRole.COMBO_BOX);
};

const actOnPlainButton = async (action: (button: Gtk.Widget) => Promise<unknown>): Promise<unknown> => {
    const { findByRole } = await renderScoped(<GtkButton label="Test" />);

    return action(await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" }));
};

const renderTwoItemListBox = async (selectionMode?: Gtk.SelectionMode): Promise<Gtk.Widget> => {
    const { findByRole } = await renderScoped(
        <GtkListBox selectionMode={selectionMode}>
            <GtkListBoxRow>
                <GtkLabel>Item 1</GtkLabel>
            </GtkListBoxRow>
            <GtkListBoxRow>
                <GtkLabel>Item 2</GtkLabel>
            </GtkListBoxRow>
        </GtkListBox>,
    );

    return findByRole(Gtk.AccessibleRole.LIST);
};

const renderKeyControllerTree = async (
    ancestorController: ReactNode,
    fieldController?: ReactNode,
): Promise<Gtk.Widget> => {
    const { findByName } = await renderScoped(
        <GtkBox name="ancestor" controllers={ancestorController}>
            <GtkEntry name="field" controllers={fieldController} />
        </GtkBox>,
    );

    return findByName("field");
};

const recordPress = (order: string[], label: string) => (): boolean => {
    order.push(label);

    return Gdk.EVENT_PROPAGATE;
};

const recordingKeyController = (order: string[], label: string, phase?: Gtk.PropagationPhase): ReactNode => (
    <GtkEventControllerKey propagationPhase={phase} onKeyPressed={recordPress(order, label)} />
);

const attachRecordingKeyController = (
    widget: Gtk.Widget,
    order: string[],
    label: string,
    phase?: Gtk.PropagationPhase,
): void => {
    const controller = new Gtk.EventControllerKey();

    if (phase !== undefined) {
        controller.setPropagationPhase(phase);
    }

    controller.on("key-pressed", recordPress(order, label));
    widget.addController(controller);
};

const getDelegate = (widget: Gtk.Widget): Gtk.Widget => {
    const delegate = widget instanceof Gtk.Editable ? widget.getDelegate() : null;

    if (delegate === null) {
        throw new TypeError("Widget has no editable delegate");
    }

    return delegate;
};

const keyPressOrder = async (ancestorPhase?: Gtk.PropagationPhase): Promise<string[]> => {
    const order: string[] = [];

    const field = await renderKeyControllerTree(
        recordingKeyController(order, "ancestor", ancestorPhase),
        recordingKeyController(order, "target"),
    );

    await userEvent.keyboard(field, "{Escape}");

    return order;
};

const delegateKeyPressOrder = async (phase?: Gtk.PropagationPhase): Promise<string[]> => {
    const order: string[] = [];

    const field = await renderKeyControllerTree(
        recordingKeyController(order, "ancestor", phase),
        recordingKeyController(order, "field", phase),
    );

    attachRecordingKeyController(getDelegate(field), order, "delegate", phase);
    await userEvent.keyboard(field, "{Escape}");

    return order;
};

const pressShortcutFromField = async (options: Omit<ShortcutHostOptions, "trigger">): Promise<Mock<() => boolean>> => {
    const { findByName, onActivate } = await renderShortcutHost({
        trigger: Gtk.ShortcutTrigger.parseString("F5"),
        ...options,
    });

    await userEvent.keyboard(await findByName("field"), "{F5}");

    return onActivate;
};

const pressShortcutOverStoppingField = (phase: Gtk.PropagationPhase): Promise<Mock<() => boolean>> =>
    pressShortcutFromField({ phase, children: <GtkEntry name="field" controllers={stoppingKeyController} /> });

const pressKeyOnProbe = async (input: string, options: KeyProbeOptions = {}): Promise<KeyProbe> => {
    const handleAncestorPressed = vi.fn(() => options.ancestorResult ?? Gdk.EVENT_PROPAGATE);
    const handleFieldPressed = vi.fn(() => Gdk.EVENT_PROPAGATE);

    const field = await renderKeyControllerTree(
        <GtkEventControllerKey propagationPhase={options.ancestorPhase} onKeyPressed={handleAncestorPressed} />,
        <GtkEventControllerKey propagationPhase={options.fieldPhase} onKeyPressed={handleFieldPressed} />,
    );

    await userEvent.keyboard(field, input);

    return { handleAncestorPressed, handleFieldPressed };
};

const renderSelectedEntryPair = async (text: string): Promise<{ source: Gtk.Editable; dest: Gtk.Widget }> => {
    const { findByName } = await renderColumn(
        <>
            <GtkEntry text={text} name="source" />
            <GtkEntry name="dest" />
        </>,
    );

    const source = await findByName("source", { as: Gtk.Entry });
    const dest = await findByName("dest");
    source.selectRegion(0, -1);

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
    gtype: GObject.Type,
    onDrop: ComponentProps<typeof GtkDropTarget>["onDrop"],
): Promise<Gtk.Widget> => {
    const { findByName } = await renderScoped(
        <GtkLabel
            name={name}
            controllers={<GtkDropTarget types={[gtype]} actions={Gdk.DragAction.COPY} onDrop={onDrop} />}
        >
            Drop here
        </GtkLabel>,
    );

    return findByName(name);
};

const dropHandler = (): DropHandler =>
    vi.fn<(value: GObject.Value, x: number, y: number) => boolean>().mockReturnValue(true);

const renderDragUpdateCapture = async () => {
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
};

const renderDragSelfCapture = async <T,>(read: (self: Gtk.GestureDrag) => T) => {
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
};

describe("userEvent.click", () => {
    it("emits clicked and toggles the state of checkboxes, switches and toggle buttons", async () => {
        const { handleClick, button } = await renderClickButton();
        await userEvent.click(button);

        await waitFor(() => {
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        const { findByRole } = await renderScoped(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkCheckButton label="Option" />
                <GtkSwitch />
                <GtkToggleButton label="Toggle" />
            </GtkBox>,
        );

        await userEvent.click(await findByRole(Gtk.AccessibleRole.CHECKBOX));
        await userEvent.click(await findByRole(Gtk.AccessibleRole.SWITCH));
        await userEvent.click(await findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON));
        expect(await findByRole(Gtk.AccessibleRole.CHECKBOX)).toBeChecked();
        expect(await findByRole(Gtk.AccessibleRole.SWITCH)).toBeChecked();
        expect(await findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON)).toBePressed();
    });

    it("repeats the emission for a double and a triple click", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Repeat" onClicked={handleClick} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Repeat" });
        await userEvent.dblClick(button);
        expect(handleClick).toHaveBeenCalledTimes(2);
        await userEvent.tripleClick(button);
        expect(handleClick).toHaveBeenCalledTimes(5);
    });
});

describe("userEvent.type (1)", () => {
    it("appends to an entry's text, and honors an initial collapsed or ranged selection", async () => {
        const appended = await renderTextBox("Initial ");
        await userEvent.type(appended, "appended");
        expect(editableText(appended)).toBe("Initial appended");
        const inserted = await renderTextBox("ac");
        await userEvent.type(inserted, "b", { initialSelectionStart: 1 });
        expect(editableText(inserted)).toBe("abc");
        const replaced = await renderTextBox("Hello World");
        await userEvent.type(replaced, "Goodbye", { initialSelectionStart: 0, initialSelectionEnd: 5 });
        expect(editableText(replaced)).toBe("Goodbye World");
    });

    it("focuses the entry it types into unless shouldFocus is off", async () => {
        const focused = await renderUnfocusedEntry("unfocused", "Initial ");
        await userEvent.type(focused, "appended");
        expect(editableText(focused)).toBe("Initial appended");
        expect(focused.getDelegate()?.isFocus()).toBe(true);
        const unfocused = await renderUnfocusedEntry("left-alone", "");
        await userEvent.type(unfocused, "typed", { shouldFocus: false });
        expect(editableText(unfocused)).toBe("typed");
        expect(unfocused.getDelegate()?.isFocus()).toBe(false);
    });

    it("replaces the text a keyboard, a tab or a program selected", async () => {
        const entry = await renderTextBox();
        await userEvent.type(entry, "abcdef");
        await userEvent.keyboard(entry, "{Control>}a{/Control}");
        expect(entry.getSelectionBounds()).toEqual([true, 0, 6]);
        await userEvent.type(entry, "Z");
        expect(editableText(entry)).toBe("Z");
        const programmatic = await renderTextBox("abcdef");
        programmatic.selectRegion(0, 3);
        await userEvent.type(programmatic, "Z");
        expect(editableText(programmatic)).toBe("Zdef");
        const tabbed = await renderUnfocusedEntry("tabbed", "Initial");
        await userEvent.tab(tabbed);
        expect(tabbed.getSelectionBounds()).toEqual([true, 0, "Initial".length]);
        await userEvent.type(tabbed, "typed");
        expect(editableText(tabbed)).toBe("typed");
        expect(bufferText(await typeOverTextViewSelection("abcdef", "abcdef".length))).toBe("Z");
    });
});

describe("userEvent.type (2)", () => {
    it("leaves a non-editable entry's and text view's selected text alone", async () => {
        const entry = await renderTextBox("Locked");
        entry.setEditable(false);
        entry.selectRegion(0, "Locked".length);
        await userEvent.type(entry, "Z");
        expect(editableText(entry)).toBe("Locked");
        const view = await renderTextView();
        await userEvent.type(view, "Locked");
        view.setEditable(false);
        const buffer = view.getBuffer();
        buffer.selectRange(buffer.getIterAtOffset(0), buffer.getIterAtOffset(6));
        await userEvent.type(view, "Z");
        expect(bufferText(view)).toBe("Locked");
    });

    it("undoes a replacement one history entry at a time, in an entry and in a text view", async () => {
        const entry = await renderTextBox();
        await userEvent.type(entry, "hello");
        entry.selectRegion(0, 5);
        await userEvent.type(entry, "Z");
        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(editableText(entry)).toBe("");
        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(editableText(entry)).toBe("hello");
        const multiple = await typeOverTextViewSelection("hello", "hello".length);
        await userEvent.keyboard(multiple, "{Control>}z{/Control}");
        expect(bufferText(multiple)).toBe("");
        await userEvent.keyboard(multiple, "{Control>}z{/Control}");
        expect(bufferText(multiple)).toBe("hello");
        const single = await typeOverTextViewSelection("hello", 1);
        expect(bufferText(single)).toBe("Zello");
        await userEvent.keyboard(single, "{Control>}z{/Control}");
        expect(bufferText(single)).toBe("hello");
    });

    it("throws when the widget is not editable", async () => {
        await expect(actOnPlainButton((button) => userEvent.type(button, "text"))).rejects.toThrow();
    });
});

describe("userEvent.clear (1)", () => {
    it("empties an entry, and does so while a modifier is held without dispatching keys", async () => {
        const plain = await renderTextBox("Some text");
        await userEvent.clear(plain);
        expect(editableText(plain)).toBe("");
        const presses: number[] = [];
        const edits: string[] = [];

        const { findByRole } = await renderScoped(
            <GtkEntry
                text="abc"
                controllers={(
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            presses.push(keyval);

                            return Gdk.EVENT_PROPAGATE;
                        }}
                    />
                )}
            />,
        );

        const entry = await findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });

        entry.connect("delete-text", () => {
            edits.push("delete-text");
        });

        entry.connect("changed", () => {
            edits.push("changed");
        });

        const user = userEvent.setup();
        await user.keyboard(entry, "{Shift>}");
        await user.clear(entry);
        await user.keyboard(entry, "{/Shift}");
        expect(editableText(entry)).toBe("");
        expect(edits).toEqual(["delete-text", "changed"]);
        expect(presses).toEqual([Gdk.KEY_Shift_L]);
    });
});

describe("userEvent.clear (2)", () => {
    it("throws for a widget that is not editable, refuses edits or blocks the deletion", async () => {
        await expect(actOnPlainButton((button) => userEvent.clear(button))).rejects.toThrow();
        const locked = await renderScoped(<GtkEntry text="Locked" editable={false} />);
        await expect(userEvent.clear(await locked.findByRole(Gtk.AccessibleRole.TEXT_BOX))).rejects.toThrow();
        const refusing = await renderScoped(<GtkEntry text="abc" />);
        const blocked = await refusing.findByRole(Gtk.AccessibleRole.TEXT_BOX);

        blocked.connect("delete-text", () => {
            GObject.signalStopEmissionByName(blocked, "delete-text");
        });

        await expect(userEvent.clear(blocked)).rejects.toThrow();
        expect(editableText(blocked)).toBe("abc");
    });

    it("throws, leaving the text intact, when a tag protects part of a text view", async () => {
        await render(
            <GtkTextView
                buffer={(
                    <GtkTextBuffer>
                        {"erasable "}
                        <GtkTextTag name="keep" editable={false}>
                            prompt
                        </GtkTextTag>
                    </GtkTextBuffer>
                )}
            />,
        );

        const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        await expect(userEvent.clear(view)).rejects.toThrow();
        expect(bufferText(view)).toBe("erasable prompt");
    });
});

describe("userEvent.tab", () => {
    it("moves focus forward, and backward when shift is held", async () => {
        const { findByRole } = await renderColumn(
            <>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </>,
        );

        const first = await findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        const second = await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        first.grabFocus();
        await userEvent.tab(first);
        expect(second.isFocus()).toBe(true);
        await userEvent.tab(second, { isShiftHeld: true });
        expect(first.isFocus()).toBe(true);
    });
});

describe("userEvent clipboard", () => {
    it("copies, cuts and pastes a selection between editables, and pastes explicit text", async () => {
        const copied = await renderSelectedEntryPair("copy me");
        await userEvent.copy(copied.source);
        await userEvent.paste(copied.dest);
        expect(editableText(copied.dest)).toBe("copy me");
        const cut = await renderSelectedEntryPair("cut me");
        await userEvent.cut(cut.source);
        expect(editableText(cut.source)).toBe("");
        await userEvent.paste(cut.dest);
        expect(editableText(cut.dest)).toBe("cut me");
        await userEvent.paste(cut.source, "pasted literal");
        expect(editableText(cut.source)).toBe("pasted literal");
    });

    it("replaces a selection and undoes the paste, in an entry and in a text view", async () => {
        const { source } = await renderSelectedEntryPair("replace me");
        await userEvent.paste(source, "pasted");
        expect(editableText(source)).toBe("pasted");
        await userEvent.keyboard(source, "{Control>}z{/Control}");
        expect(editableText(source)).toBe("");
        await userEvent.keyboard(source, "{Control>}z{/Control}");
        expect(editableText(source)).toBe("replace me");
        const view = await renderTextView();
        await userEvent.type(view, "replace me");
        const buffer = view.getBuffer();
        buffer.selectRange(buffer.getIterAtOffset(0), buffer.getIterAtOffset("replace me".length));
        await userEvent.paste(view, "pasted");
        expect(bufferText(view)).toBe("pasted");
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("replace me");
    });

    it("throws when the widget is not editable", async () => {
        await expect(actOnPlainButton((button) => userEvent.copy(button))).rejects.toThrow();
        await expect(actOnPlainButton((button) => userEvent.paste(button, "text"))).rejects.toThrow();
    });
});

describe("userEvent.selectOptions", () => {
    it("selects by index in a drop-down and in a list box, and deselects from a list box", async () => {
        const dropdown = await renderDropDown(["Option A", "Option B", "Option C"]);
        await userEvent.selectOptions(dropdown, 1);
        expect((dropdown as Gtk.DropDown).getSelected()).toBe(1);
        const single = await renderTwoItemListBox();
        await userEvent.selectOptions(single, 0);
        expect((single as Gtk.ListBox).getSelectedRow()).not.toBeNull();
        const multiple = await renderTwoItemListBox(Gtk.SelectionMode.MULTIPLE);
        await userEvent.selectOptions(multiple, [0, 1]);
        await userEvent.deselectOptions(multiple, 0);
        expect((multiple as Gtk.ListBox).getSelectedRows()).toHaveLength(1);
    });

    it("throws for a widget that is not selectable, has no indexed children or takes one option", async () => {
        await expect(actOnPlainButton((button) => userEvent.selectOptions(button, 0))).rejects.toThrow();
        await expect(actOnPlainButton((button) => userEvent.deselectOptions(button, 0))).rejects.toThrow();
        const dropdown = await renderDropDown(["A", "B"]);
        await expect(userEvent.selectOptions(dropdown, [0, 1])).rejects.toThrow();
        await expect(userEvent.deselectOptions(dropdown, 0)).rejects.toThrow();
    });
});

describe("userEvent gestures", () => {
    it("emit rotate, zoom, swipe and long press on the widget's own gesture controllers", async () => {
        const handleAngleChanged = vi.fn<(angle: number, delta: number) => void>();
        const rotateGesture = <GtkGestureRotate onAngleChanged={handleAngleChanged} />;
        const rotated = await renderGesturedLabel("rotated", "Rotate me", rotateGesture);
        await userEvent.rotate(rotated, 1.25);
        expect(handleAngleChanged).toHaveBeenLastCalledWith(1.25, 1.25, expect.anything());
        await userEvent.rotate(rotated, 2, 0.5);
        expect(handleAngleChanged).toHaveBeenLastCalledWith(2, 0.5, expect.anything());
        const handleScaleChanged = vi.fn<(scale: number) => void>();
        const zoomGesture = <GtkGestureZoom onScaleChanged={handleScaleChanged} />;
        const zoomed = await renderGesturedLabel("zoomed", "Zoom me", zoomGesture);
        await userEvent.zoom(zoomed, 1.5);
        expect(handleScaleChanged.mock.calls[0]?.[0]).toBe(1.5);
        const handleSwipe = vi.fn<(vx: number, vy: number) => void>();
        const swiped = await renderGesturedLabel("swiped", "Swipe me", <GtkGestureSwipe onSwipe={handleSwipe} />);
        await userEvent.swipe(swiped, 200, -100);
        expect(handleSwipe.mock.calls[0]?.slice(0, 2)).toEqual([200, -100]);
    });

    it("emit a long press at the given coordinates, defaulting to the origin", async () => {
        const handlePressed = vi.fn<(x: number, y: number) => void>();

        const label = await renderGesturedLabel(
            "long-pressed",
            "Long press me",
            <GtkGestureLongPress onPressed={handlePressed} />,
        );

        await userEvent.longPress(label, 50, 75);
        expect(handlePressed.mock.calls[0]?.slice(0, 2)).toEqual([50, 75]);
        await userEvent.longPress(label);
        expect(handlePressed.mock.calls[1]?.slice(0, 2)).toEqual([0, 0]);
    });

    it("throws when the widget carries no matching gesture controller", async () => {
        await render(<GtkLabel name="no-gesture">No gesture</GtkLabel>);
        const label = await screen.findByName("no-gesture");
        await expect(userEvent.rotate(label, 1)).rejects.toThrow();
        await expect(userEvent.drop(label, "x")).rejects.toThrow();
    });
});

describe("userEvent.drag (1)", () => {
    it("emits drag-begin, one drag-update per step and drag-end, interpolating the offsets", async () => {
        const events: string[] = [];
        const recorded = await renderGesturedLabel("dragged", "Drag me", <GtkGestureDrag {...record(events)} />);
        await userEvent.drag(recorded, 30, -15);
        expect(events).toEqual(["begin", "update", "update", "end"]);
        const single = await renderDragUpdateCapture();
        await userEvent.drag(single.label, 30, -15, { steps: 1 });
        expect(single.updates).toEqual([[30, -15]]);
        const stepped = await renderDragUpdateCapture();
        await userEvent.drag(stepped.label, 40, -20, { steps: 4 });

        expect(stepped.updates).toEqual([
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
});

describe("userEvent.drag (2)", () => {
    it("reports a realistic start point and offset to the handlers", async () => {
        const started = await renderDragSelfCapture((self) => self.getStartPoint());
        await userEvent.drag(started.label, 30, -15, { startX: 50, startY: 25 });
        expect(started.values[0]).toEqual([true, 50, 25]);
        const offset = await renderDragSelfCapture((self) => self.getOffset());
        await userEvent.drag(offset.label, 40, -20);

        expect(offset.values).toEqual([
            [true, 20, -10],
            [true, 40, -20],
        ]);
    });
});

describe("controller fan-out (1)", () => {
    it("delivers a click to every gesture controller alongside the widget's own, at its center", async () => {
        const handleClick = vi.fn();
        const handlePressed = vi.fn<(nPress: number, x: number, y: number) => void>();
        const handleReleased = vi.fn();

        await render(
            <GtkButton
                label="Fan out"
                onClicked={handleClick}
                controllers={<GtkGestureClick onPressed={handlePressed} onReleased={handleReleased} />}
            />,
        );

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Fan out" });
        await userEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handlePressed).toHaveBeenCalledTimes(1);
        expect(handleReleased).toHaveBeenCalledTimes(1);
        const [, x, y] = handlePressed.mock.calls[0] ?? [];
        expect(x).toBe(button.getWidth() / 2);
        expect(y).toBe(button.getHeight() / 2);
        expect(x).toBeGreaterThan(0);
    });
});

describe("controller fan-out (2)", () => {
    it("delivers hover and drag sequences to every controller of their kind", async () => {
        const firstEnter = vi.fn();
        const secondEnter = vi.fn();
        const firstLeave = vi.fn();
        const secondLeave = vi.fn();

        const hovered = await renderGesturedLabel(
            "hovered",
            "Hover me",
            <>
                <GtkEventControllerMotion onEnter={firstEnter} onLeave={firstLeave} />
                <GtkEventControllerMotion onEnter={secondEnter} onLeave={secondLeave} />
            </>,
        );

        await userEvent.hover(hovered);
        await userEvent.unhover(hovered);
        expect(firstEnter).toHaveBeenCalledTimes(1);
        expect(secondEnter).toHaveBeenCalledTimes(1);
        expect(firstLeave).toHaveBeenCalledTimes(1);
        expect(secondLeave).toHaveBeenCalledTimes(1);
        const firstEvents: string[] = [];
        const secondEvents: string[] = [];

        const dragged = await renderGesturedLabel(
            "multi-dragged",
            "Drag me",
            <>
                <GtkGestureDrag {...record(firstEvents)} />
                <GtkGestureDrag {...record(secondEvents)} />
            </>,
        );

        await userEvent.drag(dragged, 30, -15);
        expect(firstEvents).toEqual(["begin", "update", "update", "end"]);
        expect(secondEvents).toEqual(firstEvents);
    });
});

describe("controller fan-out (3)", () => {
    it("delivers key events to every key controller", async () => {
        const firstPressed = vi.fn();
        const secondPressed = vi.fn();

        const { findByName } = await renderScoped(
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

        await userEvent.keyboard(await findByName("multi-key"), "{F5}");
        expect(firstPressed).toHaveBeenCalledTimes(1);
        expect(secondPressed).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent.drop", () => {
    it("emits drop with a marshalled payload at the given coordinates", async () => {
        const handleString = dropHandler();
        const target = await renderDropZone("drop-zone", GObject.TYPE_STRING, handleString);
        await userEvent.drop(target, "payload", { x: 10, y: 20 });
        expect(handleString).toHaveBeenCalledTimes(1);
        const [value, x, y] = handleString.mock.calls[0] ?? [];
        expect(value?.getString()).toBe("payload");
        expect(x).toBe(10);
        expect(y).toBe(20);
        const handleNumber = dropHandler();
        await userEvent.drop(await renderDropZone("number-zone", GObject.TYPE_DOUBLE, handleNumber), 42);
        expect(handleNumber.mock.calls[0]?.[0]?.getDouble()).toBe(42);
        const handleBoolean = dropHandler();
        await userEvent.drop(await renderDropZone("bool-zone", GObject.TYPE_BOOLEAN, handleBoolean), true);
        expect(handleBoolean.mock.calls[0]?.[0]?.getBoolean()).toBe(true);
    });

    it("forwards a pre-built GObject.Value unchanged", async () => {
        const handleDrop = dropHandler();
        const target = await renderDropZone("value-zone", GObject.TYPE_STRING, handleDrop);
        const value = new GObject.Value();
        value.init(GObject.TYPE_STRING);
        value.setString("preserved");
        await userEvent.drop(target, value);
        expect(handleDrop.mock.calls[0]?.[0]?.getString()).toBe("preserved");
    });
});

describe("userEvent.dragAndDrop", () => {
    it("fires drop on the target after verifying the source's DragSource", async () => {
        const handleDrop = dropHandler();
        const { source, target } = await renderDragAndDropPair({ onDrop: handleDrop });
        await userEvent.dragAndDrop(source, target, "payload");
        expect(handleDrop.mock.calls[0]?.[0]?.getString()).toBe("payload");
    });

    it("throws when the source has no DragSource controller", async () => {
        const { source, target } = await renderDragAndDropPair({ onDrop: () => true, hasDragSource: false });
        await expect(userEvent.dragAndDrop(source, target, "payload")).rejects.toThrow();
    });
});

describe("userEvent.keyboard: shortcuts (1)", () => {
    it("activates keyval and alternative triggers, and ignores keys that do not match", async () => {
        const keyval = await renderShortcutHost({ trigger: Gtk.ShortcutTrigger.parseString("F5") });
        await userEvent.keyboard(keyval.host, "{F5}");
        expect(keyval.onActivate).toHaveBeenCalledTimes(1);
        await userEvent.keyboard(keyval.host, "{F9}");
        expect(keyval.onActivate).toHaveBeenCalledTimes(1);

        const alternative = await renderShortcutHost({
            trigger: Gtk.AlternativeTrigger.new(
                Gtk.ShortcutTrigger.parseString("F6"),
                Gtk.ShortcutTrigger.parseString("F7"),
            ),
        });

        await userEvent.keyboard(alternative.host, "{F6}");
        await userEvent.keyboard(alternative.host, "{F7}");
        expect(alternative.onActivate).toHaveBeenCalledTimes(2);
    });

    it("retains a held modifier across calls until it is released", async () => {
        const { host, onActivate } = await renderShortcutHost({
            trigger: Gtk.ShortcutTrigger.parseString("<Shift>F5"),
        });

        await userEvent.keyboard(host, "{Shift>}");
        await userEvent.keyboard(host, "{F5}");
        expect(onActivate).toHaveBeenCalledTimes(1);
        await userEvent.keyboard(host, "{/Shift}");
        await userEvent.keyboard(host, "{F5}");
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("honors the shortcut's scope and the sensitivity of its host", async () => {
        const sibling = <GtkEntry name="field" />;
        expect(await pressShortcutFromField({ scope: Gtk.ShortcutScope.GLOBAL, sibling })).toHaveBeenCalledTimes(1);
        expect(await pressShortcutFromField({ scope: Gtk.ShortcutScope.LOCAL, sibling })).not.toHaveBeenCalled();

        expect(
            await pressShortcutFromField({ scope: Gtk.ShortcutScope.GLOBAL, isSensitive: false, sibling }),
        ).not.toHaveBeenCalled();
    });
});

describe("userEvent.keyboard: shortcuts (2)", () => {
    it("runs a global-scope shortcut at the root, behind the key controllers above its host", async () => {
        const order: string[] = [];

        const onActivate = await pressShortcutFromField({
            scope: Gtk.ShortcutScope.GLOBAL,
            isHandled: false,
            treeControllers: recordingKeyController(order, "above host"),
            children: <GtkEntry name="field" />,
        });

        expect(order).toEqual(["above host"]);
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("runs a capture-phase shortcut ahead of the target's key controllers, and a bubble one behind", async () => {
        expect(await pressShortcutOverStoppingField(Gtk.PropagationPhase.CAPTURE)).toHaveBeenCalled();
        expect(await pressShortcutOverStoppingField(Gtk.PropagationPhase.BUBBLE)).not.toHaveBeenCalled();
    });
});

describe("userEvent.keyboard: key controller propagation", () => {
    it("delivers presses and releases, with the held modifiers, to an ancestor's key controller", async () => {
        const pressed = await pressKeyOnProbe("{Escape}");

        expect(pressed.handleAncestorPressed).toHaveBeenCalledWith(
            Gdk.KEY_Escape,
            0,
            0,
            expect.any(Gtk.EventControllerKey),
        );

        const handleKeyReleased = vi.fn();
        const field = await renderKeyControllerTree(<GtkEventControllerKey onKeyReleased={handleKeyReleased} />);
        await userEvent.keyboard(field, "{Escape}");
        expect(handleKeyReleased).toHaveBeenCalledWith(Gdk.KEY_Escape, 0, 0, expect.any(Gtk.EventControllerKey));
        const modified = await pressKeyOnProbe("{Control>}s{/Control}");

        expect(modified.handleAncestorPressed).toHaveBeenCalledWith(
            Gdk.KEY_s,
            0,
            Gdk.ModifierType.CONTROL_MASK,
            expect.any(Gtk.EventControllerKey),
        );
    });

    it("skips a controller whose phase is none, and adds none to a widget that carries none", async () => {
        const probe = await pressKeyOnProbe("{Escape}", { fieldPhase: Gtk.PropagationPhase.NONE });
        expect(probe.handleFieldPressed).not.toHaveBeenCalled();
        expect(probe.handleAncestorPressed).toHaveBeenCalled();
        const field = await renderKeyControllerTree(null);
        await userEvent.keyboard(field, "{Escape}");
        expect(queryAllControllers(field, Gtk.EventControllerKey)).toHaveLength(0);
    });

    it("runs capture before the target, bubble after it, and stops at the first handler", async () => {
        expect(await keyPressOrder(Gtk.PropagationPhase.CAPTURE)).toEqual(["ancestor", "target"]);
        expect(await keyPressOrder()).toEqual(["target", "ancestor"]);

        const probe = await pressKeyOnProbe("{Escape}", {
            ancestorPhase: Gtk.PropagationPhase.CAPTURE,
            ancestorResult: Gdk.EVENT_STOP,
        });

        expect(probe.handleAncestorPressed).toHaveBeenCalled();
        expect(probe.handleFieldPressed).not.toHaveBeenCalled();
    });
});

describe("userEvent.keyboard: editable delegate", () => {
    it("orders the delegate's key controller against the widget's own by phase", async () => {
        expect(await delegateKeyPressOrder()).toEqual(["delegate", "field", "ancestor"]);
        expect(await delegateKeyPressOrder(Gtk.PropagationPhase.CAPTURE)).toEqual(["ancestor", "field", "delegate"]);
        const order: string[] = [];
        const phase = Gtk.PropagationPhase.TARGET;
        const field = await renderKeyControllerTree(null, recordingKeyController(order, "field", phase));
        attachRecordingKeyController(getDelegate(field), order, "delegate", phase);
        await userEvent.keyboard(field, "{Escape}");
        expect(order).toEqual(["delegate"]);
    });

    it("lets the delegate's built-in key binding consume the press before an ancestor's controller", async () => {
        const handleKeyPressed = vi.fn(() => Gdk.EVENT_PROPAGATE);

        await render(
            <GtkBox name="ancestor" controllers={<GtkEventControllerKey onKeyPressed={handleKeyPressed} />}>
                <GtkEntry name="field" text="hello" />
            </GtkBox>,
        );

        const field = await screen.findByName("field", { as: Gtk.Entry });
        field.setPosition(5);
        await userEvent.keyboard(field, "{ArrowLeft}");
        expect(field.getPosition()).toBe(4);
        expect(handleKeyPressed).not.toHaveBeenCalled();
    });

    it("activates an editable widget on Return alone", async () => {
        const handleActivate = vi.fn();
        await render(<GtkEntry name="field" onActivate={handleActivate} />);
        const field = await screen.findByName("field");
        await userEvent.keyboard(field, "{Escape}");
        expect(handleActivate).not.toHaveBeenCalled();
        await userEvent.keyboard(field, "{Enter}");
        expect(handleActivate).toHaveBeenCalledTimes(1);
    });
});
