import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkLabel, GtkOverlay } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Overlay", () => {
    describe("main child", () => {
        it("sets first child as main child via setChild", async () => {
            const overlayRef = createRef<Gtk.Overlay>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkOverlay ref={overlayRef}>
                    <GtkLabel ref={labelRef} label="Main Child" />
                </GtkOverlay>,
                { wrapper: false },
            );

            expect(overlayRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
        });

        it("clears main child on removal", async () => {
            const overlayRef = createRef<Gtk.Overlay>();

            function App({ showMain }: { showMain: boolean }) {
                return <GtkOverlay ref={overlayRef}>{showMain && "Main"}</GtkOverlay>;
            }

            await render(<App showMain={true} />, { wrapper: false });

            expect(overlayRef.current?.getChild()).not.toBeNull();

            await render(<App showMain={false} />, { wrapper: false });

            expect(overlayRef.current?.getChild()).toBeNull();
        });
    });

    describe("overlay children", () => {
        it("adds subsequent children as overlays", async () => {
            const overlayRef = createRef<Gtk.Overlay>();
            const mainRef = createRef<Gtk.Label>();
            const overlay1Ref = createRef<Gtk.Button>();
            const overlay2Ref = createRef<Gtk.Button>();

            await render(
                <GtkOverlay ref={overlayRef}>
                    <GtkLabel ref={mainRef} label="Main" />
                    <GtkButton ref={overlay1Ref} label="Overlay 1" />
                    <GtkButton ref={overlay2Ref} label="Overlay 2" />
                </GtkOverlay>,
                { wrapper: false },
            );

            expect(overlayRef.current?.getChild()?.id).toEqual(mainRef.current?.id);
            expect(overlay1Ref.current?.getParent()?.id).toEqual(overlayRef.current?.id);
            expect(overlay2Ref.current?.getParent()?.id).toEqual(overlayRef.current?.id);
        });

        it("removes overlay children", async () => {
            const overlayRef = createRef<Gtk.Overlay>();

            function App({ overlays }: { overlays: string[] }) {
                return (
                    <GtkOverlay ref={overlayRef}>
                        Main
                        {overlays.map((label) => (
                            <GtkButton key={label} label={label} />
                        ))}
                    </GtkOverlay>
                );
            }

            await render(<App overlays={["A", "B", "C"]} />, { wrapper: false });

            await render(<App overlays={["A", "C"]} />, { wrapper: false });
        });
    });

    describe("ordering", () => {
        it("inserts before main child becomes overlay", async () => {
            const overlayRef = createRef<Gtk.Overlay>();
            const buttonRef = createRef<Gtk.Button>();
            const labelRef = createRef<Gtk.Label>();

            function App({ insertFirst }: { insertFirst: boolean }) {
                return (
                    <GtkOverlay ref={overlayRef}>
                        {insertFirst && <GtkButton ref={buttonRef} key="button" label="Inserted" />}
                        <GtkLabel ref={labelRef} key="label" label="Original Main" />
                    </GtkOverlay>
                );
            }

            await render(<App insertFirst={false} />, { wrapper: false });

            expect(overlayRef.current?.getChild()?.id).toEqual(labelRef.current?.id);

            await render(<App insertFirst={true} />, { wrapper: false });
        });

        it("inserts before overlay at correct position", async () => {
            const overlayRef = createRef<Gtk.Overlay>();

            function App({ overlays }: { overlays: string[] }) {
                return (
                    <GtkOverlay ref={overlayRef}>
                        Main
                        {overlays.map((label) => (
                            <GtkButton key={label} label={label} />
                        ))}
                    </GtkOverlay>
                );
            }

            await render(<App overlays={["First", "Last"]} />, { wrapper: false });

            await render(<App overlays={["First", "Middle", "Last"]} />, { wrapper: false });
        });
    });
});
