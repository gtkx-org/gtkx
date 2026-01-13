import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScale, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Scale", () => {
    describe("ScaleNode", () => {
        it("creates Scale widget without marks", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(<GtkScale ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("creates Scale widget with marks", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(
                <GtkScale ref={ref}>
                    <x.ScaleMark value={0} label="Min" />
                    <x.ScaleMark value={50} label="Mid" />
                    <x.ScaleMark value={100} label="Max" />
                </GtkScale>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("sets mark position", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(
                <GtkScale ref={ref}>
                    <x.ScaleMark value={0} position={Gtk.PositionType.TOP} label="Top" />
                    <x.ScaleMark value={100} position={Gtk.PositionType.BOTTOM} label="Bottom" />
                </GtkScale>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("sets marks without labels", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(
                <GtkScale ref={ref}>
                    <x.ScaleMark value={0} />
                    <x.ScaleMark value={25} />
                    <x.ScaleMark value={50} />
                    <x.ScaleMark value={75} />
                    <x.ScaleMark value={100} />
                </GtkScale>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("updates marks when props change", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ label }: { label: string }) {
                return (
                    <GtkScale ref={ref}>
                        <x.ScaleMark value={0} label={label} />
                        <x.ScaleMark value={100} label="End" />
                    </GtkScale>
                );
            }

            await render(<App label="Start" />);
            expect(ref.current).not.toBeNull();

            await render(<App label="Begin" />);
            expect(ref.current).not.toBeNull();
        });

        it("removes marks when unmounted", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ showExtra }: { showExtra: boolean }) {
                return (
                    <GtkScale ref={ref}>
                        <x.ScaleMark value={0} label="Min" />
                        {showExtra && <x.ScaleMark value={50} label="Mid" />}
                        <x.ScaleMark value={100} label="Max" />
                    </GtkScale>
                );
            }

            await render(<App showExtra={true} />);
            expect(ref.current).not.toBeNull();

            await render(<App showExtra={false} />);
            expect(ref.current).not.toBeNull();
        });

        it("handles inserting marks in the middle", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ showMid }: { showMid: boolean }) {
                return (
                    <GtkScale ref={ref}>
                        <x.ScaleMark value={0} label="Min" />
                        {showMid && <x.ScaleMark value={50} label="Mid" />}
                        <x.ScaleMark value={100} label="Max" />
                    </GtkScale>
                );
            }

            await render(<App showMid={false} />);
            expect(ref.current).not.toBeNull();

            await render(<App showMid={true} />);
            expect(ref.current).not.toBeNull();
        });
    });
});
