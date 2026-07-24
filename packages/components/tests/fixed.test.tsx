import { Fixed } from "@gtkx/components";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type Placement = {
    x?: number | undefined;
    y?: number | undefined;
    transform?: Gsk.Transform | null | undefined;
};

const expectBoundsAt = (widget: Gtk.Widget, fixed: Gtk.Fixed, x: number, y: number): Promise<void> =>
    waitFor(() => {
        const [computed, bounds] = widget.computeBounds(fixed);
        expect(computed).toBe(true);
        expect([bounds.getX(), bounds.getY()]).toEqual([x, y]);
    });

const expectPositionAt = (fixed: Gtk.Fixed, widget: Gtk.Widget, x: number, y: number): Promise<void> =>
    waitFor(() => {
        expect(fixed.getChildPosition(widget)).toEqual([x, y]);
    });

const makeTranslateTransform = (): Gsk.Transform | null => Gsk.Transform.new().translate(Graphene.Point.create(15, 25));

const renderPlacedChild = async (text: string, placement: Placement) => {
    const fixedRef = createRef<Gtk.Fixed>();

    function App(props: Placement) {
        return (
            <Fixed ref={fixedRef}>
                <Fixed.Child component={GtkLabel} {...props}>
                    {text}
                </Fixed.Child>
            </Fixed>
        );
    }

    const { rerender } = await render(<App {...placement} />);
    const fixed = fixedRef.current as Gtk.Fixed;
    const label = screen.getByText(text);
    const place = (next: Placement): Promise<void> => rerender(<App {...next} />);
    return { fixed, label, place };
};

describe("render - Fixed", () => {
    it("pins children at their coordinates", async () => {
        const { fixed, label } = await renderPlacedChild("pinned", { x: 10, y: 20 });

        await expectPositionAt(fixed, label, 10, 20);
    });

    it("applies an arbitrary transform", async () => {
        const { fixed, label } = await renderPlacedChild("transformed", { transform: makeTranslateTransform() });

        expect(fixed.getChildTransform(label)).not.toBeNull();
    });

    it("moves a child when its coordinates change", async () => {
        const { fixed, label, place } = await renderPlacedChild("movable", { x: 0, y: 0 });
        await expectPositionAt(fixed, label, 0, 0);

        await place({ x: 30, y: 40 });
        await expectPositionAt(fixed, label, 30, 40);
    });

    it("repositions in place without reparenting the child", async () => {
        const { fixed, label, place } = await renderPlacedChild("anchored", { x: 0, y: 0 });
        let parentNotifications = 0;
        label.connect("notify::parent", () => {
            parentNotifications += 1;
        });

        await place({ x: 30, y: 40 });
        await expectPositionAt(fixed, label, 30, 40);
        expect(parentNotifications).toBe(0);
        expect(label.getParent()).toBe(fixed);
    });

    it("clears the transform and falls back to coordinates when the transform prop is removed", async () => {
        const { fixed, label, place } = await renderPlacedChild("untransformed", {
            x: 30,
            y: 40,
            transform: makeTranslateTransform(),
        });
        await expectPositionAt(fixed, label, 15, 25);

        await place({ x: 30, y: 40, transform: null });
        await expectPositionAt(fixed, label, 30, 40);
        await expectBoundsAt(label, fixed, 30, 40);
    });

    it("leaves no residual transform when the transform prop is removed at the origin", async () => {
        const { fixed, label, place } = await renderPlacedChild("reset", {
            x: 0,
            y: 0,
            transform: makeTranslateTransform(),
        });
        expect(fixed.getChildTransform(label)).not.toBeNull();

        await place({ x: 0, y: 0, transform: null });
        await waitFor(() => {
            expect(fixed.getChildTransform(label)).toBeNull();
        });
        await expectPositionAt(fixed, label, 0, 0);
    });

    it("places the replacement widget when the component prop swaps", async () => {
        const fixedRef = createRef<Gtk.Fixed>();
        const placedRef: { current: Gtk.Widget | null } = { current: null };
        const capturePlaced = (widget: Gtk.Widget | null): void => {
            placedRef.current = widget;
        };

        function App({ component }: { component: typeof GtkLabel | typeof GtkButton }) {
            return (
                <Fixed ref={fixedRef}>
                    <Fixed.Child component={component} ref={capturePlaced} x={30} y={40} label="swapped" />
                </Fixed>
            );
        }

        const { rerender } = await render(<App component={GtkLabel} />);
        const fixed = fixedRef.current as Gtk.Fixed;
        const label = placedRef.current as Gtk.Widget;
        await expectPositionAt(fixed, label, 30, 40);

        await rerender(<App component={GtkButton} />);
        const button = placedRef.current as Gtk.Widget;
        expect(button).not.toBe(label);
        expect(button.getParent()).toBe(fixed);
        await expectBoundsAt(button, fixed, 30, 40);
    });

    it("keeps an existing child's placement when a new child mounts before it", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        function App({ prepend }: { prepend: boolean }) {
            return (
                <Fixed ref={fixedRef}>
                    {prepend && (
                        <Fixed.Child key="prepended" component={GtkLabel} x={5} y={5}>
                            prepended
                        </Fixed.Child>
                    )}
                    <Fixed.Child key="existing" component={GtkLabel} x={30} y={40}>
                        existing
                    </Fixed.Child>
                </Fixed>
            );
        }

        const { rerender } = await render(<App prepend={false} />);
        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("existing");
        await expectPositionAt(fixed, label, 30, 40);

        await rerender(<App prepend={true} />);
        expect(screen.queryByText("prepended")).not.toBeNull();
        await expectBoundsAt(label, fixed, 30, 40);
    });

    it("removes a child when it unmounts", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        function App({ show }: { show: boolean }) {
            return (
                <Fixed ref={fixedRef}>
                    {show && (
                        <Fixed.Child component={GtkLabel} x={0} y={0}>
                            A
                        </Fixed.Child>
                    )}
                </Fixed>
            );
        }

        const { rerender } = await render(<App show={true} />);
        expect(screen.queryByText("A")).not.toBeNull();

        await rerender(<App show={false} />);
        expect(screen.queryByText("A")).toBeNull();
    });
});
