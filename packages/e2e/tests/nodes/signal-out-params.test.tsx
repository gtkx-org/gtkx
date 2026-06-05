import * as Gdk from "@gtkx/gi/gdk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkOverlay, GtkSpinButton, GtkText } from "@gtkx/react";
import { act, render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const FALSE = 0;
const GTK_INPUT_ERROR = -1;

describe("signal out-parameters - GtkSpinButton::input (pure out)", () => {
    it("writes the handler's tuple out-value back through the new_value pointer", async () => {
        const spinRef = createRef<Gtk.SpinButton>();

        await render(
            <GtkSpinButton
                ref={spinRef}
                lower={0}
                upper={1000}
                stepIncrement={1}
                onInput={(spin) => {
                    const parsed = Number.parseInt(spin.getText().replace(/[^0-9]/g, ""), 10);
                    return Number.isNaN(parsed) ? [GTK_INPUT_ERROR, 0] : [1, parsed];
                }}
            />,
        );

        const spin = spinRef.current as Gtk.SpinButton;
        await act(() => spin.setText("value: 042"));
        await act(() => spin.update());

        expect(spin.getValue()).toBe(42);
    });

    it("falls back to GTK's default parsing when the handler returns the not-handled primary", async () => {
        const spinRef = createRef<Gtk.SpinButton>();

        await render(
            <GtkSpinButton ref={spinRef} lower={0} upper={1000} stepIncrement={1} onInput={() => [FALSE, 0]} />,
        );

        const spin = spinRef.current as Gtk.SpinButton;
        await act(() => spin.setText("55"));
        await act(() => spin.update());

        expect(spin.getValue()).toBe(55);
    });

    it("round-trips the tuple out-value through a direct FFI connect", async () => {
        const spinRef = createRef<Gtk.SpinButton>();

        await render(<GtkSpinButton ref={spinRef} lower={0} upper={1000} stepIncrement={1} />);

        const spin = spinRef.current as Gtk.SpinButton;
        spin.connect("input", () => [1, 256]);

        await act(() => spin.setText("anything"));
        await act(() => spin.update());

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
                <GtkOverlay.Child>
                    <GtkBox widthRequest={40} heightRequest={20} />
                </GtkOverlay.Child>
            </GtkOverlay>,
        );

        await waitFor(() => {
            expect(handleGetChildPosition).toHaveBeenCalled();
        });
    });
});

describe("signal emit() - reads out-values and return back", () => {
    it("returns the [return, out] tuple when emitting a pure-out signal", async () => {
        const spinRef = createRef<Gtk.SpinButton>();

        await render(<GtkSpinButton ref={spinRef} lower={0} upper={1000} stepIncrement={1} />);

        const spin = spinRef.current as Gtk.SpinButton;
        spin.connect("input", () => [1, 256]);

        expect(spin.emit("input")).toEqual([1, 256]);
    });

    it("returns the non-void return value when emitting a signal with no out-parameters", async () => {
        const spinRef = createRef<Gtk.SpinButton>();

        await render(<GtkSpinButton ref={spinRef} lower={0} upper={1000} stepIncrement={1} />);

        const spin = spinRef.current as Gtk.SpinButton;
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
                <GtkOverlay.Child>
                    <GtkBox widthRequest={40} heightRequest={20} />
                </GtkOverlay.Child>
            </GtkOverlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        const child = overlay.getLastChild() as Gtk.Widget;
        const [handled, allocation] = overlay.emit("get-child-position", child) as [boolean, Gdk.Rectangle];

        expect(handled).toBe(true);
        expect(allocation.width).toBe(overlay.getWidth());
        expect(allocation.height).toBe(overlay.getHeight());
    });
});
