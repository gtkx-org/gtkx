import type { GtkScrolledWindowProps } from "@gtkx/jsx/gtk";
import type { ScaleMark } from "@gtkx/react/internal";
import type { ComponentProps, ReactNode, Ref, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkCalendar,
    GtkDrawingArea,
    GtkLabel,
    GtkLevelBar,
    GtkScale,
    GtkScrolledWindow,
} from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

type AdjustmentConfig = ComponentProps<typeof GtkAdjustment>;
type MarkedCalendarProps = { calendarRef: Ref<Gtk.Calendar>; days: number[] };

const MIN_MAX_MARKS = [
    { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Min" },
    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Max" },
];

const MIN_MID_MAX_MARKS = [
    { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Min" },
    { value: 50, position: Gtk.PositionType.BOTTOM, markup: "Mid" },
    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Max" },
];

const noopDraw = vi.fn<Gtk.DrawingAreaDrawFunc>();
const drawFunc1 = vi.fn<Gtk.DrawingAreaDrawFunc>();
const drawFunc2 = vi.fn<Gtk.DrawingAreaDrawFunc>();

const ScaleWithMarks = ({ marks }: { marks?: ScaleMark[] }) => (
    <GtkScale adjustment={<GtkAdjustment value={0} lower={0} upper={100} />} marks={marks} />
);

const expectSliderRange = (now: number, min: number, max: number): void => {
    const slider = screen.getByRole(Gtk.AccessibleRole.SLIDER);
    expect(slider).toHaveValue(now);
    expect(slider).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_MIN, min);
    expect(slider).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_MAX, max);
};

const expectDefaultRange = (): void => {
    expectSliderRange(0, 0, 100);
};

const expectMarksTransition = async (initialMarks: ScaleMark[], updatedMarks: ScaleMark[]): Promise<void> => {
    const { rerender } = await render(<ScaleWithMarks marks={initialMarks} />);
    expectDefaultRange();
    await rerender(<ScaleWithMarks marks={updatedMarks} />);
    expectDefaultRange();
};

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

const MarkedCalendar = ({ calendarRef, days }: MarkedCalendarProps): ReactNode => (
    <GtkCalendar ref={calendarRef} markedDays={days} />
);

const renderContentWindow = async (props: GtkScrolledWindowProps): Promise<Gtk.ScrolledWindow> => {
    const ref = createRef<Gtk.ScrolledWindow>();

    await render(
        <GtkScrolledWindow ref={ref} {...props}>
            <GtkLabel>Content</GtkLabel>
        </GtkScrolledWindow>,
    );

    const scrolledWindow = ref.current;

    if (scrolledWindow === null) {
        throw new Error("expected the scrolled window ref to be assigned");
    }

    return scrolledWindow;
};

function App({ text }: { text: string }) {
    return (
        <GtkScrolledWindow>
            <GtkLabel>{text}</GtkLabel>
        </GtkScrolledWindow>
    );
}

const expectDefaultContentSize = async (drawFunc: Gtk.DrawingAreaDrawFunc | undefined) => {
    const ref = createRef<Gtk.DrawingArea>();
    await render(<GtkDrawingArea ref={ref} drawFunc={drawFunc} />);
    expect(ref.current).toBeRooted();
    expect(ref.current).toHaveObjectProperty("contentWidth", 0);
    expect(ref.current).toHaveObjectProperty("contentHeight", 0);
};

describe("render - Scale marks", () => {
    it("creates Scale widget without marks", async () => {
        await render(<ScaleWithMarks />);
        expectDefaultRange();
    });

    it("creates Scale widget with marks", async () => {
        await render(<ScaleWithMarks marks={MIN_MID_MAX_MARKS} />);
        expectDefaultRange();
    });

    it("sets mark position", async () => {
        await render(
            <ScaleWithMarks
                marks={[
                    { value: 0, position: Gtk.PositionType.TOP, markup: "Top" },
                    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Bottom" },
                ]}
            />,
        );

        expectDefaultRange();
    });

    it("sets marks without labels", async () => {
        await render(
            <ScaleWithMarks
                marks={[
                    { value: 0, position: Gtk.PositionType.BOTTOM },
                    { value: 25, position: Gtk.PositionType.BOTTOM },
                    { value: 50, position: Gtk.PositionType.BOTTOM },
                    { value: 75, position: Gtk.PositionType.BOTTOM },
                    { value: 100, position: Gtk.PositionType.BOTTOM },
                ]}
            />,
        );

        expectDefaultRange();
    });

    it("updates marks when props change", async () => {
        await expectMarksTransition(
            [
                { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Start" },
                { value: 100, position: Gtk.PositionType.BOTTOM, markup: "End" },
            ],
            [
                { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Begin" },
                { value: 100, position: Gtk.PositionType.BOTTOM, markup: "End" },
            ],
        );
    });

    it("removes marks when array changes", async () => {
        await expectMarksTransition(MIN_MID_MAX_MARKS, MIN_MAX_MARKS);
    });

    it("handles inserting marks in the middle", async () => {
        await expectMarksTransition(MIN_MAX_MARKS, MIN_MID_MAX_MARKS);
    });
});

describe("render - adjustment element", () => {
    it("supplies an Adjustment to the Scale widget", async () => {
        const ref = createRef<Gtk.Scale>();
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 100 }} scaleRef={ref} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current?.getAdjustment()).not.toBeNull();
    });

    it("sets initial value", async () => {
        await render(<ScaleWithAdjustment config={{ value: 75, lower: 0, upper: 100 }} />);
        expectSliderRange(75, 0, 100);
    });

    it("sets lower bound", async () => {
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 10, upper: 100 }} />);
        expectSliderRange(50, 10, 100);
    });

    it("sets upper bound", async () => {
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 200 }} />);
        expectSliderRange(50, 0, 200);
    });

    it("sets step increment", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, stepIncrement: 5 },
            (adjustment) => adjustment?.getStepIncrement(),
            5,
        );
    });

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
        expectSliderRange(0, 0, 0);
        const adjustment = ref.current?.getAdjustment();
        expect(adjustment).toHaveObjectProperty("stepIncrement", 0);
        expect(adjustment).toHaveObjectProperty("pageIncrement", 0);
        expect(adjustment).toHaveObjectProperty("pageSize", 0);
    });

    it("keeps a stable adjustment but follows config value and bounds", async () => {
        const ref = createRef<Gtk.Scale>();

        const { rerender } = await render(
            <ScaleWithAdjustment config={{ value: 25, lower: 0, upper: 100 }} scaleRef={ref} />,
        );

        const adjustment = ref.current?.getAdjustment();
        expectSliderRange(25, 0, 100);
        await rerender(<ScaleWithAdjustment config={{ value: 75, lower: 0, upper: 200 }} scaleRef={ref} />);
        expect(ref.current?.getAdjustment()).toBe(adjustment);
        expectSliderRange(75, 0, 200);
    });

    it("reflects values driven through the returned adjustment", async () => {
        const ref = createRef<Gtk.Scale>();
        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 100 }} scaleRef={ref} />);
        const adjustment = ref.current?.getAdjustment();
        adjustment?.setUpper(200);
        adjustment?.setValue(80);
        expectSliderRange(80, 0, 200);
    });

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

describe("render - LevelBar", () => {
    it("creates LevelBar widget without offsets", async () => {
        const ref = createRef<Gtk.LevelBar>();
        await render(<GtkLevelBar ref={ref} />);
        expect(ref.current).not.toBeNull();
    });

    it("creates LevelBar widget with offsets", async () => {
        const ref = createRef<Gtk.LevelBar>();

        await render(
            <GtkLevelBar
                ref={ref}
                offsets={[
                    { name: "low", value: 0.25 },
                    { name: "high", value: 0.75 },
                ]}
            />,
        );

        expect(ref.current).not.toBeNull();
        const [hasLow, lowValue] = ref.current?.getOffsetValue("low") ?? [false, 0];
        expect(hasLow).toBe(true);
        expect(lowValue).toBe(0.25);
        const [hasHigh, highValue] = ref.current?.getOffsetValue("high") ?? [false, 0];
        expect(hasHigh).toBe(true);
        expect(highValue).toBe(0.75);
    });

    it("updates offset value", async () => {
        const ref = createRef<Gtk.LevelBar>();

        function App({ value }: { value: number }) {
            return <GtkLevelBar ref={ref} offsets={[{ name: "threshold", value }]} />;
        }

        await render(<App value={0.5} />);
        expect(ref.current?.getOffsetValue("threshold")[1]).toBe(0.5);
        await render(<App value={0.75} />);
        expect(ref.current?.getOffsetValue("threshold")[1]).toBe(0.75);
    });

    it("updates offset name", async () => {
        const ref = createRef<Gtk.LevelBar>();

        function App({ name }: { name: string }) {
            return <GtkLevelBar ref={ref} offsets={[{ name, value: 0.5 }]} />;
        }

        await render(<App name="old-name" />);
        expect(ref.current?.getOffsetValue("old-name")[0]).toBe(true);
        expect(ref.current?.getOffsetValue("new-name")[0]).toBe(false);
        await render(<App name="new-name" />);
        expect(ref.current?.getOffsetValue("old-name")[0]).toBe(false);
        expect(ref.current?.getOffsetValue("new-name")[0]).toBe(true);
    });

    it("removes offsets when array changes", async () => {
        const ref = createRef<Gtk.LevelBar>();

        function App({ shouldShowExtra }: { shouldShowExtra: boolean }) {
            const offsets = shouldShowExtra
                ? [
                        { name: "always", value: 0.5 },
                        { name: "extra", value: 0.75 },
                    ]
                : [{ name: "always", value: 0.5 }];

            return <GtkLevelBar ref={ref} offsets={offsets} />;
        }

        await render(<App shouldShowExtra={true} />);
        expect(ref.current?.getOffsetValue("always")[0]).toBe(true);
        expect(ref.current?.getOffsetValue("extra")[0]).toBe(true);
        await render(<App shouldShowExtra={false} />);
        expect(ref.current?.getOffsetValue("always")[0]).toBe(true);
        expect(ref.current?.getOffsetValue("extra")[0]).toBe(false);
    });

    it("flushes an in-place mutation of a reused offset object", async () => {
        const ref = createRef<Gtk.LevelBar>();
        const offset = { name: "threshold", value: 0.5 };

        function App() {
            return <GtkLevelBar ref={ref} offsets={[offset]} />;
        }

        const { rerender } = await render(<App />);
        expect(ref.current?.getOffsetValue("threshold")[1]).toBe(0.5);
        offset.value = 0.9;
        await rerender(<App />);
        expect(ref.current?.getOffsetValue("threshold")[1]).toBeCloseTo(0.9, 12);
    });
});

describe("render - Calendar > basic", () => {
    it("creates Calendar widget without marks", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<GtkCalendar ref={ref} />);
        expect(ref.current).not.toBeNull();
    });

    it("creates Calendar widget with marks", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<GtkCalendar ref={ref} markedDays={[15, 20, 25]} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
        expect(ref.current?.getDayIsMarked(25)).toBe(true);
        expect(ref.current?.getDayIsMarked(10)).toBe(false);
    });
});

describe("render - Calendar > marks updates", () => {
    it("updates marks when prop changes", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<MarkedCalendar calendarRef={ref} days={[15]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(false);
        await render(<MarkedCalendar calendarRef={ref} days={[20]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(false);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
    });

    it("removes marks when array changes", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<MarkedCalendar calendarRef={ref} days={[15, 20]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
        await render(<MarkedCalendar calendarRef={ref} days={[15]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(false);
    });

    it("handles adding marks dynamically", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<MarkedCalendar calendarRef={ref} days={[10, 20]} />);
        expect(ref.current?.getDayIsMarked(10)).toBe(true);
        expect(ref.current?.getDayIsMarked(15)).toBe(false);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
        await render(<MarkedCalendar calendarRef={ref} days={[10, 15, 20]} />);
        expect(ref.current?.getDayIsMarked(10)).toBe(true);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
    });
});

describe("render - ScrolledWindow", () => {
    it("sets AUTOMATIC scroll policy by default", async () => {
        const scrolledWindow = await renderContentWindow({});
        const [hPolicy, vPolicy] = scrolledWindow.getPolicy();
        expect(hPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("sets horizontal scroll policy", async () => {
        const scrolledWindow = await renderContentWindow({ hscrollbarPolicy: Gtk.PolicyType.NEVER });
        const [hPolicy] = scrolledWindow.getPolicy();
        expect(hPolicy).toBe(Gtk.PolicyType.NEVER);
    });

    it("sets vertical scroll policy", async () => {
        const scrolledWindow = await renderContentWindow({ vscrollbarPolicy: Gtk.PolicyType.ALWAYS });
        const [, vPolicy] = scrolledWindow.getPolicy();
        expect(vPolicy).toBe(Gtk.PolicyType.ALWAYS);
    });

    it("sets both scroll policies", async () => {
        const scrolledWindow = await renderContentWindow({
            hscrollbarPolicy: Gtk.PolicyType.NEVER,
            vscrollbarPolicy: Gtk.PolicyType.ALWAYS,
        });

        const [hPolicy, vPolicy] = scrolledWindow.getPolicy();
        expect(hPolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vPolicy).toBe(Gtk.PolicyType.ALWAYS);
    });

    it("updates scroll policy when props change", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        function App({ hPolicyProp, vPolicyProp }: { hPolicyProp: Gtk.PolicyType; vPolicyProp: Gtk.PolicyType }) {
            return (
                <GtkScrolledWindow ref={ref} hscrollbarPolicy={hPolicyProp} vscrollbarPolicy={vPolicyProp}>
                    <GtkLabel>Content</GtkLabel>
                </GtkScrolledWindow>
            );
        }

        await render(<App hPolicyProp={Gtk.PolicyType.AUTOMATIC} vPolicyProp={Gtk.PolicyType.AUTOMATIC} />);
        let [hPolicy, vPolicy] = ref.current?.getPolicy() ?? [];
        expect(hPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        await render(<App hPolicyProp={Gtk.PolicyType.NEVER} vPolicyProp={Gtk.PolicyType.ALWAYS} />);
        [hPolicy, vPolicy] = ref.current?.getPolicy() ?? [];
        expect(hPolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vPolicy).toBe(Gtk.PolicyType.ALWAYS);
    });

    it("contains child widget", async () => {
        await render(
            <GtkScrolledWindow>
                <GtkLabel>Scrollable Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        expect(screen.getByText("Scrollable Content")).toBeRooted();
    });

    it("works with Box as child", async () => {
        await render(
            <GtkScrolledWindow>
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel>Item 1</GtkLabel>
                    <GtkLabel>Item 2</GtkLabel>
                    <GtkLabel>Item 3</GtkLabel>
                </GtkBox>
            </GtkScrolledWindow>,
        );

        expect(screen.getAllByText(/^Item \d$/)).toHaveLength(3);
        expect(screen.getByText("Item 1")).toAppearBefore(screen.getByText("Item 3"));
    });

    it("updates child when changed", async () => {
        await render(<App text="Initial" />);
        expect(screen.getByText("Initial")).toHaveTextContent(/^Initial$/);
        await render(<App text="Updated" />);
        expect(screen.getByText("Updated")).toHaveTextContent(/^Updated$/);
    });
});

describe("render - DrawingArea", () => {
    it("creates DrawingArea without a draw function", async () => {
        await expectDefaultContentSize(undefined);
    });

    it("creates DrawingArea with a draw function", async () => {
        await expectDefaultContentSize(noopDraw);
    });

    it("sets content size", async () => {
        const ref = createRef<Gtk.DrawingArea>();
        await render(<GtkDrawingArea ref={ref} contentWidth={200} contentHeight={100} />);
        expect(ref.current).toHaveObjectProperty("contentWidth", 200);
        expect(ref.current).toHaveObjectProperty("contentHeight", 100);
    });

    it("updates content size when props change", async () => {
        const ref = createRef<Gtk.DrawingArea>();

        function App({ width, height }: { width: number; height: number }) {
            return <GtkDrawingArea ref={ref} contentWidth={width} contentHeight={height} />;
        }

        await render(<App width={100} height={50} />);
        expect(ref.current).toHaveObjectProperty("contentWidth", 100);
        expect(ref.current).toHaveObjectProperty("contentHeight", 50);
        await render(<App width={200} height={100} />);
        expect(ref.current).toHaveObjectProperty("contentWidth", 200);
        expect(ref.current).toHaveObjectProperty("contentHeight", 100);
    });

    it("updates draw function when prop changes", async () => {
        const ref = createRef<Gtk.DrawingArea>();

        function App({ drawFunc }: { drawFunc: Gtk.DrawingAreaDrawFunc }) {
            return <GtkDrawingArea ref={ref} contentWidth={40} contentHeight={40} drawFunc={drawFunc} />;
        }

        const { rerender } = await render(<App drawFunc={drawFunc1} />);
        const area = ref.current;

        await waitFor(() => {
            expect(drawFunc1).toHaveBeenCalled();
        });

        drawFunc1.mockClear();
        await rerender(<App drawFunc={drawFunc2} />);
        expect(ref.current).toBe(area);
        area?.queueDraw();

        await waitFor(() => {
            expect(drawFunc2).toHaveBeenCalled();
        });

        expect(drawFunc1).not.toHaveBeenCalled();
    });

    it("sets widget properties alongside drawFunc", async () => {
        const ref = createRef<Gtk.DrawingArea>();

        await render(
            <GtkDrawingArea
                ref={ref}
                drawFunc={noopDraw}
                contentWidth={300}
                contentHeight={200}
                visible={true}
                sensitive={true}
            />,
        );

        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("contentWidth", 300);
        expect(ref.current).toHaveObjectProperty("contentHeight", 200);
        expect(ref.current).toBeVisible();
        expect(ref.current).toBeEnabled();
    });
});
