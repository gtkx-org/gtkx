import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { getSelection } from "../helpers/selection-state.js";

const ROW_COUNT = 5;

describe("userEvent click - row descendants", () => {
    it("activates the row owning the clicked label, not the row under the container centre", async () => {
        const refs = Array.from({ length: ROW_COUNT }, () => createRef<Gtk.ListBoxRow>());

        await render(
            <GtkBox orientation={GtkNs.Orientation.VERTICAL}>
                <GtkListBox selectionMode={GtkNs.SelectionMode.SINGLE}>
                    {refs.map((ref, index) => (
                        <GtkListBoxRow key={index} ref={ref}>
                            <GtkLabel label={`Row ${String(index)}`} />
                        </GtkListBoxRow>
                    ))}
                </GtkListBox>
            </GtkBox>,
        );

        await userEvent.click(screen.getByText("Row 3"));
        expect(getSelection(refs)).toEqual([false, false, false, true, false]);
        await userEvent.click(screen.getByText("Row 0"));
        expect(getSelection(refs)).toEqual([true, false, false, false, false]);
    });
});

describe("userEvent click - gesture-driven widgets", () => {
    it("fires a click gesture the widget itself carries", async () => {
        const ref = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={ref} orientation={GtkNs.Orientation.VERTICAL}>
                <GtkLabel label="content" />
            </GtkBox>,
        );

        const box = ref.current as Gtk.Box;
        const gesture = new GtkNs.GestureClick();
        const onPressed = vi.fn();
        gesture.on("pressed", onPressed);
        box.addController(gesture);
        await userEvent.click(box);
        expect(onPressed).toHaveBeenCalled();
    });
});

describe("userEvent click - repeat and non-activating containers", () => {
    it("still reaches the button after a double click synthesized a gesture", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onClicked = vi.fn();

        await render(
            <GtkButton onClicked={onClicked}>
                <GtkBox ref={boxRef} orientation={GtkNs.Orientation.VERTICAL}>
                    <GtkLabel label="inner" />
                </GtkBox>
            </GtkButton>,
        );

        const box = boxRef.current as Gtk.Box;
        await userEvent.dblClick(box);
        onClicked.mockClear();
        await userEvent.click(box);
        expect(onClicked).toHaveBeenCalled();
    });

    it("selects without activating when the list box does not activate on a single click", async () => {
        const refs = [createRef<Gtk.ListBoxRow>(), createRef<Gtk.ListBoxRow>()];
        const boxRef = createRef<Gtk.ListBox>();
        const onRowActivated = vi.fn();

        await render(
            <GtkBox orientation={GtkNs.Orientation.VERTICAL}>
                <GtkListBox
                    ref={boxRef}
                    selectionMode={GtkNs.SelectionMode.SINGLE}
                    activateOnSingleClick={false}
                    onRowActivated={onRowActivated}
                >
                    {refs.map((ref, index) => (
                        <GtkListBoxRow key={index} ref={ref}>
                            <GtkLabel label={`Row ${String(index)}`} />
                        </GtkListBoxRow>
                    ))}
                </GtkListBox>
            </GtkBox>,
        );

        await userEvent.click(screen.getByText("Row 1"));
        expect(onRowActivated).not.toHaveBeenCalled();
        expect(getSelection(refs)).toEqual([false, true]);
    });
});
