import type * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { AdwPreferencesGroup, AdwSpinRow, AdwSwitchRow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const installAdjustment = (row: Adw.SpinRow, lower: number, upper: number, value: number) => {
    const adjustment = new Gtk.Adjustment(value, lower, upper, 1, 10, 0);
    row.setAdjustment(adjustment);
    return adjustment;
};

describe("render - SpinRow", () => {
    it("creates a SpinRow with a value", async () => {
        const ref = createRef<Adw.SpinRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow ref={ref} title="Quantity" value={5} />
            </AdwPreferencesGroup>,
        );

        expect(ref.current?.getValue()).toBe(5);
    });

    it("invokes onValueChanged when the value is updated programmatically", async () => {
        const onValueChanged = vi.fn();
        const ref = createRef<Adw.SpinRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow ref={ref} title="Q" value={1} onValueChanged={onValueChanged} />
            </AdwPreferencesGroup>,
        );

        const row = ref.current;
        if (!row) throw new Error("expected ref");
        installAdjustment(row, 0, 10, 1);

        row.setValue(7);

        expect(onValueChanged).toHaveBeenCalled();
        const lastCall = onValueChanged.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(7);
    });

    it("removes the listener when onValueChanged is set to null", async () => {
        const handler = vi.fn();
        const ref = createRef<Adw.SpinRow>();
        let setActiveHandler: (next: typeof handler | null) => void = () => {};

        const Harness = () => {
            const [active, setActive] = useState<typeof handler | null>(handler);
            setActiveHandler = setActive;
            return (
                <AdwPreferencesGroup>
                    <AdwSpinRow ref={ref} title="Q" value={1} onValueChanged={active} />
                </AdwPreferencesGroup>
            );
        };

        const { rerender } = await render(<Harness />);
        const row = ref.current;
        if (!row) throw new Error("expected ref");
        installAdjustment(row, 0, 10, 1);

        row.setValue(2);
        const callsBefore = handler.mock.calls.length;
        expect(callsBefore).toBeGreaterThan(0);

        setActiveHandler(null);
        await rerender(<Harness />);

        row.setValue(5);
        expect(handler.mock.calls.length).toBe(callsBefore);
    });
});

describe("render - SwitchRow", () => {
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
                <AdwSwitchRow ref={ref} title="Enabled" active={false} onActiveChanged={onActiveChanged} />
            </AdwPreferencesGroup>,
        );

        ref.current?.setActive(true);

        expect(onActiveChanged).toHaveBeenCalled();
        const lastCall = onActiveChanged.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(true);
    });

    it("clears the listener when onActiveChanged becomes null", async () => {
        const handler = vi.fn();
        const ref = createRef<Adw.SwitchRow>();
        let setActiveHandler: (next: typeof handler | null) => void = () => {};

        const Harness = () => {
            const [active, setActive] = useState<typeof handler | null>(handler);
            setActiveHandler = setActive;
            return (
                <AdwPreferencesGroup>
                    <AdwSwitchRow ref={ref} title="Enabled" active={false} onActiveChanged={active} />
                </AdwPreferencesGroup>
            );
        };

        const { rerender } = await render(<Harness />);
        ref.current?.setActive(true);
        const callsBefore = handler.mock.calls.length;
        expect(callsBefore).toBeGreaterThan(0);

        setActiveHandler(null);
        await rerender(<Harness />);

        ref.current?.setActive(false);
        expect(handler.mock.calls.length).toBe(callsBefore);
    });
});
