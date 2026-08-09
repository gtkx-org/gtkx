import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkFlowBox, GtkFlowBoxChild, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { getSelection } from "../helpers/selection-state.js";

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

describe("userEvent selection - no activation side effects", () => {
    it("selects a list box row without activating it", async () => {
        const refs = [createRef<Gtk.ListBoxRow>(), createRef<Gtk.ListBoxRow>()];
        const boxRef = createRef<Gtk.ListBox>();
        const onRowActivated = vi.fn();

        await render(
            <GtkListBox ref={boxRef} selectionMode={GtkNs.SelectionMode.MULTIPLE} onRowActivated={onRowActivated}>
                {refs.map((ref, index) => (
                    <GtkListBoxRow key={index} ref={ref}>
                        <GtkLabel label={`Row ${String(index)}`} />
                    </GtkListBoxRow>
                ))}
            </GtkListBox>,
        );

        await userEvent.selectOptions(boxRef.current as Gtk.ListBox, 1);
        expect(getSelection(refs)[1]).toBe(true);
        expect(onRowActivated).not.toHaveBeenCalled();
        await userEvent.deselectOptions(boxRef.current as Gtk.ListBox, 1);
        expect(getSelection(refs)[1]).toBe(false);
        expect(onRowActivated).not.toHaveBeenCalled();
    });
});
