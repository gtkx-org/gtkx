import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { GtkDropDown } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

const valueItems = (values: string[]): Array<{ id: string; value: string }> =>
    values.map((value, index) => ({ id: String(index + 1), value }));

const buildDropDown = (dropDownRef: RefObject<Gtk.DropDown | null>) => (items: string[]) => (
    <GtkDropDown ref={dropDownRef} items={valueItems(items)} />
);

const expectSelectedText = async (dropDown: Gtk.DropDown | null, index: number, text: string): Promise<void> => {
    dropDown?.setSelected(index);
    await screen.findAllByText(text);
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

        await screen.findAllByText("Option 1");

        await expectSelectedText(dropDownRef.current, 1, "Option 2");
        await expectSelectedText(dropDownRef.current, 2, "Option 3");
    });

    it("sets selected item by id", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        await render(
            <GtkDropDown ref={dropDownRef} selectedId="2" items={valueItems(["Option 1", "Option 2", "Option 3"])} />,
        );

        await waitFor(() => expect(dropDownRef.current?.getSelected()).toBe(1));
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

        dropDownRef.current?.setSelected(1);

        await waitFor(() => expect(onSelectionChanged).toHaveBeenCalledWith("2"));
    });

    it("updates items dynamically", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        const { rerender } = await renderChildren(["First", "Second"], buildDropDown(dropDownRef));
        await screen.findAllByText("First");

        await expectSelectedText(dropDownRef.current, 1, "Second");

        await rerender(["First", "Second", "Third"]);

        await expectSelectedText(dropDownRef.current, 2, "Third");
    });

    it("removes items", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        const { rerender } = await renderChildren(["First", "Second", "Third"], buildDropDown(dropDownRef));

        await expectSelectedText(dropDownRef.current, 2, "Third");

        await rerender(["First"]);
        await waitFor(() => {
            expect(screen.queryAllByText("First").length).toBeGreaterThan(0);
            expect(screen.queryAllByText("Second")).toHaveLength(0);
            expect(screen.queryAllByText("Third")).toHaveLength(0);
        });
    });
});

describe("render - DropDown > DropDownNode (3)", () => {
    it("wires a header factory when renderHeader is provided on a sectioned dropdown", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        await render(
            <GtkDropDown
                ref={dropDownRef}
                renderHeader={(value: string) => <GtkLabel label={value} />}
                items={[
                    { id: "letters", value: "Letters", section: true, children: [{ id: "a", value: "Alpha" }] },
                    { id: "numbers", value: "Numbers", section: true, children: [{ id: "1", value: "One" }] },
                ]}
            />,
        );

        await waitFor(() => expect(dropDownRef.current?.getHeaderFactory()).not.toBeNull());
    });

    it("leaves the header factory unset when renderHeader is omitted", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        await render(<GtkDropDown ref={dropDownRef} items={valueItems(["One", "Two"])} />);

        expect(dropDownRef.current?.getHeaderFactory()).toBeNull();
    });
});
