import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkHeaderBar, GtkLabel, GtkMenuButton, GtkPaned, GtkPopover } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createElement, createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Slot (1)", () => {
    it("sets slot child via ReactNode prop", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        await render(
            <GtkHeaderBar ref={headerBarRef} titleWidget={<GtkLabel ref={titleRef} label="Custom Title" />} />,
        );

        expect(headerBarRef.current?.getTitleWidget()).toBe(titleRef.current);
    });

    it("calls setSlotName(widget) on parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();

        await render(<GtkPaned ref={panedRef} startChild={<GtkLabel ref={labelRef} label="Start Content" />} />);

        expect(panedRef.current?.getStartChild()).toBe(labelRef.current);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();

        function App({ showTitle }: { showTitle: boolean }) {
            return <GtkHeaderBar ref={headerBarRef} titleWidget={showTitle ? "Title" : undefined} />;
        }

        await render(<App showTitle />);

        expect(headerBarRef.current?.getTitleWidget()).not.toBeNull();

        await render(<App showTitle={false} />);

        expect(headerBarRef.current?.getTitleWidget()).toBeNull();
    });
});

describe("render - Slot (2)", () => {
    it("updates slot when child changes", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();

        function App({ first }: { first: boolean }) {
            return (
                <GtkHeaderBar
                    ref={headerBarRef}
                    titleWidget={
                        first ? (
                            <GtkLabel ref={label1Ref} key="first" label="First Title" />
                        ) : (
                            <GtkLabel ref={label2Ref} key="second" label="Second Title" />
                        )
                    }
                />
            );
        }

        await render(<App first={true} />);

        expect(headerBarRef.current?.getTitleWidget()).toBe(label1Ref.current);

        await render(<App first={false} />);

        expect(headerBarRef.current?.getTitleWidget()).toBe(label2Ref.current);
    });

    it("handles Paned.StartChild slot", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const labelRef = createRef<Gtk.Label>();

        await render(<GtkPaned ref={panedRef} startChild={<GtkLabel ref={labelRef} label="Start Child" />} />);

        expect(panedRef.current?.getStartChild()).toBe(labelRef.current);
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton ref={menuButtonRef} popover={<GtkPopover ref={popoverRef}>Popover Content</GtkPopover>} />,
        );

        expect(menuButtonRef.current?.getPopover()).toBe(popoverRef.current);
    });
});

describe("render - Slot (3)", () => {
    it("handles multiple slots on same parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const startRef = createRef<Gtk.Label>();
        const endRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned
                ref={panedRef}
                startChild={<GtkLabel ref={startRef} label="Start" />}
                endChild={<GtkLabel ref={endRef} label="End" />}
            />,
        );

        expect(panedRef.current?.getStartChild()).toBe(startRef.current);
        expect(panedRef.current?.getEndChild()).toBe(endRef.current);
    });

    it("throws when the slot id has no matching property setter on the parent", async () => {
        await expect(
            render(<GtkBox>{createElement("Slot", { id: "non-existent-slot" }, <GtkLabel label="orphan" />)}</GtkBox>),
        ).rejects.toThrow(/Unable to find property for Slot 'nonExistentSlot'/);
    });
});
