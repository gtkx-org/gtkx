import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { AdwHeaderBar, GtkButton, GtkHeaderBar, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - HeaderBar", () => {
    describe("HeaderBar.Root", () => {
        it("creates HeaderBar widget", async () => {
            const ref = createRef<Gtk.HeaderBar>();

            await render(<GtkHeaderBar.Root ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("HeaderBar.TitleWidget", () => {
        it("sets custom title widget", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar.Root ref={headerBarRef}>
                    <GtkHeaderBar.TitleWidget>
                        <GtkLabel ref={labelRef} label="Custom Title" />
                    </GtkHeaderBar.TitleWidget>
                </GtkHeaderBar.Root>,
                { wrapper: false },
            );

            expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(labelRef.current?.id);
        });

        it("clears title widget when removed", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showTitle }: { showTitle: boolean }) {
                return (
                    <GtkHeaderBar.Root ref={headerBarRef}>
                        {showTitle && (
                            <GtkHeaderBar.TitleWidget>
                                <GtkLabel label="Title" />
                            </GtkHeaderBar.TitleWidget>
                        )}
                    </GtkHeaderBar.Root>
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
                <GtkHeaderBar.Root ref={headerBarRef}>
                    <GtkButton ref={buttonRef} label="Direct Child" />
                </GtkHeaderBar.Root>,
                { wrapper: false },
            );

            expect(buttonRef.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
        });

        it("adds multiple direct children", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const button1Ref = createRef<Gtk.Button>();
            const button2Ref = createRef<Gtk.Button>();

            await render(
                <GtkHeaderBar.Root ref={headerBarRef}>
                    <GtkButton ref={button1Ref} label="Button 1" />
                    <GtkButton ref={button2Ref} label="Button 2" />
                </GtkHeaderBar.Root>,
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
                return (
                    <GtkHeaderBar.Root ref={headerBarRef}>
                        {showButton && <GtkButton label="Removable" />}
                    </GtkHeaderBar.Root>
                );
            }

            await render(<App showButton={true} />, { wrapper: false });

            expect(headerBarRef.current?.getFirstChild()).not.toBeNull();

            await render(<App showButton={false} />, { wrapper: false });
        });
    });

    describe("AdwHeaderBar", () => {
        it("creates Adw.HeaderBar", async () => {
            const ref = createRef<Adw.HeaderBar>();

            await render(<AdwHeaderBar.Root ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("supports AdwHeaderBar.TitleWidget", async () => {
            const headerBarRef = createRef<Adw.HeaderBar>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <AdwHeaderBar.Root ref={headerBarRef}>
                    <AdwHeaderBar.TitleWidget>
                        <GtkLabel ref={labelRef} label="Adw Title" />
                    </AdwHeaderBar.TitleWidget>
                </AdwHeaderBar.Root>,
                { wrapper: false },
            );

            expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(labelRef.current?.id);
        });

        it("packs direct children", async () => {
            const headerBarRef = createRef<Adw.HeaderBar>();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <AdwHeaderBar.Root ref={headerBarRef}>
                    <GtkButton ref={buttonRef} label="Child" />
                </AdwHeaderBar.Root>,
                { wrapper: false },
            );

            expect(buttonRef.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
        });
    });
});
