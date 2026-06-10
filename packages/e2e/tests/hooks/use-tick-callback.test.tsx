import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox } from "@gtkx/jsx/gtk";
import { useTickCallback } from "@gtkx/react";
import { render, waitFor } from "@gtkx/testing";
import { type ReactNode, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

const FIRST_TICK_TIMEOUT = { timeout: 5000 };

interface TickHarnessProps {
    callback: Gtk.TickCallback;
    active?: boolean;
    onWidget?: (widget: Gtk.Box | null) => void;
}

const TickHarness = ({ callback, active = true, onWidget }: TickHarnessProps): ReactNode => {
    const boxRef = useRef<Gtk.Box | null>(null);
    useTickCallback(active ? boxRef : null, callback);
    return (
        <GtkBox
            ref={(box) => {
                boxRef.current = box;
                onWidget?.(box);
            }}
        />
    );
};

describe("useTickCallback (ticking)", () => {
    it("fires the callback on frame ticks with the widget and frame clock", async () => {
        let box: Gtk.Box | null = null;
        const callback = vi.fn<Gtk.TickCallback>(() => true);

        await render(<TickHarness callback={callback} onWidget={(widget) => (box = widget)} />);

        await waitFor(() => {
            expect(callback).toHaveBeenCalled();
        }, FIRST_TICK_TIMEOUT);
        const [widget, frameClock] = callback.mock.calls[0] ?? [];
        expect(widget).toBe(box);
        expect(frameClock).toBeDefined();
    });

    it("reads the latest callback without re-registering", async () => {
        const first = vi.fn(() => true);
        const second = vi.fn(() => true);

        const { rerender } = await render(<TickHarness callback={first} />);
        await rerender(<TickHarness callback={second} />);

        await waitFor(() => {
            expect(second).toHaveBeenCalled();
        }, FIRST_TICK_TIMEOUT);
    });

    it("stops ticking after the callback returns false", async () => {
        let calls = 0;
        const callback: Gtk.TickCallback = () => {
            calls += 1;
            return false;
        };

        await render(<TickHarness callback={callback} />);

        await waitFor(() => {
            expect(calls).toBeGreaterThan(0);
        }, FIRST_TICK_TIMEOUT);
        const settled = calls;
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(calls).toBe(settled);
    });
});

describe("useTickCallback (targets and lifecycle)", () => {
    it("stays inactive for a null target", async () => {
        const active = vi.fn(() => true);
        const inactive = vi.fn(() => true);

        await render(
            <GtkBox>
                <TickHarness callback={active} />
                <TickHarness callback={inactive} active={false} />
            </GtkBox>,
        );

        await waitFor(() => {
            expect(active).toHaveBeenCalled();
        }, FIRST_TICK_TIMEOUT);
        expect(inactive).not.toHaveBeenCalled();
    });

    it("removes the tick on unmount", async () => {
        const callback = vi.fn(() => true);

        const { unmount } = await render(<TickHarness callback={callback} />);

        await waitFor(() => {
            expect(callback).toHaveBeenCalled();
        }, FIRST_TICK_TIMEOUT);

        await unmount();
        const settled = callback.mock.calls.length;
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(callback.mock.calls.length).toBe(settled);
    });

    it("reattaches when the target widget is replaced", async () => {
        const callback = vi.fn<Gtk.TickCallback>(() => true);
        let box: Gtk.Box | null = null;
        const captureWidget = (widget: Gtk.Box | null): void => {
            if (widget) box = widget;
        };

        const { rerender } = await render(<TickHarness key="a" callback={callback} onWidget={captureWidget} />);

        await waitFor(() => {
            expect(callback).toHaveBeenCalled();
        }, FIRST_TICK_TIMEOUT);
        const firstBox = box;

        await rerender(<TickHarness key="b" callback={callback} onWidget={captureWidget} />);
        expect(box).not.toBe(firstBox);

        callback.mockClear();
        await waitFor(() => {
            expect(callback).toHaveBeenCalled();
        }, FIRST_TICK_TIMEOUT);
        const [widget] = callback.mock.calls.at(-1) ?? [];
        expect(widget).toBe(box);
    });
});
