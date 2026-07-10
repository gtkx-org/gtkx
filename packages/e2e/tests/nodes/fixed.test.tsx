import { Fixed } from "@gtkx/components";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Fixed", () => {
    it("pins children at their coordinates", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        await render(
            <Fixed ref={fixedRef}>
                <Fixed.Child x={10} y={20}>
                    {(ref) => <GtkLabel ref={ref} label="pinned" />}
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
                <Fixed.Child transform={transform}>{(ref) => <GtkLabel ref={ref} label="transformed" />}</Fixed.Child>
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
                    <Fixed.Child x={x} y={y}>
                        {(ref) => <GtkLabel ref={ref} label="movable" />}
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

    it("removes a child when it unmounts", async () => {
        const fixedRef = createRef<Gtk.Fixed>();

        function App({ show }: { show: boolean }) {
            return (
                <Fixed ref={fixedRef}>
                    {show && (
                        <Fixed.Child x={0} y={0}>
                            {(ref) => <GtkLabel ref={ref} label="A" />}
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
