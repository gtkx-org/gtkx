import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkFlowBox, GtkFlowBoxChild, GtkGestureClick, GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { queryAllControllers, render, screen, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderRowBox } from "../helpers/row-box.js";
import { getSelection } from "../helpers/selection-state.js";

type FlowBoxProps = Partial<ComponentProps<typeof GtkFlowBox>>;
type ActivatableChildren = { refs: RefObject<Gtk.FlowBoxChild | null>[]; onChildActivated: ReturnType<typeof vi.fn> };
type SelectedPair = { refs: RefObject<Gtk.FlowBoxChild | null>[]; flowBox: Gtk.FlowBox };

const renderChildren = async (props: FlowBoxProps): Promise<RefObject<Gtk.FlowBoxChild | null>[]> => {
    const refs = [createRef<Gtk.FlowBoxChild>(), createRef<Gtk.FlowBoxChild>(), createRef<Gtk.FlowBoxChild>()];

    await render(
        <GtkFlowBox {...props}>
            {refs.map((ref, index) => (
                <GtkFlowBoxChild key={index} ref={ref}>
                    <GtkLabel label={`Child ${String(index)}`} />
                </GtkFlowBoxChild>
            ))}
        </GtkFlowBox>,
    );

    return refs;
};

const renderSelectedPair = async (): Promise<SelectedPair> => {
    const refs = await renderChildren({ selectionMode: Gtk.SelectionMode.MULTIPLE });
    const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
    await userEvent.selectOptions(flowBox, [0, 2]);

    return { refs, flowBox };
};

const renderActivatableChildren = async (props: FlowBoxProps): Promise<ActivatableChildren> => {
    const onChildActivated = vi.fn();
    const refs = await renderChildren({ ...props, onChildActivated });

    return { refs, onChildActivated };
};

describe("userEvent selection - FlowBox", () => {
    it("selects the child at a position", async () => {
        const refs = await renderChildren({ selectionMode: Gtk.SelectionMode.SINGLE });
        const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
        await userEvent.selectOptions(flowBox, 1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("selects several children when the mode allows it", async () => {
        const { refs } = await renderSelectedPair();
        expect(getSelection(refs)).toEqual([true, false, true]);
    });
});

describe("userEvent deselection - populated containers", () => {
    it("deselects a selected child and leaves an unselected one alone", async () => {
        const { refs, flowBox } = await renderSelectedPair();
        expect(getSelection(refs)).toEqual([true, false, true]);
        await userEvent.deselectOptions(flowBox, 2);
        expect(getSelection(refs)).toEqual([true, false, false]);
        await userEvent.deselectOptions(flowBox, 1);
        expect(getSelection(refs)).toEqual([true, false, false]);
    });

    it("deselects a row in browse selection mode", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.BROWSE }, 2);
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([true, false]);
        await userEvent.deselectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([false, false]);
    });

    it("deselects the exact rows even when they cannot take focus", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE }, 2, (index) =>
            index === 1 ? { focusable: false } : {},
        );

        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, [0, 1]);
        expect(getSelection(refs)).toEqual([true, true]);
        await userEvent.deselectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([false, true]);
        await userEvent.deselectOptions(listBox, 1);
        expect(getSelection(refs)).toEqual([false, false]);
    });

    it("deselects a selected row that a filter keeps off screen", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE }, 2);
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, [0, 1]);
        expect(getSelection(refs)).toEqual([true, true]);
        listBox.setFilterFunc((row) => row !== refs[1]?.current);
        await userEvent.deselectOptions(listBox, 1);
        expect(getSelection(refs)).toEqual([true, false]);
    });
});

describe("userEvent deselection - empty containers", () => {
    it("is a no-op on a list box with no rows", async () => {
        const ref = createRef<Gtk.ListBox>();
        await render(<GtkListBox ref={ref} selectionMode={Gtk.SelectionMode.MULTIPLE} />);
        await expect(userEvent.deselectOptions(ref.current as Gtk.ListBox, 0)).resolves.toBeUndefined();
    });

    it("is a no-op on a flow box with no children", async () => {
        const ref = createRef<Gtk.FlowBox>();
        await render(<GtkFlowBox ref={ref} selectionMode={Gtk.SelectionMode.MULTIPLE} />);
        await expect(userEvent.deselectOptions(ref.current as Gtk.FlowBox, 0)).resolves.toBeUndefined();
    });
});

describe("userEvent click - flow box children", () => {
    it("activates the child owning the clicked label when a single click activates", async () => {
        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.SINGLE,
        });

        await userEvent.click(screen.getByText("Child 1"));
        expect(onChildActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("replaces the selection across clicks when a single click does not activate", async () => {
        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            activateOnSingleClick: false,
        });

        await userEvent.click(screen.getByText("Child 0"));
        expect(getSelection(refs)).toEqual([true, false, false]);
        await userEvent.click(screen.getByText("Child 2"));
        expect(onChildActivated).not.toHaveBeenCalled();
        expect(getSelection(refs)).toEqual([false, false, true]);
    });

    it("activates the child on a double click when a single click already activates", async () => {
        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.SINGLE,
        });

        await userEvent.dblClick(refs[1]?.current as Gtk.FlowBoxChild);
        expect(onChildActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("fires a click gesture the flow box carries when one of its child descendants is clicked", async () => {
        const onPressed = vi.fn();

        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.SINGLE,
            controllers: <GtkGestureClick onPressed={onPressed} />,
        });

        await userEvent.click(screen.getByText("Child 1"));
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onChildActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("leaves no gesture behind on the children it clicks", async () => {
        const refs = await renderChildren({ selectionMode: Gtk.SelectionMode.SINGLE });
        await userEvent.click(screen.getByText("Child 1"));
        await userEvent.dblClick(refs[2]?.current as Gtk.FlowBoxChild);

        expect(refs.map((ref) => queryAllControllers(ref.current as Gtk.FlowBoxChild, Gtk.GestureClick))).toEqual([
            [],
            [],
            [],
        ]);
    });
});

describe("userEvent selection - no activation side effects", () => {
    it("selects a list box row without activating it", async () => {
        const onRowActivated = vi.fn();
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE, onRowActivated }, 2);
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, 1);
        expect(getSelection(refs)[1]).toBe(true);
        expect(onRowActivated).not.toHaveBeenCalled();
        await userEvent.deselectOptions(listBox, 1);
        expect(getSelection(refs)[1]).toBe(false);
        expect(onRowActivated).not.toHaveBeenCalled();
    });
});
