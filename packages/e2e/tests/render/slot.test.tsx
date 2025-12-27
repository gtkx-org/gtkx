import * as Gtk from "@gtkx/ffi/gtk";
import { GtkHeaderBar, GtkLabel, GtkMenuButton, GtkPaned, GtkPopover, Slot } from "@gtkx/react";
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
        );

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(titleRef.current?.id);
    });

    it("calls setSlotName(widget) on parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned ref={panedRef} orientation={Gtk.Orientation.HORIZONTAL}>
                <Slot for={GtkPaned} id="startChild">
                    <GtkLabel ref={labelRef} label="Start Content" />
                </Slot>
            </GtkPaned>,
        );

        expect(panedRef.current?.getStartChild()?.id).toEqual(labelRef.current?.id);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();

        function App({ showTitle }: { showTitle: boolean }) {
            return (
                <GtkHeaderBar ref={headerBarRef}>
                    {showTitle && (
                        <Slot for={GtkHeaderBar} id="titleWidget">
                            Title
                        </Slot>
                    )}
                </GtkHeaderBar>
            );
        }

        await render(<App showTitle={true} />);

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

        await render(<App first={true} />);

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(label1Ref.current?.id);

        await render(<App first={false} />);

        expect(headerBarRef.current?.getTitleWidget()?.id).toEqual(label2Ref.current?.id);
    });

    it("handles Paned.StartChild slot", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned ref={panedRef} orientation={Gtk.Orientation.HORIZONTAL}>
                <Slot for={GtkPaned} id="startChild">
                    <GtkLabel ref={labelRef} label="Start Child" />
                </Slot>
            </GtkPaned>,
        );

        expect(panedRef.current?.getStartChild()?.id).toEqual(labelRef.current?.id);
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton ref={menuButtonRef}>
                <Slot for={GtkMenuButton} id="popover">
                    <GtkPopover ref={popoverRef}>Popover Content</GtkPopover>
                </Slot>
            </GtkMenuButton>,
        );

        expect(menuButtonRef.current?.getPopover()?.id).toEqual(popoverRef.current?.id);
    });

    it("handles multiple slots on same parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const startRef = createRef<Gtk.Label>();
        const endRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned ref={panedRef} orientation={Gtk.Orientation.HORIZONTAL}>
                <Slot for={GtkPaned} id="startChild">
                    <GtkLabel ref={startRef} label="Start" />
                </Slot>
                <Slot for={GtkPaned} id="endChild">
                    <GtkLabel ref={endRef} label="End" />
                </Slot>
            </GtkPaned>,
        );

        expect(panedRef.current?.getStartChild()?.id).toEqual(startRef.current?.id);
        expect(panedRef.current?.getEndChild()?.id).toEqual(endRef.current?.id);
    });
});
