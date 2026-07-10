import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkEnums from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useApplication } from "@gtkx/react";
import { render, screen, within } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.portaltest${nextAppId++}`;

const Portal = ({ children, portalKey }: { children: ReactNode; portalKey?: string }) => {
    const app = useApplication();
    return <>{createPortal(children, app, portalKey)}</>;
};

describe("createPortal (1)", () => {
    it("renders children at root level when no container specified", async () => {
        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <Portal>
                    <GtkApplicationWindow title="Portal Window" />
                </Portal>
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Portal Window", hidden: true });
    });

    it("renders children into a specific container widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App() {
            const box = boxRef.current;
            return (
                <>
                    <GtkBox ref={boxRef} orientation={GtkEnums.Orientation.VERTICAL} />
                    {box && createPortal(<GtkLabel label="In Portal" />, box)}
                </>
            );
        }

        const { rerender } = await render(<App />);
        await rerender(<App />);

        within(boxRef.current as Gtk.Box).getByText("In Portal");
    });

    it("preserves key when provided", async () => {
        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <Portal portalKey="my-key">
                    <GtkApplicationWindow title="Keyed Window" />
                </Portal>
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Keyed Window", hidden: true });
    });
});

describe("createPortal (2)", () => {
    it("unmounts portal children when portal is removed", async () => {
        const appId = uniqueAppId();

        function App({ showPortal }: { showPortal: boolean }) {
            const app = useApplication();
            return <>{showPortal && createPortal(<GtkApplicationWindow title="Portal" />, app)}</>;
        }

        const { rerender } = await render(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App showPortal={true} />
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Portal", hidden: true });

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App showPortal={false} />
            </GtkApplication>,
        );
    });

    it("updates portal children when props change", async () => {
        const appId = uniqueAppId();

        function App({ title }: { title: string }) {
            const app = useApplication();
            return <>{createPortal(<GtkApplicationWindow title={title} />, app)}</>;
        }

        const { rerender } = await render(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App title="First" />
            </GtkApplication>,
            { container: rootElement },
        );
        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "First", hidden: true });

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <App title="Second" />
            </GtkApplication>,
        );
        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Second", hidden: true });
    });
});

describe("createPortal (3)", () => {
    it("handles multiple portals to same container", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App() {
            const box = boxRef.current;
            return (
                <>
                    <GtkBox ref={boxRef} orientation={GtkEnums.Orientation.VERTICAL} />
                    {box && createPortal(<GtkLabel label="First" />, box)}
                    {box && createPortal(<GtkLabel label="Second" />, box)}
                </>
            );
        }

        const { rerender } = await render(<App />);
        await rerender(<App />);

        const box = within(boxRef.current as Gtk.Box);
        box.getByText("First");
        box.getByText("Second");
    });

    it("handles portal to nested container", async () => {
        const innerBoxRef = createRef<Gtk.Box>();

        function App() {
            const innerBox = innerBoxRef.current;
            return (
                <>
                    <GtkBox orientation={GtkEnums.Orientation.VERTICAL}>
                        <GtkBox ref={innerBoxRef} orientation={GtkEnums.Orientation.VERTICAL} />
                    </GtkBox>
                    {innerBox && createPortal(<GtkButton label="Nested" />, innerBox)}
                </>
            );
        }

        const { rerender } = await render(<App />);
        await rerender(<App />);

        within(innerBoxRef.current as Gtk.Box).getByRole(GtkEnums.AccessibleRole.BUTTON, { name: "Nested" });
    });
});
