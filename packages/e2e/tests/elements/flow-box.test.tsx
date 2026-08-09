import type * as Gtk from "@gtkx/gi/gtk";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkFlowBox, GtkFlowBoxChild, GtkLabel } from "@gtkx/jsx/gtk";
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
