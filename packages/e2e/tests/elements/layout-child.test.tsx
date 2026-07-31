import type { RefObject } from "react";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkButton,
    GtkFixed,
    GtkFixedLayoutChild,
    GtkGrid,
    GtkGridLayoutChild,
    GtkLabel,
    GtkOverlay,
    GtkOverlayLayoutChild,
} from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const translate = (x: number, y: number): Gsk.Transform | null =>
    Gsk.Transform.new().translate(Graphene.Point.create(x, y));

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

function OptionalCellApp({ gridRef, show }: { gridRef: RefObject<Gtk.Grid | null>; show: boolean }) {
    return (
        <GtkGrid ref={gridRef}>
            {show && (
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

function ClippedOverlayApp({ overlayRef, clip }: { overlayRef: RefObject<Gtk.Overlay | null>; clip: boolean }) {
    return (
        <GtkOverlay
            ref={overlayRef}
            overlays={[
                <GtkOverlayLayoutChild key="a" clipOverlay={clip}>
                    <GtkButton label="Clipped" />
                </GtkOverlayLayoutChild>,
            ]}
        >
            <GtkLabel>Main</GtkLabel>
        </GtkOverlay>
    );
}

function TransientOverlayApp({ labelRef, show }: { labelRef: RefObject<Gtk.Label | null>; show: boolean }) {
    return (
        <GtkOverlay
            overlays={
                show && (
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

function RemovableOverlayApp({ overlayRef, show }: { overlayRef: RefObject<Gtk.Overlay | null>; show: boolean }) {
    return (
        <GtkOverlay
            ref={overlayRef}
            overlays={
                show
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

describe("render - GtkGridLayoutChild (1)", () => {
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
        expect(grid.getChildAt(0, 0)).toHaveObjectProperty("label", "A");
        expect(grid.getChildAt(1, 1)).toHaveObjectProperty("label", "B");
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
        expect(label).toHaveObjectProperty("label", "wide");
        expect(grid.getChildAt(1, 1)).toBe(label);
    });
});

describe("render - GtkGridLayoutChild (2)", () => {
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
        const { rerender } = await render(<OptionalCellApp gridRef={gridRef} show={true} />);
        expect(gridRef.current?.getChildAt(0, 0)).not.toBeNull();
        await rerender(<OptionalCellApp gridRef={gridRef} show={false} />);
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

describe("render - GtkOverlayLayoutChild (1)", () => {
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
        const { rerender } = await render(<ClippedOverlayApp overlayRef={overlayRef} clip={false} />);
        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Clipped" });
        const addOverlay = vi.spyOn(overlay, "addOverlay");
        expect(overlay.getClipOverlay(button)).toBe(false);
        await rerender(<ClippedOverlayApp overlayRef={overlayRef} clip={true} />);
        expect(overlay.getClipOverlay(button)).toBe(true);
        expect(addOverlay).not.toHaveBeenCalled();
    });
});

describe("render - GtkOverlayLayoutChild (2)", () => {
    it("keeps the main child mounted when an overlay appears and disappears", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<TransientOverlayApp labelRef={labelRef} show={false} />);
        const label = labelRef.current;
        expect(label).not.toBeNull();
        await rerender(<TransientOverlayApp labelRef={labelRef} show={true} />);
        expect(labelRef.current).toBe(label);
        await rerender(<TransientOverlayApp labelRef={labelRef} show={false} />);
        expect(labelRef.current).toBe(label);
    });

    it("removes an overlay when it unmounts", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const { rerender } = await render(<RemovableOverlayApp overlayRef={overlayRef} show={true} />);
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Removable" })).not.toBeNull();
        await rerender(<RemovableOverlayApp overlayRef={overlayRef} show={false} />);
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Removable" })).toBeNull();
    });
});
