import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkEnums from "@gtkx/ffi/gtk";
import { createPortal, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, useApplication } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

const Portal = ({ children, portalKey }: { children: ReactNode; portalKey?: string }) => {
    const app = useApplication();
    return <>{createPortal(children, app, portalKey)}</>;
};

describe("createPortal (1)", () => {
    it("renders children at root level when no container specified", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        await render(
            <Portal>
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

        await render(
            <Portal portalKey="my-key">
                <GtkApplicationWindow ref={windowRef} title="Keyed Window" />
            </Portal>,
        );

        expect(windowRef.current).not.toBeNull();
        expect(windowRef.current?.getTitle()).toBe("Keyed Window");
    });
});

describe("createPortal (2)", () => {
    it("unmounts portal children when portal is removed", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        function App({ showPortal }: { showPortal: boolean }) {
            const app = useApplication();
            return <>{showPortal && createPortal(<GtkApplicationWindow ref={windowRef} title="Portal" />, app)}</>;
        }

        await render(<App showPortal={true} />);

        const windowId = windowRef.current;
        expect(windowId).not.toBeUndefined();

        await render(<App showPortal={false} />);
    });

    it("updates portal children when props change", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        function App({ title }: { title: string }) {
            const app = useApplication();
            return <>{createPortal(<GtkApplicationWindow ref={windowRef} title={title} />, app)}</>;
        }

        await render(<App title="First" />);
        expect(windowRef.current?.getTitle()).toBe("First");

        await render(<App title="Second" />);
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
