import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render as baseRender, screen } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.windowtest${nextAppId++}`;

const render = (element: ReactNode, appId: string = uniqueAppId()) =>
    baseRender(
        <GtkApplication applicationId={appId} flags={APP_FLAGS}>
            {element}
        </GtkApplication>,
        { container: rootElement },
    );

const renderAdw = (element: ReactNode, appId: string = uniqueAppId()) =>
    baseRender(
        <AdwApplication applicationId={appId} flags={APP_FLAGS}>
            {element}
        </AdwApplication>,
        { container: rootElement },
    );

describe("render - Window (1)", () => {
    describe("creation", () => {
        it("creates Gtk.ApplicationWindow with current app", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await render(<GtkApplicationWindow ref={ref} title="App Window" />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()).not.toBeNull();
        });

        it("creates Adw.ApplicationWindow with current app", async () => {
            const ref = createRef<Adw.ApplicationWindow>();

            await renderAdw(<AdwApplicationWindow ref={ref} />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()).not.toBeNull();
        });
    });
});

describe("render - Window (2)", () => {
    describe("defaultSize", () => {
        it("sets default size via defaultWidth/defaultHeight", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await render(<GtkApplicationWindow ref={ref} defaultWidth={300} defaultHeight={200} />);

            const [width, height] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(width).toBeGreaterThanOrEqual(300);
            expect(height).toBeGreaterThanOrEqual(200);
        });

        it("updates default size when props change", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            const appId = uniqueAppId();

            function App({ width, height }: { width: number; height: number }) {
                return <GtkApplicationWindow ref={ref} defaultWidth={width} defaultHeight={height} />;
            }

            const { rerender } = await render(<App width={200} height={150} />, appId);

            const [initialWidth, initialHeight] = ref.current?.getDefaultSize() ?? [0, 0];

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <App width={400} height={300} />
                </GtkApplication>,
            );

            const [updatedWidth, updatedHeight] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(updatedWidth).toBeGreaterThanOrEqual(initialWidth);
            expect(updatedHeight).toBeGreaterThanOrEqual(initialHeight);
        });

        it("handles partial size (only width)", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await render(<GtkApplicationWindow ref={ref} defaultWidth={300} />);

            const [width] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(width).toBeGreaterThanOrEqual(300);
        });

        it("handles partial size (only height)", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await render(<GtkApplicationWindow ref={ref} defaultHeight={200} />);

            const [, height] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(height).toBeGreaterThanOrEqual(200);
        });
    });
});

describe("render - Window (3)", () => {
    describe("lifecycle", () => {
        it("presents window on mount", async () => {
            await render(<GtkApplicationWindow title="Present" />);

            expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Present" })).toBeDefined();
        });

        it("destroys window on unmount", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            const appId = uniqueAppId();

            function App({ show }: { show: boolean }) {
                return show ? <GtkApplicationWindow ref={ref} title="Destroy" /> : null;
            }

            const { rerender } = await render(<App show={true} />, appId);

            const windowId = ref.current;
            expect(windowId).toBeDefined();

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <App show={false} />
                </GtkApplication>,
            );
        });
    });
});

describe("render - Window (4)", () => {
    describe("children", () => {
        it("sets child widget", async () => {
            const windowRef = createRef<Gtk.ApplicationWindow>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkApplicationWindow ref={windowRef}>
                    <GtkLabel ref={labelRef}>Window Child</GtkLabel>
                </GtkApplicationWindow>,
            );

            expect(windowRef.current?.getChild()).toBe(labelRef.current);
        });

        it("replaces child widget", async () => {
            const windowRef = createRef<Gtk.ApplicationWindow>();
            const label1Ref = createRef<Gtk.Label>();
            const label2Ref = createRef<Gtk.Label>();
            const appId = uniqueAppId();

            function App({ first }: { first: boolean }) {
                return (
                    <GtkApplicationWindow ref={windowRef}>
                        {first ? (
                            <GtkLabel ref={label1Ref} key="first">
                                First
                            </GtkLabel>
                        ) : (
                            <GtkLabel ref={label2Ref} key="second">
                                Second
                            </GtkLabel>
                        )}
                    </GtkApplicationWindow>
                );
            }

            const { rerender } = await render(<App first={true} />, appId);

            expect(windowRef.current?.getChild()).toBe(label1Ref.current);

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <App first={false} />
                </GtkApplication>,
            );

            expect(windowRef.current?.getChild()).toBe(label2Ref.current);
        });
    });
});
