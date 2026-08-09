import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

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
