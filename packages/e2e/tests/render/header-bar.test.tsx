import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { AdwHeaderBar, GtkButton, GtkHeaderBar, GtkLabel, Slot } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - HeaderBar", () => {
    describe("GtkHeaderBar", () => {
        it("creates HeaderBar widget", async () => {
            const ref = createRef<Gtk.HeaderBar>();

            await render(<GtkHeaderBar ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("Slot titleWidget", () => {
        it("sets custom title widget", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <Slot for={GtkHeaderBar} id="titleWidget">
                        <GtkLabel ref={labelRef} label="Custom Title" />
                    </Slot>
                </GtkHeaderBar>,
                { wrapper: false },
            );

            expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(labelRef.current?.id);
        });

        it("clears title widget when removed", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showTitle }: { showTitle: boolean }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        {showTitle && (
                            <Slot for={GtkHeaderBar} id="titleWidget">
                                <GtkLabel label="Title" />
                            </Slot>
                        )}
                    </GtkHeaderBar>
                );
            }

            await render(<App showTitle={true} />, { wrapper: false });

            expect(headerBarRef.current?.getTitleWidget()).not.toBeNull();

            await render(<App showTitle={false} />, { wrapper: false });

            expect(headerBarRef.current?.getTitleWidget()).toBeNull();
        });
    });

    describe("direct children", () => {
        it("packs direct children", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkButton ref={buttonRef} label="Direct Child" />
                </GtkHeaderBar>,
                { wrapper: false },
            );

            expect(buttonRef.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
        });

        it("adds multiple direct children", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const button1Ref = createRef<Gtk.Button>();
            const button2Ref = createRef<Gtk.Button>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkButton ref={button1Ref} label="Button 1" />
                    <GtkButton ref={button2Ref} label="Button 2" />
                </GtkHeaderBar>,
                { wrapper: false },
            );

            expect(button1Ref.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
            expect(button2Ref.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
        });
    });

    describe("removal", () => {
        it("removes direct children", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showButton }: { showButton: boolean }) {
                return <GtkHeaderBar ref={headerBarRef}>{showButton && <GtkButton label="Removable" />}</GtkHeaderBar>;
            }

            await render(<App showButton={true} />, { wrapper: false });

            expect(headerBarRef.current?.getFirstChild()).not.toBeNull();

            await render(<App showButton={false} />, { wrapper: false });
        });
    });

    describe("AdwHeaderBar", () => {
        it("creates Adw.HeaderBar", async () => {
            const ref = createRef<Adw.HeaderBar>();

            await render(<AdwHeaderBar ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("supports AdwHeaderBar.TitleWidget", async () => {
            const headerBarRef = createRef<Adw.HeaderBar>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <AdwHeaderBar ref={headerBarRef}>
                    <Slot for={AdwHeaderBar} id="titleWidget">
                        <GtkLabel ref={labelRef} label="Adw Title" />
                    </Slot>
                </AdwHeaderBar>,
                { wrapper: false },
            );

            expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(labelRef.current?.id);
        });

        it("packs direct children", async () => {
            const headerBarRef = createRef<Adw.HeaderBar>();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <AdwHeaderBar ref={headerBarRef}>
                    <GtkButton ref={buttonRef} label="Child" />
                </AdwHeaderBar>,
                { wrapper: false },
            );

            expect(buttonRef.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
        });
    });
});
