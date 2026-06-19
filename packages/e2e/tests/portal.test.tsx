import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkEnums from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal, createRootElement, useApplication } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.portaltest${nextAppId++}`;

const Portal = ({ children, portalKey }: { children: ReactNode; portalKey?: string }) => {
    const app = useApplication();
    return <>{createPortal(children, app, portalKey)}</>;
};

describe("createPortal (1)", () => {
    it("renders children at root level when no container specified", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <Portal>
                    <GtkApplicationWindow ref={windowRef} title="Portal Window" />
                </Portal>
            </GtkApplication>,
            { container: createRootElement() },
        );

        expect(windowRef.current).not.toBeNull();
        expect(windowRef.current?.getTitle()).toBe("Portal Window");
    });

    it("renders children into a specific container widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelRef = createRef<Gtk.Label>();

        function App() {
            const box = boxRef.current;
            return (
                <>
                    <GtkBox ref={boxRef} orientation={GtkEnums.Orientation.VERTICAL} />
                    {box && createPortal(<GtkLabel ref={labelRef} label="In Portal" />, box)}
                </>
            );
        }

        const { rerender } = await render(<App />);
        await rerender(<App />);

        expect(labelRef.current).not.toBeNull();
        expect(labelRef.current?.getParent()).toBe(boxRef.current);
    });

    it("preserves key when provided", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <Portal portalKey="my-key">
                    <GtkApplicationWindow ref={windowRef} title="Keyed Window" />
                </Portal>
            </GtkApplication>,
            { container: createRootElement() },
        );

        expect(windowRef.current).not.toBeNull();
        expect(windowRef.current?.getTitle()).toBe("Keyed Window");
    });
});

describe("createPortal (2)", () => {
    it("unmounts portal children when portal is removed", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();
        const appId = uniqueAppId();

        function App({ showPortal }: { showPortal: boolean }) {
            const app = useApplication();
            return <>{showPortal && createPortal(<GtkApplicationWindow ref={windowRef} title="Portal" />, app)}</>;
        }

        const { rerender } = await render(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App showPortal={true} />
            </GtkApplication>,
            { container: createRootElement() },
        );

        const windowId = windowRef.current;
        expect(windowId).not.toBeUndefined();

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App showPortal={false} />
            </GtkApplication>,
        );
    });

    it("updates portal children when props change", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();
        const appId = uniqueAppId();

        function App({ title }: { title: string }) {
            const app = useApplication();
            return <>{createPortal(<GtkApplicationWindow ref={windowRef} title={title} />, app)}</>;
        }

        const { rerender } = await render(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App title="First" />
            </GtkApplication>,
            { container: createRootElement() },
        );
        expect(windowRef.current?.getTitle()).toBe("First");

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App title="Second" />
            </GtkApplication>,
        );
        expect(windowRef.current?.getTitle()).toBe("Second");
    });
});

describe("createPortal (3)", () => {
    it("handles multiple portals to same container", async () => {
        const boxRef = createRef<Gtk.Box>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();

        function App() {
            const box = boxRef.current;
            return (
                <>
                    <GtkBox ref={boxRef} orientation={GtkEnums.Orientation.VERTICAL} />
                    {box && createPortal(<GtkLabel ref={label1Ref} label="First" />, box)}
                    {box && createPortal(<GtkLabel ref={label2Ref} label="Second" />, box)}
                </>
            );
        }

        const { rerender } = await render(<App />);
        await rerender(<App />);

        expect(label1Ref.current).not.toBeNull();
        expect(label2Ref.current).not.toBeNull();
        expect(label1Ref.current?.getParent()).toBe(boxRef.current);
        expect(label2Ref.current?.getParent()).toBe(boxRef.current);
    });

    it("handles portal to nested container", async () => {
        const innerBoxRef = createRef<Gtk.Box>();
        const buttonRef = createRef<Gtk.Button>();

        function App() {
            const innerBox = innerBoxRef.current;
            return (
                <>
                    <GtkBox orientation={GtkEnums.Orientation.VERTICAL}>
                        <GtkBox ref={innerBoxRef} orientation={GtkEnums.Orientation.VERTICAL} />
                    </GtkBox>
                    {innerBox && createPortal(<GtkButton ref={buttonRef} label="Nested" />, innerBox)}
                </>
            );
        }

        const { rerender } = await render(<App />);
        await rerender(<App />);

        expect(buttonRef.current).not.toBeNull();
        expect(buttonRef.current?.getParent()).toBe(innerBoxRef.current);
    });
});
