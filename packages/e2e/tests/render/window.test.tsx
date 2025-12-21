import { createRef as createNativeRef, getApplication } from "@gtkx/ffi";
import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { AdwApplicationWindow, AdwWindow, GtkApplicationWindow, GtkLabel, GtkWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Window", () => {
    describe("creation", () => {
        it("creates Gtk.Window", async () => {
            const ref = createRef<Gtk.Window>();

            await render(<GtkWindow.Root ref={ref} title="Plain Window" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getTitle()).toBe("Plain Window");
        });

        it("creates Gtk.ApplicationWindow with current app", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await render(<GtkApplicationWindow ref={ref} title="App Window" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()?.id).toEqual(getApplication().id);
        });

        it("creates Adw.Window", async () => {
            const ref = createRef<Adw.Window>();

            await render(<AdwWindow.Root ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("creates Adw.ApplicationWindow with current app", async () => {
            const ref = createRef<Adw.ApplicationWindow>();

            await render(<AdwApplicationWindow.Root ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()?.id).toEqual(getApplication().id);
        });
    });

    describe("defaultSize", () => {
        it("sets default size via defaultWidth/defaultHeight", async () => {
            const ref = createRef<Gtk.Window>();

            await render(<GtkWindow.Root ref={ref} defaultWidth={300} defaultHeight={200} />, { wrapper: false });

            const widthRef = createNativeRef(0);
            const heightRef = createNativeRef(0);
            ref.current?.getDefaultSize(widthRef, heightRef);
            expect(widthRef.value).toBeGreaterThanOrEqual(300);
            expect(heightRef.value).toBeGreaterThanOrEqual(200);
        });

        it("updates default size when props change", async () => {
            const ref = createRef<Gtk.Window>();

            function App({ width, height }: { width: number; height: number }) {
                return <GtkWindow.Root ref={ref} defaultWidth={width} defaultHeight={height} />;
            }

            await render(<App width={200} height={150} />, { wrapper: false });

            const widthRef = createNativeRef(0);
            const heightRef = createNativeRef(0);
            ref.current?.getDefaultSize(widthRef, heightRef);
            const initialWidth = widthRef.value;
            const initialHeight = heightRef.value;

            await render(<App width={400} height={300} />, { wrapper: false });

            ref.current?.getDefaultSize(widthRef, heightRef);
            expect(widthRef.value).toBeGreaterThanOrEqual(initialWidth);
            expect(heightRef.value).toBeGreaterThanOrEqual(initialHeight);
        });

        it("handles partial size (only width)", async () => {
            const ref = createRef<Gtk.Window>();

            await render(<GtkWindow.Root ref={ref} defaultWidth={300} />, { wrapper: false });

            const widthRef = createNativeRef(0);
            ref.current?.getDefaultSize(widthRef);
            expect(widthRef.value).toBeGreaterThanOrEqual(300);
        });

        it("handles partial size (only height)", async () => {
            const ref = createRef<Gtk.Window>();

            await render(<GtkWindow.Root ref={ref} defaultHeight={200} />, { wrapper: false });

            const heightRef = createNativeRef(0);
            ref.current?.getDefaultSize(undefined, heightRef);
            expect(heightRef.value).toBeGreaterThanOrEqual(200);
        });
    });

    describe("lifecycle", () => {
        it("presents window on mount", async () => {
            const ref = createRef<Gtk.Window>();

            await render(<GtkWindow.Root ref={ref} title="Present" />, { wrapper: false });

            expect(ref.current?.getVisible()).toBe(true);
        });

        it("destroys window on unmount", async () => {
            const ref = createRef<Gtk.Window>();

            function App({ show }: { show: boolean }) {
                return show ? <GtkWindow.Root ref={ref} title="Destroy" /> : null;
            }

            await render(<App show={true} />, { wrapper: false });

            const windowId = ref.current?.id;
            expect(windowId).toBeDefined();

            await render(<App show={false} />, { wrapper: false });
        });
    });

    describe("children", () => {
        it("sets child widget", async () => {
            const windowRef = createRef<Gtk.Window>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkWindow.Root ref={windowRef}>
                    <GtkLabel ref={labelRef} label="Window Child" />
                </GtkWindow.Root>,
                { wrapper: false },
            );

            expect(windowRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
        });

        it("replaces child widget", async () => {
            const windowRef = createRef<Gtk.Window>();
            const label1Ref = createRef<Gtk.Label>();
            const label2Ref = createRef<Gtk.Label>();

            function App({ first }: { first: boolean }) {
                return (
                    <GtkWindow.Root ref={windowRef}>
                        {first ? (
                            <GtkLabel ref={label1Ref} key="first" label="First" />
                        ) : (
                            <GtkLabel ref={label2Ref} key="second" label="Second" />
                        )}
                    </GtkWindow.Root>
                );
            }

            await render(<App first={true} />, { wrapper: false });

            expect(windowRef.current?.getChild()?.id).toEqual(label1Ref.current?.id);

            await render(<App first={false} />, { wrapper: false });

            expect(windowRef.current?.getChild()?.id).toEqual(label2Ref.current?.id);
        });
    });
});
