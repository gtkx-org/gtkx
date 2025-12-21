import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkHeaderBar, GtkLabel, GtkMenuButton, GtkPopover, Slot } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Slot", () => {
    it("sets slot child via Widget.SlotName pattern", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        await render(
            <GtkHeaderBar ref={headerBarRef}>
                <Slot for={GtkHeaderBar} id="titleWidget">
                    <GtkLabel ref={titleRef} label="Custom Title" />
                </Slot>
            </GtkHeaderBar>,
            { wrapper: false },
        );

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(titleRef.current?.id);
    });

    it("calls setSlotName(widget) on parent", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkMenuButton ref={menuButtonRef}>
                <Slot for={GtkMenuButton} id="child">
                    <GtkLabel ref={labelRef} label="Button Content" />
                </Slot>
            </GtkMenuButton>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();

        function App({ showTitle }: { showTitle: boolean }) {
            return (
                <GtkHeaderBar ref={headerBarRef}>
                    {showTitle && (
                        <Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkLabel label="Title" />
                        </Slot>
                    )}
                </GtkHeaderBar>
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
                <GtkHeaderBar ref={headerBarRef}>
                    <Slot for={GtkHeaderBar} id="titleWidget">
                        {first ? (
                            <GtkLabel ref={label1Ref} key="first" label="First Title" />
                        ) : (
                            <GtkLabel ref={label2Ref} key="second" label="Second Title" />
                        )}
                    </Slot>
                </GtkHeaderBar>
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
            <GtkMenuButton ref={menuButtonRef}>
                <Slot for={GtkMenuButton} id="child">
                    <GtkLabel ref={labelRef} label="Custom Child" />
                </Slot>
            </GtkMenuButton>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton ref={menuButtonRef}>
                <Slot for={GtkMenuButton} id="popover">
                    <GtkPopover ref={popoverRef}>
                        <GtkLabel label="Popover Content" />
                    </GtkPopover>
                </Slot>
            </GtkMenuButton>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getPopover()?.id).toEqual(popoverRef.current?.id);
    });

    it("handles multiple slots on same parent", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const labelRef = createRef<Gtk.Label>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton ref={menuButtonRef}>
                <Slot for={GtkMenuButton} id="child">
                    <GtkLabel ref={labelRef} label="Button Label" />
                </Slot>
                <Slot for={GtkMenuButton} id="popover">
                    <GtkPopover ref={popoverRef}>
                        <GtkLabel label="Popover Content" />
                    </GtkPopover>
                </Slot>
            </GtkMenuButton>,
            { wrapper: false },
        );

        expect(menuButtonRef.current?.getChild()?.id).toEqual(labelRef.current?.id);
        expect(menuButtonRef.current?.getPopover()?.id).toEqual(popoverRef.current?.id);
    });

    it("supports direct children in headerbar", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const buttonRef = createRef<Gtk.Button>();

        await render(
            <GtkHeaderBar ref={headerBarRef}>
                <GtkButton ref={buttonRef} label="Direct Button" />
            </GtkHeaderBar>,
            { wrapper: false },
        );

        expect(buttonRef.current?.getParent()?.id).toEqual(headerBarRef.current?.id);
    });
});
