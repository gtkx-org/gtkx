import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow, GtkWindow } from "@gtkx/jsx/gtk";
import { createRootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.topleveparentingtest${nextAppId++}`;

const ParentedTree = ({
    parentRef,
    children,
}: {
    parentRef: RefObject<Gtk.Window | null>;
    children: (parent: Gtk.Window) => ReactNode;
}) => {
    const [appId] = useState(uniqueAppId);
    const [parent, setParent] = useState<Gtk.Window | null>(null);
    const capture = (window: Gtk.Window | null): void => {
        parentRef.current = window;
        setParent(window);
    };
    return (
        <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow ref={capture} defaultWidth={100} defaultHeight={100}>
                {parent && children(parent)}
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

describe("explicit top-level parenting", () => {
    it("sets transientFor on a window from the prop", async () => {
        const parentRef = createRef<Gtk.Window>();
        const childRef = createRef<Gtk.Window>();

        await render(
            <ParentedTree parentRef={parentRef}>
                {(parent) => <GtkWindow ref={childRef} transientFor={parent} defaultWidth={50} defaultHeight={50} />}
            </ParentedTree>,
            { container: createRootElement() },
        );

        expect(parentRef.current).not.toBeNull();
        expect(childRef.current?.getTransientFor()).toBe(parentRef.current);
    });

    it("clears transientFor when the prop becomes null", async () => {
        const parentRef = createRef<Gtk.Window>();
        const childRef = createRef<Gtk.Window>();

        const App = ({ parented }: { parented: boolean }) => (
            <ParentedTree parentRef={parentRef}>
                {(parent) => (
                    <GtkWindow
                        ref={childRef}
                        transientFor={parented ? parent : null}
                        defaultWidth={50}
                        defaultHeight={50}
                    />
                )}
            </ParentedTree>
        );

        const { rerender } = await render(<App parented={true} />, { container: createRootElement() });
        expect(childRef.current?.getTransientFor()).toBe(parentRef.current);

        await rerender(<App parented={false} />);
        expect(childRef.current?.getTransientFor()).toBeNull();
    });

    it("presents an Adw.Dialog against the window passed as parent", async () => {
        const parentRef = createRef<Gtk.Window>();
        const dialogRef = createRef<Adw.AlertDialog>();

        await render(
            <ParentedTree parentRef={parentRef}>
                {(parent) => <AdwAlertDialog ref={dialogRef} parent={parent} heading="Parented" />}
            </ParentedTree>,
            { container: createRootElement() },
        );

        expect(dialogRef.current).not.toBeNull();
        const root = dialogRef.current?.getRoot();
        if (!(root instanceof Gtk.Window)) throw new Error("expected the presented dialog's root to be a window");
        expect(root.getTransientFor()).toBe(parentRef.current);
    });
});
