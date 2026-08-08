import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
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

const NestedChild = ({
    parentRef,
    childRef,
    isParented,
}: {
    parentRef: RefObject<Gtk.Window | null>;
    childRef: RefObject<Gtk.Window | null>;
    isParented: boolean;
}) => (
    <ParentedTree parentRef={parentRef}>
        {(parent) => (
            <GtkWindow
                ref={childRef}
                transientFor={isParented ? parent : null}
                defaultWidth={50}
                defaultHeight={50}
            />
        )}
    </ParentedTree>
);

const renderNestedChild = async (isParented: boolean) => {
    const parentRef = createRef<Gtk.Window>();
    const childRef = createRef<Gtk.Window>();

    const { rerender } = await render(
        <NestedChild parentRef={parentRef} childRef={childRef} isParented={isParented} />,
        { container: rootElement },
    );

    const rerenderNestedChild = (isStillParented: boolean) =>
        rerender(<NestedChild parentRef={parentRef} childRef={childRef} isParented={isStillParented} />);

    return { parentRef, childRef, rerenderNestedChild };
};

describe("explicit top-level parenting", () => {
    it("sets transientFor on a window from the prop", async () => {
        const { parentRef, childRef } = await renderNestedChild(true);
        expect(parentRef.current).not.toBeNull();
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        expect(childRef.current?.getParent()).toBeNull();
    });

    it("keeps transientFor clear when the prop is an explicit null", async () => {
        const { parentRef, childRef } = await renderNestedChild(false);
        expect(parentRef.current).not.toBeNull();
        expect(childRef.current?.getTransientFor()).toBeNull();
    });

    it("clears transientFor when the prop becomes null", async () => {
        const { parentRef, childRef, rerenderNestedChild } = await renderNestedChild(true);
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        await rerenderNestedChild(false);
        expect(childRef.current?.getTransientFor()).toBeNull();
    });
});

describe("default top-level parenting", () => {
    it("defaults transientFor to the nearest parent window when the prop is not passed", async () => {
        const parentRef = createRef<Gtk.Window>();
        const childRef = createRef<Gtk.Window>();

        await render(
            <ParentedTree parentRef={parentRef}>
                {() => <GtkWindow ref={childRef} defaultWidth={50} defaultHeight={50} />}
            </ParentedTree>,
            { container: rootElement },
        );

        expect(parentRef.current).not.toBeNull();
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        expect(childRef.current?.getParent()).toBeNull();
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
