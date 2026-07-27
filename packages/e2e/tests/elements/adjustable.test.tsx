import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkScale } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { type ComponentProps, createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

type AdjustmentConfig = ComponentProps<typeof GtkAdjustment>;

const ScaleWithAdjustment = ({
    config,
    scaleRef,
    onValueChanged,
}: {
    config: AdjustmentConfig;
    scaleRef?: RefObject<Gtk.Scale | null>;
    onValueChanged?: (value: number) => void;
}) => (
    <GtkScale
        ref={scaleRef}
        adjustment={<GtkAdjustment {...config} />}
        onValueChanged={onValueChanged
            ? (scale) => {
                    onValueChanged(scale.getValue());
                }
            : undefined}
    />
);

const expectScaleAdjustment = async (
    config: AdjustmentConfig,
    read: (adjustment: Gtk.Adjustment | null | undefined) => number | undefined,
    expected: number,
) => {
    const ref = createRef<Gtk.Scale>();
    await render(<ScaleWithAdjustment config={config} scaleRef={ref} />);
    expect(read(ref.current?.getAdjustment())).toBe(expected);
};

describe("render - adjustment element (1)", () => {
    it("supplies an Adjustment to the Scale widget", async () => {
        const ref = createRef<Gtk.Scale>();
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 100 }} scaleRef={ref} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current?.getAdjustment()).not.toBeNull();
    });

    it("sets initial value", async () => {
        await render(<ScaleWithAdjustment config={{ value: 75, lower: 0, upper: 100 }} />);
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 75, min: 0, max: 100 } })).toBeTruthy();
    });

    it("sets lower bound", async () => {
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 10, upper: 100 }} />);
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 50, min: 10, max: 100 } })).toBeTruthy();
    });

    it("sets upper bound", async () => {
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 200 }} />);
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 50, min: 0, max: 200 } })).toBeTruthy();
    });

    it("sets step increment", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, stepIncrement: 5 },
            (adjustment) => adjustment?.getStepIncrement(),
            5,
        );
    });
});

describe("render - adjustment element (2)", () => {
    it("sets page increment", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, pageIncrement: 20 },
            (adjustment) => adjustment?.getPageIncrement(),
            20,
        );
    });

    it("sets page size", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, pageSize: 10 },
            (adjustment) => adjustment?.getPageSize(),
            10,
        );
    });

    it("uses GObject defaults when not specified", async () => {
        const ref = createRef<Gtk.Scale>();
        await render(<ScaleWithAdjustment config={{}} scaleRef={ref} />);
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 0, min: 0, max: 0 } })).toBeTruthy();
        const adjustment = ref.current?.getAdjustment();
        expect(adjustment?.getStepIncrement()).toBe(0);
        expect(adjustment?.getPageIncrement()).toBe(0);
        expect(adjustment?.getPageSize()).toBe(0);
    });
});

describe("render - adjustment element (3)", () => {
    it("keeps a stable adjustment but follows config value and bounds", async () => {
        const ref = createRef<Gtk.Scale>();

        const { rerender } = await render(
            <ScaleWithAdjustment config={{ value: 25, lower: 0, upper: 100 }} scaleRef={ref} />,
        );

        const adjustment = ref.current?.getAdjustment();
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 25 } })).toBeTruthy();
        await rerender(<ScaleWithAdjustment config={{ value: 75, lower: 0, upper: 200 }} scaleRef={ref} />);
        expect(ref.current?.getAdjustment()).toBe(adjustment);
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 75, max: 200 } })).toBeTruthy();
    });

    it("reflects values driven through the returned adjustment", async () => {
        const ref = createRef<Gtk.Scale>();
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 100 }} scaleRef={ref} />);
        const adjustment = ref.current?.getAdjustment();
        adjustment?.setUpper(200);
        adjustment?.setValue(80);
        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 80, max: 200 } })).toBeTruthy();
    });
});

describe("render - adjustment element (4)", () => {
    it("fires onValueChanged when the value changes", async () => {
        const ref = createRef<Gtk.Scale>();
        const onValueChanged = vi.fn();

        await render(
            <ScaleWithAdjustment
                config={{ value: 50, lower: 0, upper: 100 }}
                scaleRef={ref}
                onValueChanged={onValueChanged}
            />,
        );

        ref.current?.getAdjustment().setValue(75);

        await waitFor(() => {
            expect(onValueChanged).toHaveBeenCalledWith(75);
        });
    });

    it("stops firing onValueChanged when cleared", async () => {
        const ref = createRef<Gtk.Scale>();
        const onValueChanged = vi.fn();

        const { rerender } = await render(
            <ScaleWithAdjustment
                config={{ value: 50, lower: 0, upper: 100 }}
                scaleRef={ref}
                onValueChanged={onValueChanged}
            />,
        );

        ref.current?.getAdjustment().setValue(60);

        await waitFor(() => {
            expect(onValueChanged).toHaveBeenCalledWith(60);
        });

        const callCount = onValueChanged.mock.calls.length;
        await rerender(<ScaleWithAdjustment config={{ value: 60, lower: 0, upper: 100 }} scaleRef={ref} />);
        ref.current?.getAdjustment().setValue(70);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(onValueChanged.mock.calls).toHaveLength(callCount);
    });
});
