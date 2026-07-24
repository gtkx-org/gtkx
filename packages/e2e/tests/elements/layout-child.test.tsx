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
        expect(grid.getColumnSpacing()).toBe(6);
        expect((grid.getChildAt(0, 0) as Gtk.Label).getLabel()).toBe("A");
        expect((grid.getChildAt(1, 1) as Gtk.Label).getLabel()).toBe("B");
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
        expect(label.getLabel()).toBe("wide");
        expect(grid.getChildAt(1, 1)).toBe(label);
    });

    it("moves a child in place when its cell changes", async () => {
        const gridRef = createRef<Gtk.Grid>();

        function App({ column }: { column: number }) {
            return (
                <GtkGrid ref={gridRef}>
                    <GtkGridLayoutChild column={column} row={0}>
                        <GtkLabel>movable</GtkLabel>
                    </GtkGridLayoutChild>
                </GtkGrid>
            );
        }

        const { rerender } = await render(<App column={0} />);
        const label = gridRef.current?.getChildAt(0, 0) as Gtk.Widget;
        let parentNotifications = 0;
        label.connect("notify::parent", () => {
            parentNotifications += 1;
        });

        await rerender(<App column={2} />);
        expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
        expect(gridRef.current?.getChildAt(2, 0)).toBe(label);
        expect(parentNotifications).toBe(0);
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
        expect(cellRef.current?.getColumn()).toBe(3);
        expect(cellRef.current?.getChildWidget()).toBe(labelRef.current);
    });

    it("removes a child when it unmounts", async () => {
        const gridRef = createRef<Gtk.Grid>();

        function App({ show }: { show: boolean }) {
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

        const { rerender } = await render(<App show={true} />);
        expect(gridRef.current?.getChildAt(0, 0)).not.toBeNull();

        await rerender(<App show={false} />);
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

        function App({ x, y }: { x: number; y: number }) {
            return (
                <GtkFixed ref={fixedRef}>
                    <GtkFixedLayoutChild transform={translate(x, y)}>
                        <GtkLabel>anchored</GtkLabel>
                    </GtkFixedLayoutChild>
                </GtkFixed>
            );
        }

        const { rerender } = await render(<App x={0} y={0} />);
        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("anchored");
        let parentNotifications = 0;
        label.connect("notify::parent", () => {
            parentNotifications += 1;
        });

        await rerender(<App x={30} y={40} />);
        await expectPositionAt(fixed, label, 30, 40);
        expect(parentNotifications).toBe(0);
        expect(label.getParent()).toBe(fixed);
    });

    it("clears the transform when the prop is removed", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        function App({ transform }: { transform: Gsk.Transform | null }) {
            return (
                <GtkFixed ref={fixedRef}>
                    <GtkFixedLayoutChild transform={transform}>
                        <GtkLabel>reset</GtkLabel>
                    </GtkFixedLayoutChild>
                </GtkFixed>
            );
        }

        const { rerender } = await render(<App transform={translate(15, 25)} />);
        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("reset");
        await expectPositionAt(fixed, label, 15, 25);

        await rerender(<App transform={null} />);
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
        expect(overlay.getChild()).toBe(mainRef.current);
        expect(overlay.getMeasureOverlay(button)).toBe(true);
        expect(button.getParent()).toBe(overlay);
    });

    it("toggles clipOverlay in place", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        function App({ clip }: { clip: boolean }) {
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

        const { rerender } = await render(<App clip={false} />);
        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Clipped" });
        const addOverlay = vi.spyOn(overlay, "addOverlay");
        expect(overlay.getClipOverlay(button)).toBe(false);

        await rerender(<App clip={true} />);
        expect(overlay.getClipOverlay(button)).toBe(true);
        expect(addOverlay).not.toHaveBeenCalled();
    });

    it("keeps the main child mounted when an overlay appears and disappears", async () => {
        const labelRef = createRef<Gtk.Label>();

        function App({ show }: { show: boolean }) {
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

        const { rerender } = await render(<App show={false} />);
        const label = labelRef.current;
        expect(label).not.toBeNull();

        await rerender(<App show={true} />);
        expect(labelRef.current).toBe(label);

        await rerender(<App show={false} />);
        expect(labelRef.current).toBe(label);
    });

    it("removes an overlay when it unmounts", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        function App({ show }: { show: boolean }) {
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

        const { rerender } = await render(<App show={true} />);
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Removable" })).not.toBeNull();

        await rerender(<App show={false} />);
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Removable" })).toBeNull();
    });
});
