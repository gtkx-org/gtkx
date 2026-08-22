import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

type BoxProbeProps = {
    boxRef: RefObject<Gtk.ListBox | null>;
    count: number;
    selectedIndex?: number;
    onRowSelected?: () => void;
};

const BoxProbe = ({ boxRef, count, selectedIndex, onRowSelected }: BoxProbeProps) => (
    <GtkListBox ref={boxRef} selectedIndex={selectedIndex} onRowSelected={onRowSelected}>
        {Array.from({ length: count }, (_unused, index) => (
            <GtkListBoxRow key={index}>
                <GtkLabel label={`Row ${String(index)}`} />
            </GtkListBoxRow>
        ))}
    </GtkListBox>
);

const selectedIndexOf = (box: Gtk.ListBox | null): number => box?.getSelectedRow()?.getIndex() ?? -1;

const renderProbe = async (props: Omit<BoxProbeProps, "boxRef">) => {
    const boxRef = createRef<Gtk.ListBox>();
    const result = await render(<BoxProbe boxRef={boxRef} {...props} />);

    return { boxRef, ...result };
};

describe("list box selection (1)", () => {
    it("selects the row at the given index", async () => {
        const { boxRef } = await renderProbe({ count: 3, selectedIndex: 1 });
        expect(selectedIndexOf(boxRef.current)).toBe(1);
    });

    it("follows the prop when it changes", async () => {
        const { boxRef, rerender } = await renderProbe({ count: 3, selectedIndex: 1 });
        await rerender(<BoxProbe boxRef={boxRef} count={3} selectedIndex={2} />);
        expect(selectedIndexOf(boxRef.current)).toBe(2);
    });

    it("clears the selection for -1", async () => {
        const { boxRef, rerender } = await renderProbe({ count: 3, selectedIndex: 1 });
        await rerender(<BoxProbe boxRef={boxRef} count={3} selectedIndex={-1} />);
        expect(selectedIndexOf(boxRef.current)).toBe(-1);
    });
});

describe("list box selection (2)", () => {
    it("waits for a row that no commit has added yet, holding the selection it has", async () => {
        const { boxRef, rerender } = await renderProbe({ count: 3, selectedIndex: 1 });
        await rerender(<BoxProbe boxRef={boxRef} count={3} selectedIndex={4} />);
        expect(selectedIndexOf(boxRef.current)).toBe(1);
        await rerender(<BoxProbe boxRef={boxRef} count={5} selectedIndex={4} />);
        expect(selectedIndexOf(boxRef.current)).toBe(4);
    });

    it("puts the selection back when the box drifts from the prop", async () => {
        const { boxRef, rerender } = await renderProbe({ count: 3, selectedIndex: 1 });
        const box = boxRef.current as Gtk.ListBox;

        await act(() => {
            box.selectRow(box.getRowAtIndex(2));
        });

        expect(selectedIndexOf(box)).toBe(2);
        await rerender(<BoxProbe boxRef={boxRef} count={4} selectedIndex={1} />);
        expect(selectedIndexOf(box)).toBe(1);
    });

    it("leaves the selection alone while the prop is absent", async () => {
        const { boxRef, rerender } = await renderProbe({ count: 3, selectedIndex: 1 });
        const box = boxRef.current as Gtk.ListBox;
        await rerender(<BoxProbe boxRef={boxRef} count={3} />);

        await act(() => {
            box.selectRow(box.getRowAtIndex(2));
        });

        await rerender(<BoxProbe boxRef={boxRef} count={4} />);
        expect(selectedIndexOf(box)).toBe(2);
    });

    it("does not report its own write as a row the user selected", async () => {
        const handleRowSelected = vi.fn();
        const { boxRef, rerender } = await renderProbe({ count: 3, selectedIndex: 0, onRowSelected: handleRowSelected });
        handleRowSelected.mockClear();

        await rerender(
            <BoxProbe boxRef={boxRef} count={3} selectedIndex={2} onRowSelected={handleRowSelected} />,
        );

        expect(selectedIndexOf(boxRef.current)).toBe(2);
        expect(handleRowSelected).not.toHaveBeenCalled();
    });
});
