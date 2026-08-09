import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkGestureClick, GtkLabel, GtkListBox, GtkListBoxRow, GtkNotebook } from "@gtkx/jsx/gtk";
import { queryAllControllers, render, screen, userEvent } from "@gtkx/testing";
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
    it("fires an ancestor's gesture instead of the gesture GTK gave the clicked widget", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const onPressed = vi.fn();

        await render(
            <GtkBox orientation={GtkNs.Orientation.VERTICAL} controllers={<GtkGestureClick onPressed={onPressed} />}>
                <GtkNotebook ref={notebookRef} />
            </GtkBox>,
        );

        await userEvent.click(notebookRef.current as Gtk.Notebook);
        expect(onPressed).toHaveBeenCalledTimes(1);
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

describe("userEvent click - container gestures", () => {
    it("fires a click gesture the list box carries when one of its row descendants is clicked", async () => {
        const onPressed = vi.fn();
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            {
                selectionMode: GtkNs.SelectionMode.SINGLE,
                onRowActivated,
                controllers: <GtkGestureClick onPressed={onPressed} />,
            },
            2,
        );

        await userEvent.click(screen.getByText("Row 1"));
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true]);
    });

    it("fires the widget's own click gesture when nothing else handles the click", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onPressed = vi.fn();
        await render(<GtkBox ref={boxRef} controllers={<GtkGestureClick onPressed={onPressed} />} />);
        await userEvent.click(boxRef.current as Gtk.Box);
        expect(onPressed).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent click - controller hygiene", () => {
    it("leaves no gesture behind on a gesture-less widget and still reaches the button", async () => {
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
        expect(queryAllControllers(box, GtkNs.GestureClick)).toHaveLength(0);
        await userEvent.click(box);
        expect(onClicked).toHaveBeenCalledTimes(1);
    });

    it("leaves no gesture behind on a widget a pointer click touched", async () => {
        const innerRef = createRef<Gtk.Box>();
        const onPressed = vi.fn();

        await render(
            <GtkBox controllers={<GtkGestureClick onPressed={onPressed} />}>
                <GtkBox ref={innerRef} orientation={GtkNs.Orientation.VERTICAL}>
                    <GtkLabel label="pointer box" />
                </GtkBox>
            </GtkBox>,
        );

        const inner = innerRef.current as Gtk.Box;
        await userEvent.pointer(inner, "click");
        expect(queryAllControllers(inner, GtkNs.GestureClick)).toHaveLength(0);
        await userEvent.click(screen.getByText("pointer box"));
        expect(onPressed).toHaveBeenCalledTimes(1);
    });

    it("leaves no gesture behind on the rows it clicks", async () => {
        const refs = await renderRowBox({ selectionMode: GtkNs.SelectionMode.SINGLE }, 3);
        await userEvent.click(screen.getByText("Row 0"));
        await userEvent.click(refs[1]?.current as Gtk.ListBoxRow);
        await userEvent.click(screen.getByText("Row 1"));

        expect(refs.map((ref) => queryAllControllers(ref.current as Gtk.ListBoxRow, GtkNs.GestureClick))).toEqual([
            [],
            [],
            [],
        ]);
    });
});

describe("userEvent click - repeat and non-activating containers", () => {
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

    it("activates the row on a double click when a single click already activates", async () => {
        const onRowActivated = vi.fn();
        const refs = await renderRowBox({ selectionMode: GtkNs.SelectionMode.SINGLE, onRowActivated }, 2);
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

describe("userEvent click - selection notifications", () => {
    it("never reports an empty selection while replacing it", async () => {
        const refs = await renderRowBox(
            { selectionMode: GtkNs.SelectionMode.MULTIPLE, activateOnSingleClick: false },
            3,
        );

        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        const reported: boolean[][] = [];

        listBox.on("selected-rows-changed", () => {
            reported.push(getSelection(refs));
        });

        await userEvent.click(screen.getByText("Row 1"));

        expect(reported).toEqual([
            [true, true, false],
            [false, true, false],
        ]);

        reported.length = 0;
        await userEvent.click(screen.getByText("Row 2"));

        expect(reported).toEqual([
            [false, true, true],
            [false, false, true],
        ]);
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
