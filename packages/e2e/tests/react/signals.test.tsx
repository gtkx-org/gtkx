import type { ComponentProps } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import {
    GtkCheckButton,
    GtkEntry,
    GtkLabel,
    GtkListView,
    GtkNoSelection,
    GtkOverlay,
    GtkSpinButton,
    GtkSwitch,
    GtkText,
} from "@gtkx/jsx/gtk";
import { GtkSourceView } from "@gtkx/jsx/gtksource";
import { createPortal } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

type SnippetView = {
    view: GtkSource.View;
    buffer: GtkSource.Buffer;
    snippet: GtkSource.Snippet;
    location: Gtk.TextIter;
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

const PortalHost = ({ isActive }: { isActive: boolean }) =>
    createPortal(<GtkCheckButton active={isActive} onToggled={handlePortalToggled} />, portalTarget);

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

            return [true, new Gdk.Rectangle({ x: 11, y: 22, width: 33, height: 44 })];
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

describe("signal connect()/emit() - notify::<property> detailed signal (1)", () => {
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
});

describe("signal connect()/emit() - notify::<property> detailed signal (2)", () => {
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

    it("suppresses onNotify handlers while a commit writes the property, then delivers user changes", async () => {
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
});
