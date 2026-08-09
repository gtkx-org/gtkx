import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

const ROW_COUNT = 5;

const getSelection = (refs: RefObject<Gtk.ListBoxRow | null>[]): boolean[] =>
    refs.map((ref) => ref.current?.isSelected() ?? false);

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
