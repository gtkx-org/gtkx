import { getBoxed, inoutBoxedFromFfi, outBoxedFromFfi, t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkBox, GtkLabel, GtkOverlay, GtkOverlayChild, GtkSpinButton, GtkText } from "@gtkx/jsx/gtk";
import { GtkSourceView } from "@gtkx/jsx/gtksource";
import { act, render, waitFor } from "@gtkx/testing";
import { type ComponentProps, createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const FALSE = 0;
const GTK_INPUT_ERROR = -1;

const makeAdjustment = () => Gtk.Adjustment.new(0, 0, 1000, 1, 10, 0);

const renderSpinButton = async (onInput?: ComponentProps<typeof GtkSpinButton>["onInput"]): Promise<Gtk.SpinButton> => {
    const spinRef = createRef<Gtk.SpinButton>();
    await render(<GtkSpinButton ref={spinRef} adjustment={makeAdjustment()} onInput={onInput} />);
    return spinRef.current as Gtk.SpinButton;
};

const setTextAndUpdate = async (spin: Gtk.SpinButton, text: string): Promise<void> => {
    await act(() => spin.setText(text));
    await act(() => spin.update());
};

describe("signal out-parameters - GtkSpinButton::input (pure out)", () => {
    it("writes the handler's tuple out-value back through the new_value pointer", async () => {
        const spin = await renderSpinButton((spinButton) => {
            const parsed = Number.parseInt(spinButton.getText().replace(/[^0-9]/g, ""), 10);
            return Number.isNaN(parsed) ? [GTK_INPUT_ERROR, 0] : [1, parsed];
        });

        await setTextAndUpdate(spin, "value: 042");

        expect(spin.getValue()).toBe(42);
    });

    it("falls back to GTK's default parsing when the handler returns the not-handled primary", async () => {
        const spin = await renderSpinButton(() => [FALSE, 0]);

        await setTextAndUpdate(spin, "55");

        expect(spin.getValue()).toBe(55);
    });

    it("round-trips the tuple out-value through a direct FFI connect", async () => {
        const spin = await renderSpinButton();
        spin.connect("input", () => [1, 256]);

        await setTextAndUpdate(spin, "anything");

        expect(spin.getValue()).toBe(256);
    });
});

describe("signal inout-parameters - GtkEditable::insert-text", () => {
    it("seeds the handler with the incoming position read from the inout pointer", async () => {
        const textRef = createRef<Gtk.Text>();

        await render(<GtkText ref={textRef} />);

        const text = textRef.current as Gtk.Text;
        const seenPositions: number[] = [];
        text.connect("insert-text", (_text: string, _length: number, position: number) => {
            seenPositions.push(position);
            return position;
        });

        await act(() => text.insertText("abc", 3, 0));

        expect(seenPositions[0]).toBe(0);
        expect(text.getText()).toBe("abc");
    });

    it("writes the handler's returned position back so the default insertion honors it", async () => {
        const textRef = createRef<Gtk.Text>();

        await render(<GtkText ref={textRef} />);

        const text = textRef.current as Gtk.Text;
        await act(() => text.insertText("XXXX", 4, 0));
        text.connect("insert-text", () => 1);

        await act(() => text.insertText("Y", 1, 4));

        expect(text.getText()).toBe("XYXXX");
    });
});

describe("signal out-parameters - GtkOverlay::get-child-position (caller-allocated out)", () => {
    it("passes the caller-allocated GdkRectangle to the handler as a mutable object", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const handleGetChildPosition = vi.fn((_widget: Gtk.Widget, allocation: Gdk.Rectangle) => {
            expect(allocation).toBeInstanceOf(Gdk.Rectangle);
            return false;
        });

        await render(
            <GtkOverlay
                ref={overlayRef}
                widthRequest={200}
                heightRequest={200}
                onGetChildPosition={handleGetChildPosition}
            >
                <GtkLabel label="Main Content" />
                <GtkOverlayChild>
                    <GtkBox widthRequest={40} heightRequest={20} />
                </GtkOverlayChild>
            </GtkOverlay>,
        );

        await waitFor(() => {
            expect(handleGetChildPosition).toHaveBeenCalled();
        });
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
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <GtkOverlay ref={overlayRef} widthRequest={200} heightRequest={200}>
                <GtkLabel label="Main" />
                <GtkOverlayChild>
                    <GtkBox widthRequest={40} heightRequest={20} />
                </GtkOverlayChild>
            </GtkOverlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        const child = overlay.getLastChild() as Gtk.Widget;
        const [handled, allocation] = overlay.emit("get-child-position", child);

        expect(handled).toBe(true);
        expect(allocation.width).toBe(overlay.getWidth());
        expect(allocation.height).toBe(overlay.getHeight());
    });
});

describe("signal emit() - boxed marshalling: caller-allocated out copies, inout shares", () => {
    const rectangleFfi = t.boxed("GdkRectangle", "borrowed", "libgtk-4.so.1", "gdk_rectangle_get_type");

    it("inoutBoxedFromFfi shares the caller's wrapper so an in-place mutation is visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = inoutBoxedFromFfi(rectangleFfi, rect);
        rect.width = 42;
        const seen = getBoxed(value) as Gdk.Rectangle;
        expect(seen.width).toBe(42);
    });

    it("outBoxedFromFfi copies the wrapper so a later mutation is not visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = outBoxedFromFfi(rectangleFfi, rect);
        rect.width = 42;
        const seen = getBoxed(value) as Gdk.Rectangle;
        expect(seen.width).toBe(1);
    });
});

describe("signal emit() - boxed inout-parameter (GtkSource.View::push-snippet)", () => {
    it("advances the caller's TextIter in place through the shared boxed inout", async () => {
        const viewRef = createRef<GtkSource.View>();

        await render(<GtkSourceView ref={viewRef} />);

        const view = viewRef.current as GtkSource.View;
        const buffer = view.getBuffer() as GtkSource.Buffer;
        const snippet = GtkSource.Snippet.new(null, null);
        const chunk = GtkSource.SnippetChunk.new();
        chunk.setSpec("abc");
        snippet.addChunk(chunk);

        const location = buffer.getStartIter();
        expect(location.getOffset()).toBe(0);

        view.emit("push-snippet", snippet, location);

        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false)).toBe("abc");
        expect(location.getOffset()).toBe(3);
    });
});

describe("signal connect()/emit() - notify::<property> detailed signal", () => {
    it("fires a notify::<property> handler only when that property changes", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(<GtkLabel ref={labelRef} label="initial" xalign={0} />);

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

        await render(<GtkLabel ref={labelRef} label="initial" />);

        const label = labelRef.current as Gtk.Label;
        let capturedPspec: GObject.ParamSpec | undefined;
        label.connect("notify::label", (pspec) => {
            capturedPspec = pspec;
        });

        label.setLabel("changed");
        await waitFor(() => {
            expect(capturedPspec).toBeDefined();
        });

        const pspec = capturedPspec;
        if (pspec === undefined) throw new Error("expected the notify handler to capture a ParamSpec");

        const onLabelEmit = vi.fn();
        const onOtherEmit = vi.fn();
        label.connect("notify::label", onLabelEmit);
        label.connect("notify::xalign", onOtherEmit);

        label.emit("notify::label", pspec);

        expect(onLabelEmit).toHaveBeenCalledTimes(1);
        expect(onOtherEmit).not.toHaveBeenCalled();
    });
});
