import { SizeGroup } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefCallback, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const NARROW_WIDTH = 24;
const WIDE_WIDTH = 160;
const SHORT_HEIGHT = 10;
const TALL_HEIGHT = 80;

const naturalWidth = (widget: Gtk.Widget | null): number => widget?.measure(Gtk.Orientation.HORIZONTAL, -1)[1] ?? 0;

const naturalHeight = (widget: Gtk.Widget | null): number => widget?.measure(Gtk.Orientation.VERTICAL, -1)[1] ?? 0;

const MeasuredLabel = ({
    groupRef,
    captureRef,
    label,
    widthRequest,
    heightRequest,
}: {
    groupRef: RefCallback<Gtk.Widget>;
    captureRef: RefObject<Gtk.Label | null>;
    label: string;
    widthRequest: number;
    heightRequest?: number;
}) => {
    const ref = useMergeRefs<Gtk.Label>(groupRef, captureRef);
    return <GtkLabel ref={ref} label={label} widthRequest={widthRequest} heightRequest={heightRequest} />;
};

const GroupedLabels = ({
    labelARef,
    labelBRef,
    count,
    mode,
}: {
    labelARef: RefObject<Gtk.Label | null>;
    labelBRef: RefObject<Gtk.Label | null>;
    count: 0 | 1 | 2;
    mode?: Gtk.SizeGroupMode;
}) => (
    <GtkBox>
        <SizeGroup mode={mode}>
            {(ref) => (
                <>
                    {count >= 1 && (
                        <MeasuredLabel groupRef={ref} captureRef={labelARef} label="A" widthRequest={NARROW_WIDTH} />
                    )}
                    {count >= 2 && (
                        <MeasuredLabel groupRef={ref} captureRef={labelBRef} label="B" widthRequest={WIDE_WIDTH} />
                    )}
                </>
            )}
        </SizeGroup>
    </GtkBox>
);

const renderGroupOfTwo = async () => {
    const labelARef = createRef<Gtk.Label>();
    const labelBRef = createRef<Gtk.Label>();
    const { rerender } = await render(
        <GroupedLabels labelARef={labelARef} labelBRef={labelBRef} count={2} mode={Gtk.SizeGroupMode.HORIZONTAL} />,
    );
    expect(naturalWidth(labelARef.current)).toBe(WIDE_WIDTH);
    expect(naturalWidth(labelBRef.current)).toBe(WIDE_WIDTH);
    return { labelARef, labelBRef, rerender };
};

describe("SizeGroup members", () => {
    it("stretches every member to the widest member's natural size", async () => {
        await renderGroupOfTwo();
    });

    it("stops sharing size with a widget once it leaves the group", async () => {
        const { labelARef, rerender } = await renderGroupOfTwo();

        await rerender(
            <GroupedLabels
                labelARef={labelARef}
                labelBRef={createRef<Gtk.Label>()}
                count={1}
                mode={Gtk.SizeGroupMode.HORIZONTAL}
            />,
        );
        expect(naturalWidth(labelARef.current)).toBe(NARROW_WIDTH);
    });

    it("clears membership when the group empties", async () => {
        const { rerender } = await renderGroupOfTwo();

        await rerender(
            <GroupedLabels
                labelARef={createRef<Gtk.Label>()}
                labelBRef={createRef<Gtk.Label>()}
                count={0}
                mode={Gtk.SizeGroupMode.HORIZONTAL}
            />,
        );

        const freshLabelRef = createRef<Gtk.Label>();
        await rerender(
            <GroupedLabels
                labelARef={freshLabelRef}
                labelBRef={createRef<Gtk.Label>()}
                count={1}
                mode={Gtk.SizeGroupMode.HORIZONTAL}
            />,
        );
        expect(naturalWidth(freshLabelRef.current)).toBe(NARROW_WIDTH);
    });
});

describe("SizeGroup mode", () => {
    it("applies and updates the mode prop", async () => {
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        const GroupedLabelsWithMode = ({ mode }: { mode: Gtk.SizeGroupMode }): ReactNode => (
            <GtkBox>
                <SizeGroup mode={mode}>
                    {(ref) => (
                        <>
                            <MeasuredLabel
                                groupRef={ref}
                                captureRef={labelARef}
                                label="A"
                                widthRequest={NARROW_WIDTH}
                                heightRequest={TALL_HEIGHT}
                            />
                            <MeasuredLabel
                                groupRef={ref}
                                captureRef={labelBRef}
                                label="B"
                                widthRequest={WIDE_WIDTH}
                                heightRequest={SHORT_HEIGHT}
                            />
                        </>
                    )}
                </SizeGroup>
            </GtkBox>
        );

        const { rerender } = await render(<GroupedLabelsWithMode mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(labelARef.current)).toBe(WIDE_WIDTH);
        expect(naturalHeight(labelARef.current)).toBe(TALL_HEIGHT);
        expect(naturalHeight(labelBRef.current)).not.toBe(naturalHeight(labelARef.current));

        await rerender(<GroupedLabelsWithMode mode={Gtk.SizeGroupMode.BOTH} />);
        expect(naturalHeight(labelARef.current)).toBe(TALL_HEIGHT);
        expect(naturalHeight(labelBRef.current)).toBe(TALL_HEIGHT);
    });
});

describe("SizeGroup across subtrees", () => {
    it("groups widgets living in separate containers", async () => {
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        const App = () => (
            <GtkBox>
                <SizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                    {(ref) => (
                        <>
                            <GtkFrame label="Frame A">
                                <MeasuredLabel
                                    groupRef={ref}
                                    captureRef={labelARef}
                                    label="A"
                                    widthRequest={NARROW_WIDTH}
                                />
                            </GtkFrame>
                            <GtkFrame label="Frame B">
                                <MeasuredLabel
                                    groupRef={ref}
                                    captureRef={labelBRef}
                                    label="B"
                                    widthRequest={WIDE_WIDTH}
                                />
                            </GtkFrame>
                        </>
                    )}
                </SizeGroup>
            </GtkBox>
        );

        await render(<App />);

        expect(naturalWidth(labelARef.current)).toBe(WIDE_WIDTH);
        expect(naturalWidth(labelBRef.current)).toBe(WIDE_WIDTH);
        expect(labelARef.current?.getParent()).not.toBe(labelBRef.current?.getParent());
    });
});
