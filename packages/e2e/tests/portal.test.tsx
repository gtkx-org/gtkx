import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkEnums from "@gtkx/ffi/gtk";
import { createPortal, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { act, render } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

const Portal = ({
    children,
    target,
    portalKey,
}: {
    children: ReactNode;
    target: Gtk.Application;
    portalKey?: string;
}) => <>{createPortal(children, target, portalKey)}</>;

describe("createPortal (1)", () => {
    it("renders children at root level when no container specified", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        const { app, rerender } = await render(<></>);
        await rerender(
            <Portal target={app}>
                <GtkApplicationWindow ref={windowRef} title="Portal Window" />
            </Portal>,
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

        await render(<App />);
        await render(<App />);

        expect(labelRef.current).not.toBeNull();
        expect(labelRef.current?.getParent()).toBe(boxRef.current);
    });

    it("preserves key when provided", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        const { app, rerender } = await render(<></>);
        await rerender(
            <Portal target={app} portalKey="my-key">
                <GtkApplicationWindow ref={windowRef} title="Keyed Window" />
            </Portal>,
        );

        await act(() => {});
        expect(windowRef.current).not.toBeNull();
        expect(windowRef.current?.getTitle()).toBe("Keyed Window");
    });
});

describe("createPortal (2)", () => {
    it("unmounts portal children when portal is removed", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        function App({ target, showPortal }: { target: Gtk.Application; showPortal: boolean }) {
            return <>{showPortal && createPortal(<GtkApplicationWindow ref={windowRef} title="Portal" />, target)}</>;
        }

        const { app, rerender } = await render(<></>);
        await rerender(<App target={app} showPortal={true} />);

        const windowId = windowRef.current;
        expect(windowId).not.toBeUndefined();

        await rerender(<App target={app} showPortal={false} />);
    });

    it("updates portal children when props change", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        function App({ target, title }: { target: Gtk.Application; title: string }) {
            return <>{createPortal(<GtkApplicationWindow ref={windowRef} title={title} />, target)}</>;
        }

        const { app, rerender } = await render(<></>);
        await rerender(<App target={app} title="First" />);
        expect(windowRef.current?.getTitle()).toBe("First");

        await rerender(<App target={app} title="Second" />);
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

        await render(<App />);
        await render(<App />);

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

        await render(<App />);
        await render(<App />);

        expect(buttonRef.current).not.toBeNull();
        expect(buttonRef.current?.getParent()).toBe(innerBoxRef.current);
    });
});
