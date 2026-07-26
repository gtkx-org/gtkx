import * as Gtk from "@gtkx/gi/gtk";
import { GtkHeaderBar, GtkLabel, GtkMenuButton, GtkPaned, GtkPopover } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const expectPanedStartChild = async (label: string) => {
    const panedRef = createRef<Gtk.Paned>();
    const labelRef = createRef<Gtk.Label>();
    await render(<GtkPaned ref={panedRef} startChild={<GtkLabel ref={labelRef}>{label}</GtkLabel>} />);
    expect(panedRef.current?.getStartChild()).toBe(labelRef.current);
};

describe("render - Slot (1)", () => {
    it("sets slot child via ReactNode prop", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        await render(
            <GtkHeaderBar ref={headerBarRef} titleWidget={<GtkLabel ref={titleRef}>Custom Title</GtkLabel>} />,
        );

        expect(headerBarRef.current?.getTitleWidget()).toBe(titleRef.current);
    });

    it("calls setSlotName(widget) on parent", async () => {
        await expectPanedStartChild("Start Content");
    });

    it("accepts a constructed widget instance through a slot prop", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const title = new Gtk.Label({ label: "Imperative Title" });
        await render(<GtkHeaderBar ref={headerBarRef} titleWidget={title} />);
        expect(headerBarRef.current?.getTitleWidget()).toBe(title);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();

        function App({ showTitle }: { showTitle: boolean }) {
            return <GtkHeaderBar ref={headerBarRef} titleWidget={showTitle ? <GtkLabel>Title</GtkLabel> : undefined} />;
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
                        first
                            ? (
                                    <GtkLabel ref={label1Ref} key="first">
                                        First Title
                                    </GtkLabel>
                                )
                            : (
                                    <GtkLabel ref={label2Ref} key="second">
                                        Second Title
                                    </GtkLabel>
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
        await expectPanedStartChild("Start Child");
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton
                ref={menuButtonRef}
                popover={(
                    <GtkPopover ref={popoverRef}>
                        <GtkLabel>Popover Content</GtkLabel>
                    </GtkPopover>
                )}
            />,
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
                startChild={<GtkLabel ref={startRef}>Start</GtkLabel>}
                endChild={<GtkLabel ref={endRef}>End</GtkLabel>}
            />,
        );

        expect(panedRef.current?.getStartChild()).toBe(startRef.current);
        expect(panedRef.current?.getEndChild()).toBe(endRef.current);
    });
});
