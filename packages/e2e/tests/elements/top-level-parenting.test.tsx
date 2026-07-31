import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow, GtkWindow } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.topleveparentingtest");

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

const PortaledChild = ({
    parentRef,
    childRef,
    parented,
}: {
    parentRef: RefObject<Gtk.Window | null>;
    childRef: RefObject<Gtk.Window | null>;
    parented: boolean;
}) => (
    <ParentedTree parentRef={parentRef}>
        {(parent) =>
            createPortal(
                <GtkWindow
                    ref={childRef}
                    transientFor={parented ? parent : null}
                    defaultWidth={50}
                    defaultHeight={50}
                />,
                rootElement,
            )}
    </ParentedTree>
);

describe("explicit top-level parenting", () => {
    it("sets transientFor on a window from the prop", async () => {
        const parentRef = createRef<Gtk.Window>();
        const childRef = createRef<Gtk.Window>();

        await render(<PortaledChild parentRef={parentRef} childRef={childRef} parented={true} />, {
            container: rootElement,
        });

        expect(parentRef.current).not.toBeNull();
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        expect(childRef.current?.getParent()).toBeNull();
    });

    it("clears transientFor when the prop becomes null", async () => {
        const parentRef = createRef<Gtk.Window>();
        const childRef = createRef<Gtk.Window>();

        const { rerender } = await render(
            <PortaledChild parentRef={parentRef} childRef={childRef} parented={true} />,
            { container: rootElement },
        );

        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        await rerender(<PortaledChild parentRef={parentRef} childRef={childRef} parented={false} />);
        expect(childRef.current?.getTransientFor()).toBeNull();
    });

    it("presents an Adw.Dialog against its enclosing window", async () => {
        const parentRef = createRef<Gtk.Window>();
        const dialogRef = createRef<Adw.AlertDialog>();

        await render(
            <ParentedTree parentRef={parentRef}>
                {() => (
                    <AdwAlertDialog
                        ref={(widget) => {
                            dialogRef.current = widget;
                        }}
                        heading="Parented"
                    />
                )}
            </ParentedTree>,
            { container: rootElement },
        );

        expect(dialogRef.current).not.toBeNull();
        const root = dialogRef.current?.getRoot();

        if (!(root instanceof Gtk.Window)) {
            throw new TypeError("expected the presented dialog's root to be a window");
        }

        expect(root).toHaveObjectProperty("transientFor", parentRef.current);
    });
});
