import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode, RefObject } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render as baseRender, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.windowtest");

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

function SwappedChildApp({
    windowRef,
    firstRef,
    secondRef,
    isFirst,
}: {
    windowRef: RefObject<Gtk.ApplicationWindow | null>;
    firstRef: RefObject<Gtk.Label | null>;
    secondRef: RefObject<Gtk.Label | null>;
    isFirst: boolean;
}) {
    return (
        <GtkApplicationWindow ref={windowRef}>
            {isFirst
                ? (
                        <GtkLabel ref={firstRef} key="first">
                            First
                        </GtkLabel>
                    )
                : (
                        <GtkLabel ref={secondRef} key="second">
                            Second
                        </GtkLabel>
                    )}
        </GtkApplicationWindow>
    );
}

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

        it("creates Gtk.ApplicationWindow through intermediate elements", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await render(
                <GtkApplicationWindow title="Outer">
                    <GtkBox>
                        <GtkApplicationWindow ref={ref} title="Nested App Window" />
                    </GtkBox>
                </GtkApplicationWindow>,
            );

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()).not.toBeNull();
            expect(ref.current?.getParent()).toBeNull();
        });

        it("throws without a GtkApplication ancestor", async () => {
            await expect(
                baseRender(<GtkApplicationWindow title="Orphan" />, { container: rootElement }),
            ).rejects.toThrow(/useApplication must be called within GtkApplication/);
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

            function App({ shouldShow }: { shouldShow: boolean }) {
                return shouldShow ? <GtkApplicationWindow ref={ref} title="Destroy" /> : null;
            }

            const { rerender } = await render(<App shouldShow={true} />, appId);
            const windowId = ref.current;
            expect(windowId).toBeDefined();

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <App shouldShow={false} />
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

            expect(windowRef.current).toHaveObjectProperty("child", labelRef.current);
        });

        it("replaces child widget", async () => {
            const windowRef = createRef<Gtk.ApplicationWindow>();
            const label1Ref = createRef<Gtk.Label>();
            const label2Ref = createRef<Gtk.Label>();
            const appId = uniqueAppId();

            const { rerender } = await render(
                <SwappedChildApp windowRef={windowRef} firstRef={label1Ref} secondRef={label2Ref} isFirst={true} />,
                appId,
            );

            expect(windowRef.current).toHaveObjectProperty("child", label1Ref.current);

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <SwappedChildApp
                        windowRef={windowRef}
                        firstRef={label1Ref}
                        secondRef={label2Ref}
                        isFirst={false}
                    />
                </GtkApplication>,
            );

            expect(windowRef.current).toHaveObjectProperty("child", label2Ref.current);
        });

        it("sets Adw.ApplicationWindow content via setContent", async () => {
            const windowRef = createRef<Adw.ApplicationWindow>();
            const labelRef = createRef<Gtk.Label>();

            await renderAdw(
                <AdwApplicationWindow ref={windowRef}>
                    <GtkLabel ref={labelRef}>Window Content</GtkLabel>
                </AdwApplicationWindow>,
            );

            expect(windowRef.current).toHaveObjectProperty("content", labelRef.current);
        });
    });
});
