import type { ComponentProps, Ref } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import { ParamFlags, paramSpecInt } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkBox,
    GtkCheckButton,
    GtkEntry,
    GtkEntryBuffer,
    GtkLabel,
    GtkListView,
    GtkNoSelection,
    GtkOverlay,
    GtkShortcut,
    GtkShortcutController,
    GtkSpinButton,
    GtkSwitch,
    GtkText,
    GtkTextBuffer,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { GtkSourceView } from "@gtkx/jsx/gtksource";
import { createPortal } from "@gtkx/react";
import { createElementComponent } from "@gtkx/react/config";
import { registerClass } from "@gtkx/runtime";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

type SnippetView = {
    view: GtkSource.View;
    buffer: GtkSource.Buffer;
    snippet: GtkSource.Snippet;
    location: Gtk.TextIter;
};

type DewPointProps = {
    "dew-point"?: number;
    onNotify?: (pspec: GObject.ParamSpec, self: GObject.Object) => void;
    onNotifyDewPoint?: (value: number | null, self: GObject.Object) => void;
};

type BeaconProps = {
    ref?: Ref<InstanceType<typeof BeaconLabel>>;
    label?: string;
    onFlipped?: () => void;
    onDataChanged?: (payload: string) => void;
    onActivateLink?: (uri: string) => boolean;
};

type Level2Props = {
    ref?: Ref<Level2Label | null>;
    level2Depth?: number;
    onNotifyLevel2Depth?: () => void;
};

type EntryProbeProps = {
    text: string;
    onNotifyText?: ComponentProps<typeof GtkEntry>["onNotifyText"];
    onNotifyBufferText?: ComponentProps<typeof GtkEntryBuffer>["onNotifyText"];
    onNotifyLength?: ComponentProps<typeof GtkEntryBuffer>["onNotifyLength"];
};

type SpinProbeProps = {
    value: number;
    hasAdjustment?: boolean;
    onNotifyValue?: ComponentProps<typeof GtkSpinButton>["onNotifyValue"];
    onNotifyText?: ComponentProps<typeof GtkSpinButton>["onNotifyText"];
};

type ToggleProbeProps = {
    activeName: string;
    onNotifyActive?: ComponentProps<typeof AdwToggleGroup>["onNotifyActive"];
    onNotifyActiveName?: ComponentProps<typeof AdwToggleGroup>["onNotifyActiveName"];
};

type BufferProbeProps = {
    text: string;
    onNotify?: ComponentProps<typeof GtkTextBuffer>["onNotify"];
    onNotifyText?: ComponentProps<typeof GtkTextBuffer>["onNotifyText"];
    onNotifyCursorPosition?: ComponentProps<typeof GtkTextBuffer>["onNotifyCursorPosition"];
};

type ProbeProps = {
    tree: Gtk.TreeListModel;
    log: string[];
    isArmed: boolean;
};

const FALSE = 0;
const INPUT_ERROR = -1;
const ROOT_NAMES = ["first", "second"];
const portalTarget = new Gtk.Box();
const handlePortalToggled = vi.fn();
const DewPointProbe = createElementComponent<DewPointProps>("GtkxDewPointLabel");

const BeaconLabel = registerClass(class Beacon extends Gtk.Label {}, {
    typeName: "GtkxBeaconLabel",
    signals: {
        flipped: {},
        "data-changed": { paramTypes: [GObject.TYPE_STRING] },
        "level-2-changed": { paramTypes: [GObject.TYPE_STRING] },
    },
});

const BeaconProbe = createElementComponent<BeaconProps>("GtkxBeaconLabel");
const Level2Probe = createElementComponent<Level2Props>("GtkxLevel2Label");

const makeAdjustment = () => Gtk.Adjustment.new(0, 0, 1000, 1, 10, 0);

const renderSpinButton = async (onInput?: ComponentProps<typeof GtkSpinButton>["onInput"]): Promise<Gtk.SpinButton> => {
    const spinRef = createRef<Gtk.SpinButton>();
    await render(<GtkSpinButton ref={spinRef} adjustment={makeAdjustment()} onInput={onInput} />);

    return spinRef.current as Gtk.SpinButton;
};

const setTextAndUpdate = async (spin: Gtk.SpinButton, text: string): Promise<void> => {
    await userEvent.clear(spin);
    await userEvent.type(spin, text);

    await act(() => {
        spin.update();
    });
};

const renderText = async (): Promise<Gtk.Text> => {
    const textRef = createRef<Gtk.Text>();
    await render(<GtkText ref={textRef} accessibleRole={Gtk.AccessibleRole.TEXT_BOX} />);

    return textRef.current as Gtk.Text;
};

const renderOverlayWithChild = async (mainLabel: string): Promise<Gtk.Overlay> => {
    const overlayRef = createRef<Gtk.Overlay>();

    await render(
        <GtkOverlay ref={overlayRef} widthRequest={200} heightRequest={200}>
            <GtkLabel>{mainLabel}</GtkLabel>
        </GtkOverlay>,
    );

    const overlay = overlayRef.current as Gtk.Overlay;

    await act(() => {
        const child = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 0);
        child.setName("overlay-child");
        child.setSizeRequest(40, 20);
        overlay.addOverlay(child);
    });

    return overlay;
};

const renderSnippetView = async (spec: string, initialText?: string): Promise<SnippetView> => {
    const viewRef = createRef<GtkSource.View>();
    await render(<GtkSourceView ref={viewRef} />);
    const view = viewRef.current as GtkSource.View;
    const buffer = view.getBuffer() as GtkSource.Buffer;

    if (initialText !== undefined) {
        buffer.setText(initialText, -1);
    }

    const snippet = GtkSource.Snippet.new(null, null);
    const chunk = GtkSource.SnippetChunk.new();
    chunk.setSpec(spec);
    snippet.addChunk(chunk);
    const location = buffer.getStartIter();
    expect(location.getOffset()).toBe(0);

    return { view, buffer, snippet, location };
};

const childModelFor = (item: GObject.Object): Gtk.StringList | null => {
    if (item instanceof Gtk.StringObject && ROOT_NAMES.includes(item.getString())) {
        return Gtk.StringList.new([`${item.getString()}-child`]);
    }

    return null;
};

const newSiblingTree = (): Gtk.TreeListModel =>
    Gtk.TreeListModel.new(Gtk.StringList.new(ROOT_NAMES), false, false, childModelFor);

const expandLastRoot = (tree: Gtk.TreeListModel): void => {
    for (let position = tree.getNItems() - 1; position >= 0; position -= 1) {
        const row = tree.getRow(position);

        if (row !== null && row.getDepth() === 0) {
            row.setExpanded(true);

            return;
        }
    }
};

const Probe = ({ tree, log, isArmed }: ProbeProps) => {
    const [report, setReport] = useState<object | null>(null);

    useLayoutEffect(() => {
        if (report === null) {
            return;
        }

        log.push("commit");
        expandLastRoot(tree);
    }, [tree, log, report]);

    const handleItemsChanged = (position: number): void => {
        log.push(`items-changed(${String(position)})`);
        setReport({});
    };

    const selection = <GtkNoSelection model={tree} onItemsChanged={isArmed ? handleItemsChanged : undefined} />;

    return <GtkListView model={selection} />;
};

const BufferProbe = (props: BufferProbeProps) => <GtkTextView buffer={<GtkTextBuffer {...props} />} />;

const EntryProbe = ({ text, onNotifyText, onNotifyBufferText, onNotifyLength }: EntryProbeProps) => (
    <GtkEntry
        text={text}
        onNotifyText={onNotifyText}
        buffer={<GtkEntryBuffer onNotifyText={onNotifyBufferText} onNotifyLength={onNotifyLength} />}
    />
);

const SpinProbe = ({ value, hasAdjustment = true, onNotifyValue, onNotifyText }: SpinProbeProps) => (
    <GtkSpinButton
        onNotifyValue={onNotifyValue}
        onNotifyText={onNotifyText}
        adjustment={hasAdjustment ? <GtkAdjustment value={value} lower={0} upper={100} /> : undefined}
    />
);

const ToggleProbe = ({ activeName, onNotifyActive, onNotifyActiveName }: ToggleProbeProps) => (
    <AdwToggleGroup activeName={activeName} onNotifyActive={onNotifyActive} onNotifyActiveName={onNotifyActiveName}>
        <AdwToggle name="one" label="one" />
        <AdwToggle name="two" label="two" />
    </AdwToggleGroup>
);

const PortalHost = ({ isActive }: { isActive: boolean }) =>
    createPortal(<GtkCheckButton active={isActive} onToggled={handlePortalToggled} />, portalTarget);

class DewPointLabel extends Gtk.Label {
    declare dewPoint: number;
}

class Level2Label extends Gtk.Label {
    declare level2Depth: number;
}

registerClass(DewPointLabel, {
    typeName: "GtkxDewPointLabel",
    properties: { "dew-point": paramSpecInt("dew-point", null, null, 0, 100, 0, ParamFlags.READWRITE) },
});

registerClass(Level2Label, {
    typeName: "GtkxLevel2Label",
    properties: { level2Depth: paramSpecInt("level-2-depth", null, null, 0, 100, 0, ParamFlags.READWRITE) },
});

describe("signal out-parameters - GtkSpinButton::input (pure out)", () => {
    it("writes the handler's tuple out-value back through the new_value pointer", async () => {
        const spin = await renderSpinButton((spinButton) => {
            const digits = spinButton.getText().replaceAll(/\D/g, "");

            return digits === "" ? [INPUT_ERROR, 0] : [1, Number(digits)];
        });

        await setTextAndUpdate(spin, "value: 042");
        await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 42 } });
        expect(spin).toHaveObjectProperty("value", 42);
    });

    it("falls back to GTK's default parsing when the handler returns the not-handled primary", async () => {
        const spin = await renderSpinButton(() => [FALSE, 0]);
        await setTextAndUpdate(spin, "55");
        await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 55 } });
        expect(spin).toHaveObjectProperty("value", 55);
    });

    it("round-trips the tuple out-value through a direct FFI connect", async () => {
        const spin = await renderSpinButton();
        spin.connect("input", () => [1, 256]);
        await setTextAndUpdate(spin, "anything");
        await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 256 } });
        expect(spin).toHaveObjectProperty("value", 256);
    });
});

describe("signal inout-parameters - GtkEditable::insert-text", () => {
    it("seeds the handler with the incoming position read from the inout pointer", async () => {
        const text = await renderText();
        const seenPositions: number[] = [];

        text.connect("insert-text", (_text: string, _length: number, position: number) => {
            seenPositions.push(position);

            return position;
        });

        await act(() => text.insertText("abc", 3, 0));
        expect(seenPositions[0]).toBe(0);
        expect(text).toHaveDisplayValue("abc");
    });

    it("writes the handler's returned position back so the default insertion honors it", async () => {
        const text = await renderText();
        await act(() => text.insertText("XXXX", 4, 0));
        text.connect("insert-text", () => 1);
        await act(() => text.insertText("Y", 1, 4));
        expect(text).toHaveDisplayValue("XYXXX");
    });
});

describe("signal out-parameters - GtkOverlay::get-child-position (caller-allocated out)", () => {
    it("writes a handler's returned GdkRectangle tuple back through the caller-allocated boxed", async () => {
        const overlay = await renderOverlayWithChild("Main Content");
        const child = screen.getByName("overlay-child");

        const handleGetChildPosition = vi.fn((_widget: Gtk.Widget, allocation: Gdk.Rectangle) => {
            expect(allocation).toBeInstanceOf(Gdk.Rectangle);
            allocation.x = 11;
            allocation.y = 22;
            allocation.width = 33;
            allocation.height = 44;

            return true;
        });

        overlay.connect("get-child-position", handleGetChildPosition);
        const [handled, allocation] = overlay.emit("get-child-position", child);
        expect(handleGetChildPosition).toHaveBeenCalled();
        expect(handled).toBe(true);
        expect([allocation.x, allocation.y, allocation.width, allocation.height]).toEqual([11, 22, 33, 44]);
    });
});

describe("signal emit() - reads out-values and return back", () => {
    it("returns the [return, out] tuple when emitting a pure-out signal", async () => {
        const spin = await renderSpinButton();
        spin.connect("input", () => [1, 256]);
        expect(spin.emit("input")).toEqual([1, 256]);
    });

    it("returns the non-void return value when emitting a signal with no out-parameters", async () => {
        const spin = await renderSpinButton();
        spin.connect("output", () => true);
        expect(spin.emit("output")).toBe(true);
    });
});

describe("signal emit() - caller-allocated out-parameter", () => {
    it("allocates the out-parameter so the default handler fills it through the returned wrapper", async () => {
        const overlay = await renderOverlayWithChild("Main");

        await waitFor(() => {
            expect(overlay.getWidth()).toBeGreaterThan(0);
        });

        const child = screen.getByName("overlay-child");
        const [handled, allocation] = overlay.emit("get-child-position", child);
        expect(handled).toBe(true);
        expect(allocation.width).toBe(overlay.getWidth());
        expect(allocation.height).toBe(overlay.getHeight());
    });
});

describe("signal emit() - boxed inout-parameter (GtkSource.View::push-snippet)", () => {
    it("advances the caller's TextIter in place through the shared boxed inout", async () => {
        const { view, buffer, snippet, location } = await renderSnippetView("abc");
        view.emit("push-snippet", snippet, location);
        globalThis.gc?.();
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false)).toBe("abc");
        expect(location.getOffset()).toBe(3);
    });

    it("honors a connected handler's in-place advance of the inout TextIter", async () => {
        const { view, buffer, snippet, location } = await renderSnippetView("X", "hello");

        view.connect("push-snippet", (_snippet: GtkSource.Snippet, iter: Gtk.TextIter) => {
            iter.forwardChars(5);
        });

        view.emit("push-snippet", snippet, location);
        globalThis.gc?.();
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false)).toBe("helloX");
    });

    it("writes a handler's returned GtkTextIter back through the caller-allocated boxed (opaque payload)", async () => {
        const { view, buffer, snippet, location } = await renderSnippetView("X", "hello");

        view.connect("push-snippet", () => {
            const advanced = buffer.getStartIter();
            advanced.forwardChars(5);

            return advanced;
        });

        view.emit("push-snippet", snippet, location);
        globalThis.gc?.();
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false)).toBe("helloX");
    });
});

describe("signal connect()/emit() - notify::<property> detailed signal", () => {
    it("fires a notify::<property> handler only when that property changes", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkLabel ref={labelRef} xalign={0}>
                initial
            </GtkLabel>,
        );

        const label = labelRef.current as Gtk.Label;
        const onLabelNotify = vi.fn();
        label.connect("notify::label", onLabelNotify);
        label.setLabel("changed");

        await waitFor(() => {
            expect(onLabelNotify).toHaveBeenCalledTimes(1);
        });

        onLabelNotify.mockClear();
        label.setXalign(1);
        expect(onLabelNotify).not.toHaveBeenCalled();
    });

    it("routes a typed emit('notify::<property>', pspec) to the detailed handler", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<GtkLabel ref={labelRef}>initial</GtkLabel>);
        const label = labelRef.current as Gtk.Label;
        let capturedPspec: GObject.ParamSpec | undefined;

        label.connect("notify::label", (pspec) => {
            capturedPspec = pspec;
        });

        label.setLabel("changed");

        await waitFor(() => {
            expect(capturedPspec?.getName()).toBe("label");
        });

        const pspec = capturedPspec;

        if (pspec === undefined) {
            throw new Error("expected the notify handler to capture a ParamSpec");
        }

        const onLabelEmit = vi.fn();
        const onOtherEmit = vi.fn();
        label.connect("notify::label", onLabelEmit);
        label.connect("notify::xalign", onOtherEmit);
        label.emit("notify::label", pspec);
        expect(onLabelEmit).toHaveBeenCalledTimes(1);
        expect(onOtherEmit).not.toHaveBeenCalled();
    });
});

describe("reentrant signal commits", () => {
    it("commits a handler's update only after the emitting model's items-changed unwinds", async () => {
        const tree = newSiblingTree();
        const log: string[] = [];
        const { rerender } = await render(<Probe tree={tree} log={log} isArmed={false} />);
        await rerender(<Probe tree={tree} log={log} isArmed />);

        await act(() => {
            tree.getRow(0)?.setExpanded(true);
            log.push("unwound");
        });

        await waitFor(() => {
            expect(tree.getNItems()).toBe(4);
        });

        expect(log).toEqual(["items-changed(1)", "unwound", "commit", "items-changed(3)", "commit"]);
        expect(tree.getRow(0)?.getExpanded()).toBe(true);
        expect(tree.getRow(2)?.getExpanded()).toBe(true);
    });
});

describe("user event signals", () => {
    it("suppresses onChanged while a commit writes text, then delivers user edits", async () => {
        const handleChanged = vi.fn();
        const { rerender } = await render(<GtkEntry text="first" onChanged={handleChanged} />);
        await rerender(<GtkEntry text="second" onChanged={handleChanged} />);
        expect(handleChanged).not.toHaveBeenCalled();
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "!");

        await waitFor(() => {
            expect(handleChanged).toHaveBeenCalled();
        });
    });

    it("suppresses the notify of the property a commit writes, then delivers user changes", async () => {
        const handleNotifyActive = vi.fn();
        const { rerender } = await render(<GtkSwitch active={false} onNotifyActive={handleNotifyActive} />);
        await rerender(<GtkSwitch active onNotifyActive={handleNotifyActive} />);
        expect(handleNotifyActive).not.toHaveBeenCalled();
        const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        await userEvent.click(switchWidget);

        await waitFor(() => {
            expect(handleNotifyActive).toHaveBeenCalledWith(false, expect.any(Gtk.Switch));
        });
    });

    it("suppresses a blockable signal inside a portal while the owning root commits", async () => {
        const { rerender } = await render(<PortalHost isActive={false} />);
        handlePortalToggled.mockClear();
        await rerender(<PortalHost isActive />);
        expect(handlePortalToggled).not.toHaveBeenCalled();
    });

    it("delivers lifecycle signals emitted by the commit itself", async () => {
        const handleMap = vi.fn();
        const handleRealize = vi.fn();
        await render(<GtkEntry onMap={handleMap} onRealize={handleRealize} />);

        await waitFor(() => {
            expect(handleMap).toHaveBeenCalled();
            expect(handleRealize).toHaveBeenCalled();
        });
    });

    it("delivers the notify of a property the widget changes in reaction to a commit write", async () => {
        const handlers = { onNotifyText: vi.fn(), onNotifyCursorPosition: vi.fn() };
        const { rerender } = await render(<BufferProbe text="first" {...handlers} />);
        handlers.onNotifyText.mockClear();
        handlers.onNotifyCursorPosition.mockClear();
        await rerender(<BufferProbe text="a longer second line" {...handlers} />);

        await waitFor(() => {
            expect(handlers.onNotifyCursorPosition).toHaveBeenCalledWith(20, expect.any(Gtk.TextBuffer));
        });

        expect(handlers.onNotifyText).not.toHaveBeenCalled();
    });

    it("delivers the notify of a property a deferred prop write changes", async () => {
        const handlers = { onNotifyActive: vi.fn(), onNotifyActiveName: vi.fn() };
        const { rerender } = await render(<ToggleProbe activeName="one" {...handlers} />);
        handlers.onNotifyActive.mockClear();
        handlers.onNotifyActiveName.mockClear();
        await rerender(<ToggleProbe activeName="two" {...handlers} />);

        await waitFor(() => {
            expect(handlers.onNotifyActive).toHaveBeenCalledWith(1, expect.any(Adw.ToggleGroup));
        });

        expect(handlers.onNotifyActiveName).not.toHaveBeenCalled();
    });

    it("delivers a delegate's notify of a property the commit did not write", async () => {
        const handlers = { onNotifyText: vi.fn(), onNotifyBufferText: vi.fn(), onNotifyLength: vi.fn() };
        const { rerender } = await render(<EntryProbe text="first" {...handlers} />);
        handlers.onNotifyText.mockClear();
        handlers.onNotifyBufferText.mockClear();
        handlers.onNotifyLength.mockClear();
        await rerender(<EntryProbe text="a much longer second" {...handlers} />);

        await waitFor(() => {
            expect(handlers.onNotifyLength).toHaveBeenCalledWith(20, expect.any(Gtk.EntryBuffer));
        });

        expect(handlers.onNotifyText).not.toHaveBeenCalled();
        expect(handlers.onNotifyBufferText).not.toHaveBeenCalled();
    });

    it("tells a bare onNotify about the reacting property and not about the written one", async () => {
        const handleNotify = vi.fn<(pspec: GObject.ParamSpec, self: Gtk.TextBuffer) => void>();
        const { rerender } = await render(<BufferProbe text="first" onNotify={handleNotify} />);
        handleNotify.mockClear();
        await rerender(<BufferProbe text="second" onNotify={handleNotify} />);
        const notified = handleNotify.mock.calls.map(([pspec]) => pspec.getName());
        expect(notified).toContain("cursor-position");
        expect(notified).not.toContain("text");
    });

    it("suppresses a delegate's notify of the property a commit writes", async () => {
        const handlers = { onNotifyValue: vi.fn(), onNotifyText: vi.fn() };
        const { rerender } = await render(<SpinProbe value={10} {...handlers} />);
        handlers.onNotifyValue.mockClear();
        handlers.onNotifyText.mockClear();
        await rerender(<SpinProbe value={42} {...handlers} />);

        await waitFor(() => {
            expect(handlers.onNotifyText).toHaveBeenCalled();
        });

        expect(handlers.onNotifyValue).not.toHaveBeenCalled();
    });

    it("suppresses every notify while a commit attaches a child", async () => {
        const handleValue = vi.fn();
        await render(<SpinProbe value={30} onNotifyValue={handleValue} />);
        expect(handleValue).not.toHaveBeenCalled();
    });

    it("suppresses every notify while a commit detaches a child", async () => {
        const handleValue = vi.fn();
        const { rerender } = await render(<SpinProbe value={30} onNotifyValue={handleValue} />);
        handleValue.mockClear();
        await rerender(<SpinProbe value={30} hasAdjustment={false} onNotifyValue={handleValue} />);
        expect(handleValue).not.toHaveBeenCalled();
    });

    it("suppresses the notify of a written property whose prop name is not already camelCase", async () => {
        const handlers = { onNotify: vi.fn(), onNotifyDewPoint: vi.fn() };
        const { rerender } = await render(<DewPointProbe dew-point={1} {...handlers} />);
        handlers.onNotify.mockClear();
        handlers.onNotifyDewPoint.mockClear();
        await rerender(<DewPointProbe dew-point={2} {...handlers} />);
        expect(handlers.onNotify).not.toHaveBeenCalled();
        expect(handlers.onNotifyDewPoint).not.toHaveBeenCalled();
    });

    it("keeps delivering notify after a commit throws while attaching a child", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkAdjustment value={0} lower={0} upper={100} />
                </GtkBox>,
            ),
        ).rejects.toThrow();

        const handleText = vi.fn();
        const { rerender } = await render(<SpinProbe value={10} onNotifyText={handleText} />);
        handleText.mockClear();
        await rerender(<SpinProbe value={42} onNotifyText={handleText} />);

        await waitFor(() => {
            expect(handleText).toHaveBeenCalled();
        });
    });
});

describe("handler props - a property name codegen escaped", () => {
    it("connects the notify handler of an escaped property name", async () => {
        const handleNotify = vi.fn();
        const shortcutRef = createRef<Gtk.Shortcut>();

        await render(
            <GtkLabel
                controllers={(
                    <GtkShortcutController
                        shortcuts={(
                            <GtkShortcut
                                ref={shortcutRef}
                                arguments_={GLib.Variant.newString("one")}
                                onNotifyArguments_={handleNotify}
                            />
                        )}
                    />
                )}
            >
                shortcut host
            </GtkLabel>,
        );

        await act(() => {
            shortcutRef.current?.setArguments(GLib.Variant.newString("two"));
        });

        await waitFor(() => {
            expect(handleNotify).toHaveBeenCalled();
        });
    });
});

describe("handler props - a signal only the registered type carries", () => {
    it("connects a handler prop to a signal the class declared", async () => {
        const handleFlipped = vi.fn();
        const beaconRef = createRef<InstanceType<typeof BeaconLabel>>();
        await render(<BeaconProbe ref={beaconRef} label="beacon" onFlipped={handleFlipped} />);
        expect(beaconRef.current).toBeInstanceOf(BeaconLabel);

        await act(() => {
            beaconRef.current?.emit("flipped");
        });

        expect(handleFlipped).toHaveBeenCalled();
    });

    it("reads a multi-word handler prop as the dashed signal the class declared", async () => {
        const handleDataChanged = vi.fn();
        const beaconRef = createRef<InstanceType<typeof BeaconLabel>>();
        await render(<BeaconProbe ref={beaconRef} label="beacon" onDataChanged={handleDataChanged} />);

        await act(() => {
            beaconRef.current?.emit("data-changed", "payload");
        });

        expect(handleDataChanged).toHaveBeenCalledWith("payload", beaconRef.current);
    });

    it("connects a declared signal whose handler prop only arrives on a later render", async () => {
        const handleFlipped = vi.fn();
        const beaconRef = createRef<InstanceType<typeof BeaconLabel>>();
        const { rerender } = await render(<BeaconProbe ref={beaconRef} label="beacon" />);
        await rerender(<BeaconProbe ref={beaconRef} label="beacon" onFlipped={handleFlipped} />);

        await act(() => {
            beaconRef.current?.emit("flipped");
        });

        expect(handleFlipped).toHaveBeenCalled();
    });

    it("still connects a signal the registered class inherits", async () => {
        const handleActivateLink = vi.fn(() => true);
        const beaconRef = createRef<InstanceType<typeof BeaconLabel>>();
        await render(<BeaconProbe ref={beaconRef} label="beacon" onActivateLink={handleActivateLink} />);

        await act(() => {
            beaconRef.current?.emit("activate-link", "https://gtkx.dev");
        });

        expect(handleActivateLink).toHaveBeenCalled();
    });

    it("throws for a handler prop naming no signal of the element", async () => {
        await expect(render(<BeaconProbe {...{ onDataChangd: vi.fn() }} label="beacon" />)).rejects.toThrow();
    });

    it("throws for a handler prop whose signal name is not a valid one", async () => {
        await expect(render(<BeaconProbe {...{ "onFlipped.twice": vi.fn() }} label="beacon" />)).rejects.toThrow();
    });
});

describe("user event signals (digit boundaries)", () => {
    it("connects a handler prop naming a signal whose word starts with a digit", async () => {
        const handleLevel = vi.fn();
        const beaconRef = createRef<InstanceType<typeof BeaconLabel>>();
        await render(<BeaconProbe {...{ onLevel2Changed: handleLevel }} ref={beaconRef} label="beacon" />);

        await act(() => {
            beaconRef.current?.emit("level-2-changed", "up");
        });

        expect(handleLevel).toHaveBeenCalledTimes(1);
    });
});

describe("user event signals (registered digit properties)", () => {
    it("notifies an onNotify handler for a property the accessor cannot spell", async () => {
        const handleNotify = vi.fn();
        const labelRef = createRef<Level2Label>();
        await render(<Level2Probe ref={labelRef} level2Depth={1} onNotifyLevel2Depth={handleNotify} />);

        await act(() => {
            if (labelRef.current !== null) {
                labelRef.current.level2Depth = 7;
            }
        });

        expect(handleNotify).toHaveBeenCalled();
    });
});
