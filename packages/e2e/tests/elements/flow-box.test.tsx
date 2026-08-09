import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkFlowBox, GtkFlowBoxChild, GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { render, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const renderChildren = async (
    mode: GtkNs.SelectionMode,
): Promise<RefObject<Gtk.FlowBoxChild | null>[]> => {
    const refs = [createRef<Gtk.FlowBoxChild>(), createRef<Gtk.FlowBoxChild>(), createRef<Gtk.FlowBoxChild>()];

    await render(
        <GtkFlowBox selectionMode={mode}>
            {refs.map((ref, index) => (
                <GtkFlowBoxChild key={index} ref={ref}>
                    <GtkLabel label={`Child ${String(index)}`} />
                </GtkFlowBoxChild>
            ))}
        </GtkFlowBox>,
    );

    return refs;
};

const getSelection = (refs: RefObject<Gtk.FlowBoxChild | null>[]): boolean[] =>
    refs.map((ref) => ref.current?.isSelected() ?? false);

describe("userEvent selection - FlowBox", () => {
    it("selects the child at a position", async () => {
        const refs = await renderChildren(GtkNs.SelectionMode.SINGLE);
        const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
        await userEvent.selectOptions(flowBox, 1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("selects several children when the mode allows it", async () => {
        const refs = await renderChildren(GtkNs.SelectionMode.MULTIPLE);
        const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
        await userEvent.selectOptions(flowBox, [0, 2]);
        expect(getSelection(refs)).toEqual([true, false, true]);
    });
});

describe("userEvent deselection - populated containers", () => {
    it("deselects a selected child and leaves an unselected one alone", async () => {
        const refs = await renderChildren(GtkNs.SelectionMode.MULTIPLE);
        const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
        await userEvent.selectOptions(flowBox, [0, 2]);
        expect(getSelection(refs)).toEqual([true, false, true]);
        await userEvent.deselectOptions(flowBox, 2);
        expect(getSelection(refs)).toEqual([true, false, false]);
        await userEvent.deselectOptions(flowBox, 1);
        expect(getSelection(refs)).toEqual([true, false, false]);
    });
});

describe("userEvent deselection - empty containers", () => {
    it("is a no-op on a list box with no rows", async () => {
        const ref = createRef<Gtk.ListBox>();
        await render(<GtkListBox ref={ref} selectionMode={GtkNs.SelectionMode.MULTIPLE} />);
        await expect(userEvent.deselectOptions(ref.current as Gtk.ListBox, 0)).resolves.toBeUndefined();
    });

    it("is a no-op on a flow box with no children", async () => {
        const ref = createRef<Gtk.FlowBox>();
        await render(<GtkFlowBox ref={ref} selectionMode={GtkNs.SelectionMode.MULTIPLE} />);
        await expect(userEvent.deselectOptions(ref.current as Gtk.FlowBox, 0)).resolves.toBeUndefined();
    });
});
