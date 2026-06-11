import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkApplicationWindow, GtkWindow } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";

const options = { wrapper: false } as const;

const ParentedTree = ({
    parentRef,
    children,
}: {
    parentRef: RefObject<Gtk.Window | null>;
    children: (parent: Gtk.Window) => ReactNode;
}) => {
    const [parent, setParent] = useState<Gtk.Window | null>(null);
    const capture = (window: Gtk.Window | null): void => {
        parentRef.current = window;
        setParent(window);
    };
    return (
        <GtkApplicationWindow ref={capture} defaultWidth={100} defaultHeight={100}>
            {parent && children(parent)}
        </GtkApplicationWindow>
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
            options,
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

        const { rerender } = await render(<App parented={true} />, options);
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
            options,
        );

        expect(dialogRef.current).not.toBeNull();
        const root = dialogRef.current?.getRoot();
        if (!(root instanceof Gtk.Window)) throw new Error("expected the presented dialog's root to be a window");
        expect(root.getTransientFor()).toBe(parentRef.current);
    });
});
