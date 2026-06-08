import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup, AdwSpinRow, AdwSwitchRow } from "@gtkx/react";
import { act, render } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject, useState } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

const installAdjustment = (row: Adw.SpinRow, lower: number, upper: number, value: number) => {
    const adjustment = Gtk.Adjustment.new(value, lower, upper, 1, 10, 0);
    row.setAdjustment(adjustment);
    return adjustment;
};

interface ListenerClearedCase<Widget> {
    renderRow: (ref: RefObject<Widget | null>, handler: Mock | null) => ReactElement;
    afterMount?: (row: Widget) => void;
    fireFirst: (row: Widget) => void;
    fireSecond: (row: Widget) => void;
}

const expectListenerClearedWhenHandlerNull = async <Widget,>({
    renderRow,
    afterMount,
    fireFirst,
    fireSecond,
}: ListenerClearedCase<Widget>) => {
    const handler = vi.fn();
    const ref = createRef<Widget>();
    let setActiveHandler: (next: Mock | null) => void = () => {};

    const Harness = () => {
        const [active, setActive] = useState<Mock | null>(handler);
        setActiveHandler = setActive;
        return renderRow(ref, active);
    };

    const { rerender } = await render(<Harness />);
    const row = ref.current;
    if (!row) throw new Error("expected ref");
    afterMount?.(row);

    await act(() => fireFirst(row));
    const callsBefore = handler.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);

    await act(() => setActiveHandler(null));
    await rerender(<Harness />);

    await act(() => fireSecond(row));
    expect(handler.mock.calls.length).toBe(callsBefore);
};

describe("render - SpinRow (1)", () => {
    it("creates a SpinRow with a value", async () => {
        const ref = createRef<Adw.SpinRow>();
        const adjustment = Gtk.Adjustment.new(5, 0, 100, 1, 10, 0);

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow ref={ref} title="Quantity" adjustment={adjustment} />
            </AdwPreferencesGroup>,
        );

        expect(ref.current?.getValue()).toBe(5);
    });

    it("invokes onValueChanged when the value is updated programmatically", async () => {
        const onValueChanged = vi.fn();
        const ref = createRef<Adw.SpinRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow ref={ref} title="Q" value={1} onNotifyValue={onValueChanged} />
            </AdwPreferencesGroup>,
        );

        const row = ref.current;
        if (!row) throw new Error("expected ref");
        installAdjustment(row, 0, 10, 1);

        await act(() => row.setValue(7));

        expect(onValueChanged).toHaveBeenCalled();
        const lastCall = onValueChanged.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(7);
    });
});

describe("render - SpinRow (2)", () => {
    it("removes the listener when onValueChanged is set to null", async () => {
        await expectListenerClearedWhenHandlerNull<Adw.SpinRow>({
            renderRow: (ref, handler) => (
                <AdwPreferencesGroup>
                    <AdwSpinRow ref={ref} title="Q" value={1} onNotifyValue={handler} />
                </AdwPreferencesGroup>
            ),
            afterMount: (row) => installAdjustment(row, 0, 10, 1),
            fireFirst: (row) => row.setValue(2),
            fireSecond: (row) => row.setValue(5),
        });
    });
});

describe("render - SwitchRow (1)", () => {
    it("creates a SwitchRow", async () => {
        const ref = createRef<Adw.SwitchRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow ref={ref} title="Enabled" active={true} />
            </AdwPreferencesGroup>,
        );

        expect(ref.current?.getActive()).toBe(true);
    });

    it("invokes onActiveChanged when toggled", async () => {
        const onActiveChanged = vi.fn();
        const ref = createRef<Adw.SwitchRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow ref={ref} title="Enabled" active={false} onNotifyActive={onActiveChanged} />
            </AdwPreferencesGroup>,
        );

        await act(() => ref.current?.setActive(true));

        expect(onActiveChanged).toHaveBeenCalled();
        const lastCall = onActiveChanged.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(true);
    });
});

describe("render - SwitchRow (2)", () => {
    it("clears the listener when onActiveChanged becomes null", async () => {
        await expectListenerClearedWhenHandlerNull<Adw.SwitchRow>({
            renderRow: (ref, handler) => (
                <AdwPreferencesGroup>
                    <AdwSwitchRow ref={ref} title="Enabled" active={false} onNotifyActive={handler} />
                </AdwPreferencesGroup>
            ),
            fireFirst: (row) => row.setActive(true),
            fireSecond: (row) => row.setActive(false),
        });
    });
});
