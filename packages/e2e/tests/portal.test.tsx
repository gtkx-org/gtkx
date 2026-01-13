import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkEnums from "@gtkx/ffi/gtk";
import { createPortal, GtkBox, GtkButton, GtkLabel, GtkWindow, useApplication } from "@gtkx/react";
import { render, tick } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

const Portal = ({ children, portalKey }: { children: ReactNode; portalKey?: string }) => {
    const app = useApplication();
    return <>{createPortal(children, app, portalKey)}</>;
};

describe("createPortal", () => {
    it("renders children at root level when no container specified", async () => {
        const windowRef = createRef<Gtk.Window>();

        await render(
            <Portal>
                <GtkWindow ref={windowRef} title="Portal Window" />
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
        expect(labelRef.current?.getParent()?.handle).toEqual(boxRef.current?.handle);
    });

    it("preserves key when provided", async () => {
        const windowRef = createRef<Gtk.Window>();

        await render(
            <Portal portalKey="my-key">
                <GtkWindow ref={windowRef} title="Keyed Window" />
            </Portal>,
        );

        await tick();
        expect(windowRef.current).not.toBeNull();
        expect(windowRef.current?.getTitle()).toBe("Keyed Window");
    });

    it("unmounts portal children when portal is removed", async () => {
        const windowRef = createRef<Gtk.Window>();

        function App({ showPortal }: { showPortal: boolean }) {
            const app = useApplication();
            return <>{showPortal && createPortal(<GtkWindow ref={windowRef} title="Portal" />, app)}</>;
        }

        await render(<App showPortal={true} />);

        const windowId = windowRef.current?.handle;
        expect(windowId).not.toBeUndefined();

        await render(<App showPortal={false} />);
    });

    it("updates portal children when props change", async () => {
        const windowRef = createRef<Gtk.Window>();

        function App({ title }: { title: string }) {
            const app = useApplication();
            return <>{createPortal(<GtkWindow ref={windowRef} title={title} />, app)}</>;
        }

        await render(<App title="First" />);
        expect(windowRef.current?.getTitle()).toBe("First");

        await render(<App title="Second" />);
        expect(windowRef.current?.getTitle()).toBe("Second");
    });

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
        expect(label1Ref.current?.getParent()?.handle).toEqual(boxRef.current?.handle);
        expect(label2Ref.current?.getParent()?.handle).toEqual(boxRef.current?.handle);
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
        expect(buttonRef.current?.getParent()?.handle).toEqual(innerBoxRef.current?.handle);
    });
});
