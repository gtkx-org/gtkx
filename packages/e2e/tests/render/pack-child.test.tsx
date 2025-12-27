import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkHeaderBar, GtkLabel, Pack, Slot } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - PackChild", () => {
    describe("PackChild (Pack.Start/Pack.End)", () => {
        it("packs child at start via Pack.Start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            const { findByText } = await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <Pack.Start>Start</Pack.Start>
                </GtkHeaderBar>,
            );

            expect(await findByText("Start")).toBeDefined();
        });

        it("packs child at end via Pack.End", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            const { findByText } = await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <Pack.End>End</Pack.End>
                </GtkHeaderBar>,
            );

            expect(await findByText("End")).toBeDefined();
        });

        it("combines Pack.Start and Pack.End", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            const { findByText } = await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <Pack.Start>Start</Pack.Start>
                    <Pack.End>End</Pack.End>
                </GtkHeaderBar>,
            );

            expect(await findByText("Start")).toBeDefined();
            expect(await findByText("End")).toBeDefined();
        });

        it("removes packed child", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showStart }: { showStart: boolean }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        {showStart && <Pack.Start>Start</Pack.Start>}
                        <Slot for={GtkHeaderBar} id="titleWidget">
                            Always
                        </Slot>
                    </GtkHeaderBar>
                );
            }

            const { findByText, rerender } = await render(<App showStart={true} />);

            expect(await findByText("Start")).toBeDefined();
            expect(await findByText("Always")).toBeDefined();

            await rerender(<App showStart={false} />);

            await expect(findByText("Start")).rejects.toThrow();
            expect(await findByText("Always")).toBeDefined();
        });

        it("packs multiple children at start via Pack.Start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            const { findByText } = await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <Pack.Start>
                        <GtkLabel label="First" />
                        <GtkLabel label="Second" />
                    </Pack.Start>
                </GtkHeaderBar>,
            );

            expect(await findByText("First")).toBeDefined();
            expect(await findByText("Second")).toBeDefined();
        });

        it("packs multiple children at end via Pack.End", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            const { findByText } = await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <Pack.End>
                        <GtkLabel label="First" />
                        <GtkLabel label="Second" />
                    </Pack.End>
                </GtkHeaderBar>,
            );

            expect(await findByText("First")).toBeDefined();
            expect(await findByText("Second")).toBeDefined();
        });

        it("removes individual children from Pack.Start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showSecond }: { showSecond: boolean }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        <Pack.Start>
                            <GtkLabel label="First" />
                            {showSecond && <GtkLabel label="Second" />}
                        </Pack.Start>
                    </GtkHeaderBar>
                );
            }

            const { findByText, rerender } = await render(<App showSecond={true} />);

            expect(await findByText("First")).toBeDefined();
            expect(await findByText("Second")).toBeDefined();

            await rerender(<App showSecond={false} />);

            expect(await findByText("First")).toBeDefined();
            await expect(findByText("Second")).rejects.toThrow();
        });
    });
});
