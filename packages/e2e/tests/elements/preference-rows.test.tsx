import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

type ListenerClearedCase<Widget> = {
    renderRow: (ref: RefObject<Widget | null>, handler: Mock | null) => ReactElement;
    afterMount?: (row: Widget) => void;
    fireFirst: (row: Widget) => void | Promise<void>;
    fireSecond: (row: Widget) => void | Promise<void>;
};

const installAdjustment = (row: Adw.SpinRow, lower: number, upper: number, value: number) => {
    const adjustment = Gtk.Adjustment.new(value, lower, upper, 1, 10, 0);
    row.setAdjustment(adjustment);

    return adjustment;
};

const expectListenerClearedWhenHandlerNull = async <Widget,>({
    renderRow,
    afterMount,
    fireFirst,
    fireSecond,
}: ListenerClearedCase<Widget>) => {
    const handler = vi.fn();
    const ref = createRef<Widget>();
    const Harness = ({ active }: { active: Mock | null }) => renderRow(ref, active);
    const { rerender } = await render(<Harness active={handler} />);
    const row = ref.current;

    if (!row) {
        throw new Error("expected ref");
    }

    afterMount?.(row);
    await act(() => fireFirst(row));
    const callsBefore = handler.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);
    await rerender(<Harness active={null} />);
    await act(() => fireSecond(row));
    expect(handler.mock.calls).toHaveLength(callsBefore);
};

describe("render - SpinRow (1)", () => {
    it("creates a SpinRow with a value", async () => {
        const adjustment = Gtk.Adjustment.new(5, 0, 100, 1, 10, 0);

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow title="Quantity" adjustment={adjustment} />
            </AdwPreferencesGroup>,
        );

        expect(screen.getByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 5 } })).toBeDefined();
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

        if (!row) {
            throw new Error("expected ref");
        }

        installAdjustment(row, 0, 10, 1);

        await act(() => {
            row.setValue(7);
        });

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
            fireFirst: (row) => {
                row.setValue(2);
            },
            fireSecond: (row) => {
                row.setValue(5);
            },
        });
    });
});

describe("render - SwitchRow (1)", () => {
    it("creates a SwitchRow", async () => {
        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow title="Enabled" active={true} />
            </AdwPreferencesGroup>,
        );

        expect(screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: true, as: Gtk.Switch })).toBeDefined();
    });

    it("invokes onActiveChanged when toggled", async () => {
        const onActiveChanged = vi.fn();

        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow title="Enabled" active={false} onNotifyActive={onActiveChanged} />
            </AdwPreferencesGroup>,
        );

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: false, as: Gtk.Switch }));
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
            fireFirst: () =>
                userEvent.click(screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: false, as: Gtk.Switch })),
            fireSecond: () =>
                userEvent.click(screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: true, as: Gtk.Switch })),
        });
    });
});
