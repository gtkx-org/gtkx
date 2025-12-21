import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkHeaderBar, GtkLabel, GtkMenuButton, GtkPopover } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Slot", () => {
    it("sets slot child via Widget.SlotName pattern", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        await render(
            <GtkHeaderBar.Root ref={headerBarRef}>
                <GtkHeaderBar.TitleWidget>
                    <GtkLabel ref={titleRef} label="Custom Title" />
                </GtkHeaderBar.TitleWidget>
            </GtkHeaderBar.Root>,
            { wrapper: false },
        );

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(titleRef.current?.id);
    });

    it("calls setSlotName(widget) on parent", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkMenuButton.Root ref={menuButtonRef}>
                <GtkMenuButton.Child>
                    <GtkLabel ref={labelRef} label="Button Content" />
                </GtkMenuButton.Child>
            </GtkMenuButton.Root>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();

        function App({ showTitle }: { showTitle: boolean }) {
            return (
                <GtkHeaderBar.Root ref={headerBarRef}>
                    {showTitle && (
                        <GtkHeaderBar.TitleWidget>
                            <GtkLabel label="Title" />
                        </GtkHeaderBar.TitleWidget>
                    )}
                </GtkHeaderBar.Root>
            );
        }

        await render(<App showTitle={true} />, { wrapper: false });

        expect(headerBarRef.current?.getTitleWidget()).not.toBeNull();

        await render(<App showTitle={false} />, { wrapper: false });

        expect(headerBarRef.current?.getTitleWidget()).toBeNull();
    });

    it("updates slot when child changes", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();

        function App({ first }: { first: boolean }) {
            return (
                <GtkHeaderBar.Root ref={headerBarRef}>
                    <GtkHeaderBar.TitleWidget>
                        {first ? (
                            <GtkLabel ref={label1Ref} key="first" label="First Title" />
                        ) : (
                            <GtkLabel ref={label2Ref} key="second" label="Second Title" />
                        )}
                    </GtkHeaderBar.TitleWidget>
                </GtkHeaderBar.Root>
            );
        }

        await render(<App first={true} />, { wrapper: false });

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(label1Ref.current?.id);

        await render(<App first={false} />, { wrapper: false });

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(label2Ref.current?.id);
    });

    it("handles MenuButton.Child slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkMenuButton.Root ref={menuButtonRef}>
                <GtkMenuButton.Child>
                    <GtkLabel ref={labelRef} label="Custom Child" />
                </GtkMenuButton.Child>
            </GtkMenuButton.Root>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton.Root ref={menuButtonRef}>
                <GtkMenuButton.Popover>
                    <GtkPopover.Root ref={popoverRef}>
                        <GtkLabel label="Popover Content" />
                    </GtkPopover.Root>
                </GtkMenuButton.Popover>
            </GtkMenuButton.Root>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getPopover()?.id).toEqual(popoverRef.current?.id);
    });

    it("handles multiple slots on same parent", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const labelRef = createRef<Gtk.Label>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton.Root ref={menuButtonRef}>
                <GtkMenuButton.Child>
                    <GtkLabel ref={labelRef} label="Button Label" />
                </GtkMenuButton.Child>
                <GtkMenuButton.Popover>
                    <GtkPopover.Root ref={popoverRef}>
                        <GtkLabel label="Popover Content" />
                    </GtkPopover.Root>
                </GtkMenuButton.Popover>
            </GtkMenuButton.Root>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
        expect(menuButtonRef.current?.getPopover()?.id).toEqual(popoverRef.current?.id);
    });

    it("supports direct children in headerbar", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const buttonRef = createRef<Gtk.Button>();

        await render(
            <GtkHeaderBar.Root ref={headerBarRef}>
                <GtkButton ref={buttonRef} label="Direct Button" />
            </GtkHeaderBar.Root>,
            { wrapper: false },
        );

        expect(buttonRef.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
    });
});
