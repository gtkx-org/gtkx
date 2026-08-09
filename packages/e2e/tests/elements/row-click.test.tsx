import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkGestureClick, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderRowBox } from "../helpers/row-box.js";
import { getSelection } from "../helpers/selection-state.js";

const expectSelectWithoutActivation = async (
    pickTarget: (refs: RefObject<Gtk.ListBoxRow | null>[]) => Gtk.Widget,
): Promise<void> => {
    const onRowActivated = vi.fn();

    const refs = await renderRowBox(
        { selectionMode: GtkNs.SelectionMode.SINGLE, activateOnSingleClick: false, onRowActivated },
        2,
    );

    await userEvent.click(pickTarget(refs));
    expect(onRowActivated).not.toHaveBeenCalled();
    expect(getSelection(refs)).toEqual([false, true]);
};

describe("userEvent click - row descendants", () => {
    it("activates the row owning the clicked label, not the row under the container centre", async () => {
        const refs = await renderRowBox({ selectionMode: GtkNs.SelectionMode.SINGLE }, 5);
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

    it("fires a click gesture the row carries when its label is clicked", async () => {
        const onPressed = vi.fn();
        const onRowActivated = vi.fn();

        await render(
            <GtkBox orientation={GtkNs.Orientation.VERTICAL}>
                <GtkListBox selectionMode={GtkNs.SelectionMode.SINGLE} onRowActivated={onRowActivated}>
                    <GtkListBoxRow controllers={<GtkGestureClick onPressed={onPressed} />}>
                        <GtkLabel label="Gestured row" />
                    </GtkListBoxRow>
                </GtkListBox>
            </GtkBox>,
        );

        await userEvent.click(screen.getByText("Gestured row"));
        expect(onPressed).toHaveBeenCalled();
        expect(onRowActivated).toHaveBeenCalledTimes(1);
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
        await expectSelectWithoutActivation(() => screen.getByText("Row 1"));
    });

    it("selects without activating when the row widget itself is clicked", async () => {
        await expectSelectWithoutActivation((refs) => refs[1]?.current as Gtk.ListBoxRow);
    });

    it("activates the row on a double click when a single click does not activate", async () => {
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            { selectionMode: GtkNs.SelectionMode.SINGLE, activateOnSingleClick: false, onRowActivated },
            2,
        );

        await userEvent.dblClick(refs[1]?.current as Gtk.ListBoxRow);
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true]);
    });
});

describe("userEvent click - multiple-selection list boxes", () => {
    it("replaces the selection across clicks when a single click does not activate", async () => {
        const refs = await renderRowBox(
            { selectionMode: GtkNs.SelectionMode.MULTIPLE, activateOnSingleClick: false },
            2,
        );

        await userEvent.click(screen.getByText("Row 0"));
        expect(getSelection(refs)).toEqual([true, false]);
        await userEvent.click(screen.getByText("Row 1"));
        expect(getSelection(refs)).toEqual([false, true]);
    });

    it("accumulates the selection when a single click also activates, as GTK does", async () => {
        const refs = await renderRowBox({ selectionMode: GtkNs.SelectionMode.MULTIPLE }, 2);
        await userEvent.click(screen.getByText("Row 0"));
        await userEvent.click(screen.getByText("Row 1"));
        expect(getSelection(refs)).toEqual([true, true]);
    });

    it("keeps the selection when the clicked row is not selectable", async () => {
        const refs = await renderRowBox(
            { selectionMode: GtkNs.SelectionMode.MULTIPLE, activateOnSingleClick: false },
            2,
            (index) => (index === 1 ? { selectable: false } : {}),
        );

        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([true, false]);
        await userEvent.click(screen.getByText("Row 1"));
        expect(getSelection(refs)).toEqual([true, false]);
    });
});

describe("userEvent click - selection mode NONE", () => {
    it("activates without selecting when a single click activates", async () => {
        const onRowActivated = vi.fn();
        const refs = await renderRowBox({ selectionMode: GtkNs.SelectionMode.NONE, onRowActivated }, 2);
        await userEvent.click(screen.getByText("Row 1"));
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, false]);
    });

    it("neither activates nor selects when a single click does not activate", async () => {
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            { selectionMode: GtkNs.SelectionMode.NONE, activateOnSingleClick: false, onRowActivated },
            2,
        );

        await userEvent.click(screen.getByText("Row 1"));
        expect(onRowActivated).not.toHaveBeenCalled();
        expect(getSelection(refs)).toEqual([false, false]);
    });
});
