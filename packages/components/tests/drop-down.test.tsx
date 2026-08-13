import type { ReactNode, RefObject } from "react";
import { DropDown } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { valueItems } from "./helpers/list-fixtures.js";
import { expectTextPresent } from "./helpers/text-presence.js";

type IdItem = { id: string; value: string };

type RemovalCase = {
    selectedId?: string | undefined;
    initialPosition: number;
    removedId: string;
};

const SECTIONS = [
    { id: "letters", value: "Letters", data: [{ id: "a", value: "Alpha" }] },
    { id: "numbers", value: "Numbers", data: [{ id: "1", value: "One" }] },
];

const abcItems = (): IdItem[] => [
    { id: "a", value: "First" },
    { id: "b", value: "Second" },
    { id: "c", value: "Third" },
];

const openDropDownList = async (): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX));
};

const expectOptionSelected = async (dropDown: Gtk.DropDown, index: number, text: string): Promise<void> => {
    await userEvent.selectOptions(dropDown, index);

    await waitFor(() => {
        expect(dropDown).toHaveDisplayValue(text);
    });
};

const idAtSelected = (dropDown: Gtk.DropDown | null, items: IdItem[]): string | undefined =>
    items[dropDown?.getSelected() ?? -1]?.id;

const drawSections = (hasHeaders: boolean): ReactNode =>
    hasHeaders
        ? (
                <DropDown
                    renderHeader={({ section: value }: { section: string }) => <GtkLabel>{value}</GtkLabel>}
                    sections={SECTIONS}
                />
            )
        : (
                <DropDown sections={SECTIONS} />
            );

const expectRemovalReported = async (options: RemovalCase): Promise<void> => {
    const ref = createRef<Gtk.DropDown>();
    const onSelectionChanged = vi.fn();
    const remaining = abcItems().filter((item) => item.id !== options.removedId);

    const draw = (items: IdItem[]): ReactNode => (
        <DropDown ref={ref} selectedId={options.selectedId} onSelectionChanged={onSelectionChanged} items={items} />
    );

    const { rerender } = await render(draw(abcItems()));

    await waitFor(() => {
        expect(ref.current).toHaveObjectProperty("selected", options.initialPosition);
    });

    expect(onSelectionChanged).not.toHaveBeenCalled();
    await rerender(draw(remaining));

    await waitFor(() => {
        expect(onSelectionChanged).toHaveBeenCalledTimes(1);
    });

    expect(onSelectionChanged).toHaveBeenCalledWith(idAtSelected(ref.current, remaining));
};

const dropDownRef = (): RefObject<Gtk.DropDown> => {
    const ref = createRef<Gtk.DropDown>();

    return ref as RefObject<Gtk.DropDown>;
};

describe("DropDown", () => {
    it("renders its items and follows additions and removals", async () => {
        const ref = dropDownRef();
        const draw = (values: string[]): ReactNode => <DropDown ref={ref} items={valueItems(values)} />;
        const { rerender } = await render(draw(["First", "Second"]));

        await waitFor(() => {
            expect(ref.current).toHaveDisplayValue("First");
        });

        await expectOptionSelected(ref.current, 1, "Second");
        await rerender(draw(["First", "Second", "Third"]));
        await expectOptionSelected(ref.current, 2, "Third");
        await rerender(draw(["First"]));

        await waitFor(() => {
            expect(screen.queryAllByText("Second")).toHaveLength(0);
            expect(screen.queryAllByText("Third")).toHaveLength(0);
        });
    });

    it("selects the item selectedId names and reports what the user picks", async () => {
        const ref = dropDownRef();
        const onSelectionChanged = vi.fn();

        await render(
            <DropDown
                ref={ref}
                selectedId="2"
                onSelectionChanged={onSelectionChanged}
                items={valueItems(["Option 1", "Option 2", "Option 3"])}
            />,
        );

        await waitFor(() => {
            expect(ref.current).toHaveObjectProperty("selected", 1);
        });

        await userEvent.selectOptions(ref.current, 2);

        await waitFor(() => {
            expect(onSelectionChanged).toHaveBeenCalledWith("3");
        });
    });
});

describe("DropDown controlled selection", () => {
    it("reports the new effective id when the selected item is removed", async () => {
        await expectRemovalReported({ initialPosition: 0, removedId: "a" });
        await expectRemovalReported({ selectedId: "b", initialPosition: 1, removedId: "b" });
    });

    it("stays quiet when a controlled apply lands on the requested id", async () => {
        const ref = dropDownRef();
        const onSelectionChanged = vi.fn();

        const draw = (selectedId: string): ReactNode => (
            <DropDown ref={ref} selectedId={selectedId} onSelectionChanged={onSelectionChanged} items={abcItems()} />
        );

        const { rerender } = await render(draw("a"));

        await waitFor(() => {
            expect(ref.current).toHaveObjectProperty("selected", 0);
        });

        await rerender(draw("c"));

        await waitFor(() => {
            expect(ref.current).toHaveObjectProperty("selected", 2);
        });

        expect(onSelectionChanged).not.toHaveBeenCalled();
    });
});

describe("DropDown sections", () => {
    it("renders section headers only when renderHeader is given", async () => {
        const { rerender } = await render(drawSections(true));
        await openDropDownList();
        await expectTextPresent("Letters");
        await expectTextPresent("Numbers");
        await expectTextPresent("Alpha");
        await rerender(drawSections(false));
        await openDropDownList();
        await screen.findAllByText("Alpha");
        expect(screen.queryAllByText("Letters")).toHaveLength(0);
    });

    it("renders item labels as direct cell children", async () => {
        const ref = dropDownRef();
        await render(<DropDown ref={ref} items={valueItems(["Alpha", "Beta"])} />);
        const labels = await screen.findAllByText("Alpha");
        expect(ref.current).toHaveDisplayValue("Alpha");

        for (const label of labels) {
            expect(label.getParent()).not.toBeInstanceOf(Gtk.Box);
        }
    });
});
