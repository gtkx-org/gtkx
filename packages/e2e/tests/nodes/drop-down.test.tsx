import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkDropDown } from "@gtkx/react";
import { act, render, screen } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

const valueItems = (values: string[]): Array<{ id: string; value: string }> =>
    values.map((value, index) => ({ id: String(index + 1), value }));

const buildDropDown = (dropDownRef: RefObject<Gtk.DropDown | null>) => (items: string[]) => (
    <GtkDropDown ref={dropDownRef} items={valueItems(items)} />
);

const expectSelectedText = async (dropDown: Gtk.DropDown | null, index: number, text: string): Promise<void> => {
    await act(() => dropDown?.setSelected(index));
    expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
};

describe("render - DropDown > DropDownNode (1)", () => {
    it("creates DropDown widget", async () => {
        const ref = createRef<Gtk.DropDown>();

        await render(<GtkDropDown ref={ref} />);

        expect(ref.current).not.toBeNull();
    });

    it("populates with items", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        await render(<GtkDropDown ref={dropDownRef} items={valueItems(["Option 1", "Option 2", "Option 3"])} />);

        expect(screen.queryAllByText("Option 1").length).toBeGreaterThan(0);

        await expectSelectedText(dropDownRef.current, 1, "Option 2");
        await expectSelectedText(dropDownRef.current, 2, "Option 3");
    });

    it("sets selected item by id", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        await render(
            <GtkDropDown ref={dropDownRef} selectedId="2" items={valueItems(["Option 1", "Option 2", "Option 3"])} />,
        );

        expect(dropDownRef.current?.getSelected()).toBe(1);
    });
});

describe("render - DropDown > DropDownNode (2)", () => {
    it("calls onSelectionChanged when selection changes", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();
        const onSelectionChanged = vi.fn();

        await render(
            <GtkDropDown
                ref={dropDownRef}
                onSelectionChanged={onSelectionChanged}
                items={valueItems(["Option 1", "Option 2"])}
            />,
        );

        await act(() => dropDownRef.current?.setSelected(1));

        expect(onSelectionChanged).toHaveBeenCalledWith("2");
    });

    it("updates items dynamically", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        const { rerender } = await renderChildren(["First", "Second"], buildDropDown(dropDownRef));
        expect(screen.queryAllByText("First").length).toBeGreaterThan(0);

        await expectSelectedText(dropDownRef.current, 1, "Second");

        await rerender(["First", "Second", "Third"]);

        await expectSelectedText(dropDownRef.current, 2, "Third");
    });

    it("removes items", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        const { rerender } = await renderChildren(["First", "Second", "Third"], buildDropDown(dropDownRef));

        await expectSelectedText(dropDownRef.current, 2, "Third");

        await rerender(["First"]);
        expect(screen.queryAllByText("First").length).toBeGreaterThan(0);
        expect(screen.queryAllByText("Second")).toHaveLength(0);
        expect(screen.queryAllByText("Third")).toHaveLength(0);
    });
});
