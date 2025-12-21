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
            { wrapper: false },
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
                    <GtkBox ref={boxRef} spacing={0} orientation={GtkEnums.Orientation.VERTICAL} />
                    {box && createPortal(<GtkLabel ref={labelRef} label="In Portal" />, box)}
                </>
            );
        }

        await render(<App />, { wrapper: false });
        await render(<App />, { wrapper: false });

        expect(labelRef.current).not.toBeNull();
        expect(labelRef.current?.getParent()?.id).toEqual(boxRef.current?.id);
    });

    it("preserves key when provided", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(
            <Portal portalKey="my-key">
                <GtkLabel ref={labelRef} label="Keyed" />
            </Portal>,
            { wrapper: false },
        );

        await tick();
        expect(labelRef.current).not.toBeNull();
    });

    it("unmounts portal children when portal is removed", async () => {
        const windowRef = createRef<Gtk.Window>();

        function App({ showPortal }: { showPortal: boolean }) {
            const app = useApplication();
            return <>{showPortal && createPortal(<GtkWindow ref={windowRef} title="Portal" />, app)}</>;
        }

        await render(<App showPortal={true} />, { wrapper: false });

        const windowId = windowRef.current?.id;
        expect(windowId).not.toBeUndefined();

        await render(<App showPortal={false} />, { wrapper: false });
    });

    it("updates portal children when props change", async () => {
        const windowRef = createRef<Gtk.Window>();

        function App({ title }: { title: string }) {
            const app = useApplication();
            return <>{createPortal(<GtkWindow ref={windowRef} title={title} />, app)}</>;
        }

        await render(<App title="First" />, { wrapper: false });
        expect(windowRef.current?.getTitle()).toBe("First");

        await render(<App title="Second" />, { wrapper: false });
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
                    <GtkBox ref={boxRef} spacing={0} orientation={GtkEnums.Orientation.VERTICAL} />
                    {box && createPortal(<GtkLabel ref={label1Ref} label="First" />, box)}
                    {box && createPortal(<GtkLabel ref={label2Ref} label="Second" />, box)}
                </>
            );
        }

        await render(<App />, { wrapper: false });
        await render(<App />, { wrapper: false });

        expect(label1Ref.current).not.toBeNull();
        expect(label2Ref.current).not.toBeNull();
        expect(label1Ref.current?.getParent()?.id).toEqual(boxRef.current?.id);
        expect(label2Ref.current?.getParent()?.id).toEqual(boxRef.current?.id);
    });

    it("handles portal to nested container", async () => {
        const innerBoxRef = createRef<Gtk.Box>();
        const buttonRef = createRef<Gtk.Button>();

        function App() {
            const innerBox = innerBoxRef.current;
            return (
                <>
                    <GtkBox spacing={0} orientation={GtkEnums.Orientation.VERTICAL}>
                        <GtkBox ref={innerBoxRef} spacing={0} orientation={GtkEnums.Orientation.VERTICAL} />
                    </GtkBox>
                    {innerBox && createPortal(<GtkButton ref={buttonRef} label="Nested" />, innerBox)}
                </>
            );
        }

        await render(<App />, { wrapper: false });
        await render(<App />, { wrapper: false });

        expect(buttonRef.current).not.toBeNull();
        expect(buttonRef.current?.getParent()?.id).toEqual(innerBoxRef.current?.id);
    });
});
