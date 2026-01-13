import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkHeaderBar, GtkLabel, GtkMenuButton, GtkPaned, GtkPopover, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Slot", () => {
    it("sets slot child via Widget.SlotName pattern", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        await render(
            <GtkHeaderBar ref={headerBarRef}>
                <x.Slot for={GtkHeaderBar} id="titleWidget">
                    <GtkLabel ref={titleRef} label="Custom Title" />
                </x.Slot>
            </GtkHeaderBar>,
        );

        expect(headerBarRef.current?.getTitleWidget()?.handle).toEqual(titleRef.current?.handle);
    });

    it("calls setSlotName(widget) on parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned ref={panedRef}>
                <x.Slot for={GtkPaned} id="startChild">
                    <GtkLabel ref={labelRef} label="Start Content" />
                </x.Slot>
            </GtkPaned>,
        );

        expect(panedRef.current?.getStartChild()?.handle).toEqual(labelRef.current?.handle);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();

        function App({ showTitle }: { showTitle: boolean }) {
            return (
                <GtkHeaderBar ref={headerBarRef}>
                    {showTitle && (
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            Title
                        </x.Slot>
                    )}
                </GtkHeaderBar>
            );
        }

        await render(<App showTitle />);

        expect(headerBarRef.current?.getTitleWidget()).not.toBeNull();

        await render(<App showTitle={false} />);

        expect(headerBarRef.current?.getTitleWidget()).toBeNull();
    });

    it("updates slot when child changes", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();

        function App({ first }: { first: boolean }) {
            return (
                <GtkHeaderBar ref={headerBarRef}>
                    <x.Slot for={GtkHeaderBar} id="titleWidget">
                        {first ? (
                            <GtkLabel ref={label1Ref} key="first" label="First Title" />
                        ) : (
                            <GtkLabel ref={label2Ref} key="second" label="Second Title" />
                        )}
                    </x.Slot>
                </GtkHeaderBar>
            );
        }

        await render(<App first={true} />);

        expect(headerBarRef.current?.getTitleWidget()?.handle).toEqual(label1Ref.current?.handle);

        await render(<App first={false} />);

        expect(headerBarRef.current?.getTitleWidget()?.handle).toEqual(label2Ref.current?.handle);
    });

    it("handles Paned.StartChild slot", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned ref={panedRef}>
                <x.Slot for={GtkPaned} id="startChild">
                    <GtkLabel ref={labelRef} label="Start Child" />
                </x.Slot>
            </GtkPaned>,
        );

        expect(panedRef.current?.getStartChild()?.handle).toEqual(labelRef.current?.handle);
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton ref={menuButtonRef}>
                <x.Slot for={GtkMenuButton} id="popover">
                    <GtkPopover ref={popoverRef}>Popover Content</GtkPopover>
                </x.Slot>
            </GtkMenuButton>,
        );

        expect(menuButtonRef.current?.getPopover()?.handle).toEqual(popoverRef.current?.handle);
    });

    it("handles multiple slots on same parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const startRef = createRef<Gtk.Label>();
        const endRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned ref={panedRef}>
                <x.Slot for={GtkPaned} id="startChild">
                    <GtkLabel ref={startRef} label="Start" />
                </x.Slot>
                <x.Slot for={GtkPaned} id="endChild">
                    <GtkLabel ref={endRef} label="End" />
                </x.Slot>
            </GtkPaned>,
        );

        expect(panedRef.current?.getStartChild()?.handle).toEqual(startRef.current?.handle);
        expect(panedRef.current?.getEndChild()?.handle).toEqual(endRef.current?.handle);
    });
});
