import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScale } from "@gtkx/react";
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
                <GtkScale
                    ref={ref}
                    marks={[
                        { value: 0, label: "Min" },
                        { value: 50, label: "Mid" },
                        { value: 100, label: "Max" },
                    ]}
                />,
            );

            expect(ref.current).not.toBeNull();
        });

        it("sets mark position", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(
                <GtkScale
                    ref={ref}
                    marks={[
                        { value: 0, position: Gtk.PositionType.TOP, label: "Top" },
                        { value: 100, position: Gtk.PositionType.BOTTOM, label: "Bottom" },
                    ]}
                />,
            );

            expect(ref.current).not.toBeNull();
        });

        it("sets marks without labels", async () => {
            const ref = createRef<Gtk.Scale>();

            await render(
                <GtkScale
                    ref={ref}
                    marks={[{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }]}
                />,
            );

            expect(ref.current).not.toBeNull();
        });

        it("updates marks when props change", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ label }: { label: string }) {
                return (
                    <GtkScale
                        ref={ref}
                        marks={[
                            { value: 0, label },
                            { value: 100, label: "End" },
                        ]}
                    />
                );
            }

            await render(<App label="Start" />);
            expect(ref.current).not.toBeNull();

            await render(<App label="Begin" />);
            expect(ref.current).not.toBeNull();
        });

        it("removes marks when array changes", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ showExtra }: { showExtra: boolean }) {
                const marks = showExtra
                    ? [
                          { value: 0, label: "Min" },
                          { value: 50, label: "Mid" },
                          { value: 100, label: "Max" },
                      ]
                    : [
                          { value: 0, label: "Min" },
                          { value: 100, label: "Max" },
                      ];
                return <GtkScale ref={ref} marks={marks} />;
            }

            await render(<App showExtra={true} />);
            expect(ref.current).not.toBeNull();

            await render(<App showExtra={false} />);
            expect(ref.current).not.toBeNull();
        });

        it("handles inserting marks in the middle", async () => {
            const ref = createRef<Gtk.Scale>();

            function App({ showMid }: { showMid: boolean }) {
                const marks = showMid
                    ? [
                          { value: 0, label: "Min" },
                          { value: 50, label: "Mid" },
                          { value: 100, label: "Max" },
                      ]
                    : [
                          { value: 0, label: "Min" },
                          { value: 100, label: "Max" },
                      ];
                return <GtkScale ref={ref} marks={marks} />;
            }

            await render(<App showMid={false} />);
            expect(ref.current).not.toBeNull();

            await render(<App showMid={true} />);
            expect(ref.current).not.toBeNull();
        });
    });
});
