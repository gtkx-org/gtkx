import { Fixed } from "@gtkx/components";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const expectBoundsAt = (widget: Gtk.Widget, fixed: Gtk.Fixed, x: number, y: number): Promise<void> =>
    waitFor(() => {
        const [computed, bounds] = widget.computeBounds(fixed);
        expect(computed).toBe(true);
        expect([bounds.getX(), bounds.getY()]).toEqual([x, y]);
    });

describe("render - Fixed", () => {
    it("pins children at their coordinates", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        await render(
            <Fixed ref={fixedRef}>
                <Fixed.Child component={GtkLabel} x={10} y={20}>
                    pinned
                </Fixed.Child>
            </Fixed>,
        );

        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("pinned");
        await waitFor(() => {
            expect(fixed.getChildPosition(label)).toEqual([10, 20]);
        });
    });

    it("applies an arbitrary transform", async () => {
        const fixedRef = createRef<Gtk.Fixed>();
        const transform = Gsk.Transform.new().translate(Graphene.Point.create(15, 25));

        await render(
            <Fixed ref={fixedRef}>
                <Fixed.Child component={GtkLabel} transform={transform}>
                    transformed
                </Fixed.Child>
            </Fixed>,
        );

        const fixed = fixedRef.current as Gtk.Fixed;
        const label = screen.getByText("transformed");
        expect(fixed.getChildTransform(label)).not.toBeNull();
    });

    it("moves a child when its coordinates change", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        function App({ x, y }: { x: number; y: number }) {
            return (
                <Fixed ref={fixedRef}>
                    <Fixed.Child component={GtkLabel} x={x} y={y}>
                        movable
                    </Fixed.Child>
                </Fixed>
            );
        }

        const { rerender } = await render(<App x={0} y={0} />);
        const label = screen.getByText("movable");
        await waitFor(() => {
            expect(fixedRef.current?.getChildPosition(label)).toEqual([0, 0]);
        });

        await rerender(<App x={30} y={40} />);
        await waitFor(() => {
            expect(fixedRef.current?.getChildPosition(label)).toEqual([30, 40]);
        });
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
        const label = placedRef.current as Gtk.Widget;
        await waitFor(() => {
            expect(fixedRef.current?.getChildPosition(label)).toEqual([30, 40]);
        });

        await rerender(<App component={GtkButton} />);
        const button = placedRef.current as Gtk.Widget;
        expect(button).not.toBe(label);
        const fixed = fixedRef.current as Gtk.Fixed;
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
        await waitFor(() => {
            expect(fixed.getChildPosition(label)).toEqual([30, 40]);
        });

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
