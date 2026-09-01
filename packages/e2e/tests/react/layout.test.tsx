import type { ReactElement, ReactNode, Ref, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwLayout, AdwLayoutSlot, AdwMultiLayoutView } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkBoxLayout,
    GtkButton,
    GtkConstraint,
    GtkConstraintGuide,
    GtkConstraintLayout,
    GtkFixed,
    GtkFixedLayout,
    GtkFixedLayoutChild,
    GtkFrame,
    GtkGrid,
    GtkGridLayout,
    GtkGridLayoutChild,
    GtkLabel,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkSizeGroup,
} from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";

type Constructor<T> = abstract new (...args: never[]) => T;

type ConstrainedBoxProps = {
    boxRef: RefObject<Gtk.Box | null>;
    build: (button: Gtk.Button) => ReactNode;
    guides?: ReactNode;
};

type BoxRef = { boxRef: Ref<Gtk.Box | null> };
type RenderedView = { view: Adw.MultiLayoutView; rerender: (layoutName: string) => Promise<void> };

type GroupedLabelsProps = {
    count: 0 | 1 | 2;
    mode?: Gtk.SizeGroupMode;
};

type SizedLabelsProps = {
    mode: Gtk.SizeGroupMode;
};

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;
const VFL_LINES = ["H:|-[a(==b)]-12-[b]-|", "V:|-[a]-|"];
const WIDER_VFL_LINES = [...VFL_LINES, "V:|-[b]-|"];

const LAYOUTS = (
    <>
        <AdwLayout name="wide">
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
                <AdwLayoutSlot id="sidebar" />
                <AdwLayoutSlot id="content" />
            </GtkBox>
        </AdwLayout>
        <AdwLayout name="narrow">
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwLayoutSlot id="sidebar" />
                <AdwLayoutSlot id="content" />
            </GtkBox>
        </AdwLayout>
    </>
);

const NARROW_WIDTH = 24;
const WIDE_WIDTH = 160;
const SHORT_HEIGHT = 10;
const TALL_HEIGHT = 80;

const grouped = (...widgets: (Gtk.Widget | null)[]): Gtk.Widget[] => widgets.filter((widget) => widget !== null);

const collectItems = <T extends GObject.Object>(model: Gio.ListModel, Type: Constructor<T>): T[] => {
    const items: T[] = [];

    for (let index = 0; index < model.getNItems(); index++) {
        const item = model.getItem(index);

        if (item instanceof Type) {
            items.push(item);
        }
    }

    return items;
};

const layoutFrom = (boxRef: RefObject<Gtk.Box | null>): Gtk.ConstraintLayout =>
    boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;

const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] =>
    collectItems(layout.observeConstraints(), Gtk.Constraint);

const collectGuides = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] =>
    collectItems(layout.observeGuides(), Gtk.ConstraintGuide);

const renderEmptyLayout = async (): Promise<RefObject<Gtk.Box | null>> => {
    const boxRef = createRef<Gtk.Box>();
    await render(<GtkBox ref={boxRef} layoutManager={<GtkConstraintLayout />} />);

    return boxRef;
};

const onlyConstraint = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint => {
    const constraints = collectConstraints(layoutFrom(boxRef));
    expect(constraints).toHaveLength(1);
    const [constraint] = constraints;

    if (!constraint) {
        throw new Error("expected exactly one constraint");
    }

    return constraint;
};

const widthConstraint = (button: Gtk.Button, constant: number): ReactNode => (
    <GtkConstraint key={constant} target={button} targetAttribute={A.WIDTH} relation={R.LE} constant={constant} />
);

const startConstraint = (button: Gtk.Button): ReactNode => (
    <GtkConstraint
        target={button}
        targetAttribute={A.START}
        sourceAttribute={A.START}
        constant={8}
        strength={S.STRONG}
    />
);

const guideSourceConstraint = (button: Gtk.Button, guide: Gtk.ConstraintGuide): ReactNode => (
    <GtkConstraint target={button} targetAttribute={A.END} source={guide} sourceAttribute={A.START} />
);

function ConstrainedBox({ boxRef, build, guides }: ConstrainedBoxProps) {
    const [button, setButton] = useState<Gtk.Button | null>(null);

    return (
        <GtkBox
            ref={boxRef}
            layoutManager={<GtkConstraintLayout guides={guides} constraints={button && build(button)} />}
        >
            <GtkButton ref={setButton} label="A" />
        </GtkBox>
    );
}

function WidthBox({ boxRef, constant }: { boxRef: RefObject<Gtk.Box | null>; constant: number }) {
    return <ConstrainedBox boxRef={boxRef} build={(button) => widthConstraint(button, constant)} />;
}

function ToggledConstraintBox({ boxRef, isShown }: { boxRef: RefObject<Gtk.Box | null>; isShown: boolean }) {
    return <ConstrainedBox boxRef={boxRef} build={(button) => isShown && startConstraint(button)} />;
}

function GuideSourceBox({ boxRef }: { boxRef: RefObject<Gtk.Box | null> }) {
    const [guide, setGuide] = useState<Gtk.ConstraintGuide | null>(null);

    return (
        <ConstrainedBox
            boxRef={boxRef}
            guides={<GtkConstraintGuide ref={setGuide} name="divider" minWidth={0} natWidth={0} maxWidth={0} />}
            build={(button) => guide && guideSourceConstraint(button, guide)}
        />
    );
}

function GuideBox({ boxRef, isShown }: { boxRef: RefObject<Gtk.Box | null>; isShown: boolean }) {
    return (
        <GtkBox
            ref={boxRef}
            layoutManager={(
                <GtkConstraintLayout
                    guides={isShown && (
                        <GtkConstraintGuide
                            name="space"
                            minWidth={10}
                            minHeight={10}
                            natWidth={100}
                            natHeight={20}
                            maxWidth={200}
                            maxHeight={30}
                            strength={S.STRONG}
                        />
                    )}
                />
            )}
        />
    );
}

function VflBox({ boxRef, lines }: { boxRef: RefObject<Gtk.Box | null>; lines: string[] }) {
    const [a, setA] = useState<Gtk.Button | null>(null);
    const [b, setB] = useState<Gtk.Button | null>(null);

    const views = useMemo(
        () => (a === null || b === null ? null : new Map<string, Gtk.ConstraintTarget>([["a", a], ["b", b]])),
        [a, b],
    );

    return (
        <GtkBox
            ref={boxRef}
            layoutManager={<GtkConstraintLayout vfl={views && [{ lines, hspacing: 8, vspacing: 8, views }]} />}
        >
            <GtkButton ref={setA} label="A" />
            <GtkButton ref={setB} label="B" />
        </GtkBox>
    );
}

const translate = (x: number, y: number): Gsk.Transform | null =>
    Gsk.Transform.new().translate(new Graphene.Point({ x, y }));

const expectPositionAt = (fixed: Gtk.Fixed, widget: Gtk.Widget, x: number, y: number): Promise<void> =>
    waitFor(() => {
        expect(fixed.getChildPosition(widget)).toEqual([x, y]);
    });

const countParentNotifications = (widget: Gtk.Widget): (() => number) => {
    let notifications = 0;

    widget.connect("notify::parent", () => {
        notifications += 1;
    });

    return () => notifications;
};

function MovableCellApp({ gridRef, column }: { gridRef: RefObject<Gtk.Grid | null>; column: number }) {
    return (
        <GtkGrid ref={gridRef}>
            <GtkGridLayoutChild column={column} row={0}>
                <GtkLabel>movable</GtkLabel>
            </GtkGridLayoutChild>
        </GtkGrid>
    );
}

function OptionalCellApp({ gridRef, shouldShow }: { gridRef: RefObject<Gtk.Grid | null>; shouldShow: boolean }) {
    return (
        <GtkGrid ref={gridRef}>
            {shouldShow && (
                <GtkGridLayoutChild column={0} row={0}>
                    <GtkLabel>A</GtkLabel>
                </GtkGridLayoutChild>
            )}
        </GtkGrid>
    );
}

function AnchoredApp({ fixedRef, x, y }: { fixedRef: RefObject<Gtk.Fixed | null>; x: number; y: number }) {
    return (
        <GtkFixed ref={fixedRef}>
            <GtkFixedLayoutChild transform={translate(x, y)}>
                <GtkLabel>anchored</GtkLabel>
            </GtkFixedLayoutChild>
        </GtkFixed>
    );
}

function ResetTransformApp({
    fixedRef,
    transform,
}: {
    fixedRef: RefObject<Gtk.Fixed | null>;
    transform: Gsk.Transform | null;
}) {
    return (
        <GtkFixed ref={fixedRef}>
            <GtkFixedLayoutChild transform={transform}>
                <GtkLabel>reset</GtkLabel>
            </GtkFixedLayoutChild>
        </GtkFixed>
    );
}

function ClippedOverlayApp({
    overlayRef,
    shouldClip,
}: {
    overlayRef: RefObject<Gtk.Overlay | null>;
    shouldClip: boolean;
}) {
    return (
        <GtkOverlay
            ref={overlayRef}
            overlays={[
                <GtkOverlayLayoutChild key="a" clipOverlay={shouldClip}>
                    <GtkButton label="Clipped" />
                </GtkOverlayLayoutChild>,
            ]}
        >
            <GtkLabel>Main</GtkLabel>
        </GtkOverlay>
    );
}

function TransientOverlayApp({ labelRef, shouldShow }: { labelRef: RefObject<Gtk.Label | null>; shouldShow: boolean }) {
    return (
        <GtkOverlay
            overlays={
                shouldShow && (
                    <GtkOverlayLayoutChild>
                        <GtkButton label="Transient" />
                    </GtkOverlayLayoutChild>
                )
            }
        >
            <GtkLabel ref={labelRef}>Main</GtkLabel>
        </GtkOverlay>
    );
}

function RemovableOverlayApp({
    overlayRef,
    shouldShow,
}: {
    overlayRef: RefObject<Gtk.Overlay | null>;
    shouldShow: boolean;
}) {
    return (
        <GtkOverlay
            ref={overlayRef}
            overlays={
                shouldShow
                    ? [
                            <GtkOverlayLayoutChild key="a">
                                <GtkButton label="Removable" />
                            </GtkOverlayLayoutChild>,
                        ]
                    : []
            }
        >
            <GtkLabel>Main</GtkLabel>
        </GtkOverlay>
    );
}

const SpacedBox = ({ boxRef, spacing }: BoxRef & { spacing: number }) => (
    <GtkBox ref={boxRef} layoutManager={<GtkBoxLayout spacing={spacing} />} />
);

const OptionalLayoutBox = ({ boxRef, shouldShow }: BoxRef & { shouldShow: boolean }) => (
    <GtkBox ref={boxRef} layoutManager={shouldShow ? <GtkBoxLayout spacing={8} /> : null} />
);

const SwitchableLayoutBox = ({ boxRef, shouldUseGrid }: BoxRef & { shouldUseGrid: boolean }) => (
    <GtkBox ref={boxRef} layoutManager={shouldUseGrid ? <GtkGridLayout /> : <GtkBoxLayout spacing={4} />} />
);

const renderLayoutManager = async (layoutManager: ReactElement): Promise<Gtk.LayoutManager | null> => {
    const boxRef = createRef<Gtk.Box>();
    await render(<GtkBox ref={boxRef} layoutManager={layoutManager} />);

    return boxRef.current?.getLayoutManager() ?? null;
};

const buildView = (ref: RefObject<Adw.MultiLayoutView | null>, layoutName: string): ReactElement => (
    <AdwMultiLayoutView
        ref={ref}
        layoutName={layoutName}
        layouts={LAYOUTS}
        sidebarSlot={<GtkLabel>Side</GtkLabel>}
        contentSlot={<GtkLabel>Main</GtkLabel>}
    />
);

const renderView = async (layoutName: string): Promise<RenderedView> => {
    const ref = createRef<Adw.MultiLayoutView>();
    const { rerender } = await render(buildView(ref, layoutName));
    const { current } = ref;

    if (!current) {
        throw new TypeError("Expected a MultiLayoutView instance");
    }

    return { view: current, rerender: (next) => rerender(buildView(ref, next)) };
};

const naturalWidth = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.HORIZONTAL, -1)[1];
const naturalHeight = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.VERTICAL, -1)[1];

const useLabelPair = () => {
    const [a, setA] = useState<Gtk.Label | null>(null);
    const [b, setB] = useState<Gtk.Label | null>(null);

    return { a, b, setA, setB };
};

function GroupedLabels({ count, mode }: GroupedLabelsProps) {
    const { a, b, setA, setB } = useLabelPair();

    return (
        <GtkBox>
            <GtkSizeGroup mode={mode} widgets={grouped(count >= 1 ? a : null, count >= 2 ? b : null)} />
            {count >= 1 && (
                <GtkLabel ref={setA} widthRequest={NARROW_WIDTH}>
                    A
                </GtkLabel>
            )}
            {count >= 2 && (
                <GtkLabel ref={setB} widthRequest={WIDE_WIDTH}>
                    B
                </GtkLabel>
            )}
        </GtkBox>
    );
}

function SizedLabels({ mode }: SizedLabelsProps) {
    const { a, b, setA, setB } = useLabelPair();

    return (
        <GtkBox>
            <GtkSizeGroup mode={mode} widgets={grouped(a, b)} />
            <GtkLabel ref={setA} widthRequest={NARROW_WIDTH} heightRequest={TALL_HEIGHT}>
                A
            </GtkLabel>
            <GtkLabel ref={setB} widthRequest={WIDE_WIDTH} heightRequest={SHORT_HEIGHT}>
                B
            </GtkLabel>
        </GtkBox>
    );
}

function FramedLabels() {
    const { a, b, setA, setB } = useLabelPair();

    return (
        <GtkBox>
            <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL} widgets={grouped(a, b)} />
            <GtkFrame label="Frame A">
                <GtkLabel ref={setA} widthRequest={NARROW_WIDTH}>
                    A
                </GtkLabel>
            </GtkFrame>
            <GtkFrame label="Frame B">
                <GtkLabel ref={setB} widthRequest={WIDE_WIDTH}>
                    B
                </GtkLabel>
            </GtkFrame>
        </GtkBox>
    );
}

const expectGroupedWide = async (app: ReactElement) => {
    const result = await render(app);
    expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
    expect(naturalWidth(screen.getByText("B"))).toBe(WIDE_WIDTH);

    return result;
};

const expectGroupOfTwoIsWide = () => expectGroupedWide(<GroupedLabels count={2} mode={Gtk.SizeGroupMode.HORIZONTAL} />);

describe("render - GtkConstraintLayout attach", () => {
    it("installs the layout manager on the host widget", async () => {
        const boxRef = await renderEmptyLayout();
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.ConstraintLayout);
    });

    it("accepts a layout with no constraints or guides", async () => {
        const layout = layoutFrom(await renderEmptyLayout());
        expect(collectConstraints(layout)).toHaveLength(0);
        expect(collectGuides(layout)).toHaveLength(0);
    });
});

describe("render - GtkConstraint props", () => {
    it("builds a constraint from a widget reference", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<WidthBox boxRef={boxRef} constant={100} />);
        const constraint = onlyConstraint(boxRef);
        expect(constraint).toHaveObjectProperty("target", boxRef.current?.getFirstChild());
        expect(constraint).toHaveObjectProperty("targetAttribute", A.WIDTH);
        expect(constraint).toHaveObjectProperty("relation", R.LE);
        expect(constraint).toHaveObjectProperty("constant", 100);
        expect(constraint).toHaveObjectProperty("multiplier", 1);
        expect(constraint).toHaveObjectProperty("strength", S.REQUIRED);
    });

    it("leaves an omitted source as the layout's own widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<ToggledConstraintBox boxRef={boxRef} isShown={true} />);
        const constraint = onlyConstraint(boxRef);
        expect(constraint.getSource()).toBeNull();
        expect(constraint).toHaveObjectProperty("sourceAttribute", A.START);
        expect(constraint).toHaveObjectProperty("constant", 8);
        expect(constraint).toHaveObjectProperty("strength", S.STRONG);
    });
});

describe("render - GtkConstraint lifecycle", () => {
    it("recreates the constraint when its key changes with a construct-only prop", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<WidthBox boxRef={boxRef} constant={100} />);
        expect(onlyConstraint(boxRef)).toHaveObjectProperty("constant", 100);
        await rerender(<WidthBox boxRef={boxRef} constant={50} />);
        expect(onlyConstraint(boxRef)).toHaveObjectProperty("constant", 50);
    });

    it("removes the constraint from the layout when it unmounts", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<ToggledConstraintBox boxRef={boxRef} isShown={true} />);
        expect(collectConstraints(layoutFrom(boxRef))).toHaveLength(1);
        await rerender(<ToggledConstraintBox boxRef={boxRef} isShown={false} />);
        expect(collectConstraints(layoutFrom(boxRef))).toHaveLength(0);
    });
});

describe("render - GtkConstraintGuide", () => {
    it("adds a guide with its size and strength props", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GuideBox boxRef={boxRef} isShown={true} />);
        const guides = collectGuides(layoutFrom(boxRef));
        expect(guides).toHaveLength(1);
        const guide = guides[0] as Gtk.ConstraintGuide;
        expect(guide).toHaveObjectProperty("name", "space");
        expect(guide.getMinSize()).toEqual([10, 10]);
        expect(guide.getNatSize()).toEqual([100, 20]);
        expect(guide.getMaxSize()).toEqual([200, 30]);
        expect(guide).toHaveObjectProperty("strength", S.STRONG);
    });

    it("removes the guide from the layout when it unmounts", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<GuideBox boxRef={boxRef} isShown={true} />);
        expect(collectGuides(layoutFrom(boxRef))).toHaveLength(1);
        await rerender(<GuideBox boxRef={boxRef} isShown={false} />);
        expect(collectGuides(layoutFrom(boxRef))).toHaveLength(0);
    });

    it("resolves a guide passed as a constraint source", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GuideSourceBox boxRef={boxRef} />);
        const [guide] = collectGuides(layoutFrom(boxRef));
        const constraint = onlyConstraint(boxRef);
        expect(constraint).toHaveObjectProperty("source", guide);
        expect(constraint).toHaveObjectProperty("target", boxRef.current?.getFirstChild());
    });
});

describe("render - GtkConstraintLayout vfl", () => {
    it("adds the constraints a VFL description expands to", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<VflBox boxRef={boxRef} lines={VFL_LINES} />);
        expect(collectConstraints(layoutFrom(boxRef)).length).toBeGreaterThanOrEqual(5);
    });

    it("re-parses the description when the lines change", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<VflBox boxRef={boxRef} lines={VFL_LINES} />);
        const initial = collectConstraints(layoutFrom(boxRef)).length;
        expect(initial).toBeGreaterThanOrEqual(5);
        await rerender(<VflBox boxRef={boxRef} lines={WIDER_VFL_LINES} />);
        expect(collectConstraints(layoutFrom(boxRef)).length).toBeGreaterThan(initial);
    });

    it("rejects a description that names an unknown view", async () => {
        const boxRef = createRef<Gtk.Box>();
        await expect(render(<VflBox boxRef={boxRef} lines={["H:|-[ghost]-|"]} />)).rejects.toThrow();
    });
});

describe("render - GtkGridLayoutChild", () => {
    it("attaches children at their cells", async () => {
        const gridRef = createRef<Gtk.Grid>();

        await render(
            <GtkGrid ref={gridRef} columnSpacing={6} rowSpacing={4}>
                <GtkGridLayoutChild column={0} row={0}>
                    <GtkLabel>A</GtkLabel>
                </GtkGridLayoutChild>
                <GtkGridLayoutChild column={1} row={1}>
                    <GtkLabel>B</GtkLabel>
                </GtkGridLayoutChild>
            </GtkGrid>,
        );

        const grid = gridRef.current as Gtk.Grid;
        expect(grid).toHaveObjectProperty("columnSpacing", 6);
        expect(grid.getChildAt(0, 0)).toHaveTextContent(/^A$/);
        expect(grid.getChildAt(1, 1)).toHaveTextContent(/^B$/);
    });

    it("spans columns and rows", async () => {
        const gridRef = createRef<Gtk.Grid>();

        await render(
            <GtkGrid ref={gridRef}>
                <GtkGridLayoutChild column={0} row={0} columnSpan={2} rowSpan={2}>
                    <GtkLabel>wide</GtkLabel>
                </GtkGridLayoutChild>
            </GtkGrid>,
        );

        const grid = gridRef.current as Gtk.Grid;
        const label = grid.getChildAt(0, 0) as Gtk.Label;
        expect(label).toHaveTextContent(/^wide$/);
        expect(grid.getChildAt(1, 1)).toBe(label);
    });

    it("moves a child in place when its cell changes", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const { rerender } = await render(<MovableCellApp gridRef={gridRef} column={0} />);
        const label = gridRef.current?.getChildAt(0, 0) as Gtk.Widget;
        const parentNotifications = countParentNotifications(label);
        await rerender(<MovableCellApp gridRef={gridRef} column={2} />);
        expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
        expect(gridRef.current?.getChildAt(2, 0)).toBe(label);
        expect(parentNotifications()).toBe(0);
    });

    it("exposes the real Gtk.GridLayoutChild through ref", async () => {
        const cellRef = createRef<Gtk.GridLayoutChild>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkGrid>
                <GtkGridLayoutChild ref={cellRef} column={3} row={1}>
                    <GtkLabel ref={labelRef}>cell</GtkLabel>
                </GtkGridLayoutChild>
            </GtkGrid>,
        );

        expect(cellRef.current).toBeInstanceOf(Gtk.GridLayoutChild);
        expect(cellRef.current).toHaveObjectProperty("column", 3);
        expect(cellRef.current).toHaveObjectProperty("childWidget", labelRef.current);
    });

    it("removes a child when it unmounts", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const { rerender } = await render(<OptionalCellApp gridRef={gridRef} shouldShow={true} />);
        expect(gridRef.current?.getChildAt(0, 0)).not.toBeNull();
        await rerender(<OptionalCellApp gridRef={gridRef} shouldShow={false} />);
        expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
    });
});

describe("render - GtkFixedLayoutChild", () => {
    it("pins a child at a transform", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        await render(
            <GtkFixed ref={fixedRef}>
                <GtkFixedLayoutChild transform={translate(10, 20)}>
                    <GtkLabel>pinned</GtkLabel>
                </GtkFixedLayoutChild>
            </GtkFixed>,
        );

        await expectPositionAt(fixedRef.current as Gtk.Fixed, screen.getByText("pinned"), 10, 20);
    });

    it("repositions in place without reparenting the child", async () => {
        const fixedRef = createRef<Gtk.Fixed>();
        const { rerender } = await render(<AnchoredApp fixedRef={fixedRef} x={0} y={0} />);
        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("anchored");
        const parentNotifications = countParentNotifications(label);
        await rerender(<AnchoredApp fixedRef={fixedRef} x={30} y={40} />);
        await expectPositionAt(fixed, label, 30, 40);
        expect(parentNotifications()).toBe(0);
        expect(label).toHaveObjectProperty("parent", fixed);
    });

    it("clears the transform when the prop is removed", async () => {
        const fixedRef = createRef<Gtk.Fixed>();
        const { rerender } = await render(<ResetTransformApp fixedRef={fixedRef} transform={translate(15, 25)} />);
        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("reset");
        await expectPositionAt(fixed, label, 15, 25);
        await rerender(<ResetTransformApp fixedRef={fixedRef} transform={null} />);

        await waitFor(() => {
            expect(fixed.getChildTransform(label)).toBeNull();
        });

        await expectPositionAt(fixed, label, 0, 0);
    });
});

describe("render - GtkOverlayLayoutChild", () => {
    it("keeps the main child and stacks overlays on top", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const mainRef = createRef<Gtk.Label>();

        await render(
            <GtkOverlay
                ref={overlayRef}
                overlays={[
                    <GtkOverlayLayoutChild key="a" measure>
                        <GtkButton label="Overlay Button" />
                    </GtkOverlayLayoutChild>,
                ]}
            >
                <GtkLabel ref={mainRef}>Main Content</GtkLabel>
            </GtkOverlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Overlay Button" });
        expect(overlay).toHaveObjectProperty("child", mainRef.current);
        expect(overlay.getMeasureOverlay(button)).toBe(true);
        expect(button).toHaveObjectProperty("parent", overlay);
    });

    it("toggles clipOverlay in place", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const { rerender } = await render(<ClippedOverlayApp overlayRef={overlayRef} shouldClip={false} />);
        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Clipped" });
        const addOverlay = vi.spyOn(overlay, "addOverlay");
        expect(overlay.getClipOverlay(button)).toBe(false);
        await rerender(<ClippedOverlayApp overlayRef={overlayRef} shouldClip={true} />);
        expect(overlay.getClipOverlay(button)).toBe(true);
        expect(addOverlay).not.toHaveBeenCalled();
    });

    it("keeps the main child mounted when an overlay appears and disappears", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<TransientOverlayApp labelRef={labelRef} shouldShow={false} />);
        const label = labelRef.current;
        expect(label).not.toBeNull();
        await rerender(<TransientOverlayApp labelRef={labelRef} shouldShow={true} />);
        expect(labelRef.current).toBe(label);
        await rerender(<TransientOverlayApp labelRef={labelRef} shouldShow={false} />);
        expect(labelRef.current).toBe(label);
    });

    it("removes an overlay when it unmounts", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const { rerender } = await render(<RemovableOverlayApp overlayRef={overlayRef} shouldShow={true} />);
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Removable" })).not.toBeNull();
        await rerender(<RemovableOverlayApp overlayRef={overlayRef} shouldShow={false} />);
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Removable" })).toBeNull();
    });
});

describe("render - layoutManager prop wiring", () => {
    it("attaches a GtkBoxLayout to the host widget", async () => {
        const layout = await renderLayoutManager(<GtkBoxLayout orientation={Gtk.Orientation.VERTICAL} spacing={12} />);
        expect(layout).toBeInstanceOf(Gtk.BoxLayout);
        expect(layout).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        expect(layout).toHaveObjectProperty("spacing", 12);
    });

    it("attaches a GtkGridLayout to the host widget", async () => {
        const layout = await renderLayoutManager(<GtkGridLayout columnSpacing={6} rowSpacing={4} />);
        expect(layout).toBeInstanceOf(Gtk.GridLayout);
        expect(layout).toHaveObjectProperty("columnSpacing", 6);
        expect(layout).toHaveObjectProperty("rowSpacing", 4);
    });

    it("attaches a GtkFixedLayout to the host widget", async () => {
        expect(await renderLayoutManager(<GtkFixedLayout />)).toBeInstanceOf(Gtk.FixedLayout);
    });
});

describe("render - layoutManager prop lifecycle", () => {
    it("updates layout manager props through prop diff", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<SpacedBox boxRef={boxRef} spacing={4} />);
        const box = boxRef.current;

        if (box === null) {
            throw new Error("expected the box ref to be assigned");
        }

        expect(box.getLayoutManager()).toHaveObjectProperty("spacing", 4);
        await rerender(<SpacedBox boxRef={boxRef} spacing={20} />);
        expect(box.getLayoutManager()).toHaveObjectProperty("spacing", 20);
    });

    it("clears the layout manager slot when the wrapper element is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<OptionalLayoutBox boxRef={boxRef} shouldShow={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);
        await rerender(<OptionalLayoutBox boxRef={boxRef} shouldShow={false} />);
        expect(boxRef.current?.getLayoutManager()).toBeNull();
    });

    it("replaces an existing layout manager when a new one mounts", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<SwitchableLayoutBox boxRef={boxRef} shouldUseGrid={false} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);
        await rerender(<SwitchableLayoutBox boxRef={boxRef} shouldUseGrid={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.GridLayout);
    });
});

describe("render - AdwMultiLayoutView", () => {
    it("adds every layout declared in the layouts slot", async () => {
        const { view } = await renderView("wide");
        expect(view.getLayoutByName("wide")).not.toBeNull();
        expect(view.getLayoutByName("narrow")).not.toBeNull();
    });

    it("fills each AdwLayout with the content declared as its children", async () => {
        const { view } = await renderView("wide");

        expect(view.getLayoutByName("wide")?.getContent())
            .toHaveObjectProperty("orientation", Gtk.Orientation.HORIZONTAL);

        expect(view.getLayoutByName("narrow")?.getContent())
            .toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
    });

    it("places named slot children through the view", async () => {
        const { view } = await renderView("wide");
        expect(view.getChild("sidebar")).toHaveTextContent(/^Side$/);
        expect(view.getChild("content")).toHaveTextContent(/^Main$/);
        expect(await screen.findByText("Side")).toAppearBefore(screen.getByText("Main"));
    });

    it("applies layoutName once the named layout has attached", async () => {
        const { view } = await renderView("narrow");
        expect(view.getLayoutName()).toBe("narrow");
        expect(view.getLayout()).toBe(view.getLayoutByName("narrow"));
    });

    it("switches layout when layoutName changes", async () => {
        const { view, rerender } = await renderView("wide");
        expect(view.getLayoutName()).toBe("wide");
        await rerender("narrow");
        expect(view.getLayoutName()).toBe("narrow");
    });

    it("takes a slot child back out of the view when its prop is dropped", async () => {
        const ref = createRef<Adw.MultiLayoutView>();
        const sidebar = <GtkLabel>Side</GtkLabel>;

        const { rerender } = await render(
            <AdwMultiLayoutView ref={ref} layoutName="wide" layouts={LAYOUTS} sidebarSlot={sidebar} />,
        );

        expect(await screen.findByText("Side")).toBeRooted();
        await rerender(<AdwMultiLayoutView ref={ref} layoutName="wide" layouts={LAYOUTS} />);
        expect(screen.queryByText("Side")).toBeNull();
    });
});

describe("render - SizeGroup widgets", () => {
    it("stretches every member to the widest member's natural size", async () => {
        await expectGroupOfTwoIsWide();
    });

    it("stops sharing size with a widget once it leaves the group", async () => {
        const { rerender } = await expectGroupOfTwoIsWide();
        await rerender(<GroupedLabels count={1} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(NARROW_WIDTH);
    });

    it("clears membership when the group empties", async () => {
        const { rerender } = await expectGroupOfTwoIsWide();
        await rerender(<GroupedLabels count={0} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        await rerender(<GroupedLabels count={1} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(NARROW_WIDTH);
    });

    it("groups widgets living in separate containers", async () => {
        await expectGroupedWide(<FramedLabels />);
        expect(screen.getByLabelText(/Frame A/)).toContainOneByText("A");
        expect(screen.getByLabelText(/Frame B/)).toContainOneByText("B");
    });
});

describe("render - SizeGroup mode", () => {
    it("applies and updates the mode prop", async () => {
        const { rerender } = await render(<SizedLabels mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
        expect(naturalHeight(screen.getByText("A"))).toBe(TALL_HEIGHT);
        expect(naturalHeight(screen.getByText("B"))).not.toBe(naturalHeight(screen.getByText("A")));
        await rerender(<SizedLabels mode={Gtk.SizeGroupMode.BOTH} />);
        expect(naturalHeight(screen.getByText("A"))).toBe(TALL_HEIGHT);
        expect(naturalHeight(screen.getByText("B"))).toBe(TALL_HEIGHT);
    });
});
