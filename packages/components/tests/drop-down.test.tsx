import { DropDown } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { valueItems } from "./helpers/list-fixtures.js";
import { renderChildren } from "./helpers/render-children.js";
import { expectTextPresent } from "./helpers/text-presence.js";

type IdItem = { id: string; value: string };

const buildDropDown = (dropDownRef: RefObject<Gtk.DropDown | null>) => (items: string[]) => (
    <DropDown ref={dropDownRef} items={valueItems(items)} />
);

const expectSelectedText = async (dropDown: Gtk.DropDown | null, index: number, text: string): Promise<void> => {
    if (dropDown) {
        await userEvent.selectOptions(dropDown, index);
    }

    await expectTextPresent(text);
};

const abcItems = (): IdItem[] => [
    { id: "a", value: "First" },
    { id: "b", value: "Second" },
    { id: "c", value: "Third" },
];

const idAtSelected = (dropDown: Gtk.DropDown | null, items: IdItem[]): string | undefined =>
    items[dropDown?.getSelected() ?? -1]?.id;

const expectRemovalReported = async (options: {
    selectedId?: string | undefined;
    initialPosition: number;
    removedId: string;
}): Promise<void> => {
    const dropDownRef = createRef<Gtk.DropDown>();
    const onSelectionChanged = vi.fn();
    const remaining = abcItems().filter((item) => item.id !== options.removedId);

    const draw = (items: IdItem[]) => (
        <DropDown
            ref={dropDownRef}
            selectedId={options.selectedId}
            onSelectionChanged={onSelectionChanged}
            items={items}
        />
    );

    const { rerender } = await renderChildren(abcItems(), draw);

    await waitFor(() => {
        expect(dropDownRef.current).toHaveObjectProperty("selected", options.initialPosition);
    });

    expect(onSelectionChanged).not.toHaveBeenCalled();
    await rerender(remaining);

    await waitFor(() => {
        expect(onSelectionChanged).toHaveBeenCalledTimes(1);
    });

    const effective = idAtSelected(dropDownRef.current, remaining);
    expect(effective).toBeDefined();
    expect(onSelectionChanged).toHaveBeenCalledWith(effective);
};

describe("render - DropDown (1)", () => {
    it("creates DropDown widget", async () => {
        const ref = createRef<Gtk.DropDown>();
        await render(<DropDown ref={ref} />);
        expect(ref.current).not.toBeNull();
    });

    it("populates with items", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();
        await render(<DropDown ref={dropDownRef} items={valueItems(["Option 1", "Option 2", "Option 3"])} />);
        await expectTextPresent("Option 1");
        await expectSelectedText(dropDownRef.current, 1, "Option 2");
        await expectSelectedText(dropDownRef.current, 2, "Option 3");
    });

    it("sets selected item by id", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();

        await render(
            <DropDown ref={dropDownRef} selectedId="2" items={valueItems(["Option 1", "Option 2", "Option 3"])} />,
        );

        await waitFor(() => {
            expect(dropDownRef.current).toHaveObjectProperty("selected", 1);
        });
    });
});

describe("render - DropDown (2)", () => {
    it("calls onSelectionChanged when selection changes", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();
        const onSelectionChanged = vi.fn();

        await render(
            <DropDown
                ref={dropDownRef}
                onSelectionChanged={onSelectionChanged}
                items={valueItems(["Option 1", "Option 2"])}
            />,
        );

        if (dropDownRef.current) {
            await userEvent.selectOptions(dropDownRef.current, 1);
        }

        await waitFor(() => {
            expect(onSelectionChanged).toHaveBeenCalledWith("2");
        });
    });

    it("updates items dynamically", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();
        const { rerender } = await renderChildren(["First", "Second"], buildDropDown(dropDownRef));
        await expectTextPresent("First");
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

describe("render - DropDown (3)", () => {
    const sections = [
        { id: "letters", value: "Letters", data: [{ id: "a", value: "Alpha" }] },
        { id: "numbers", value: "Numbers", data: [{ id: "1", value: "One" }] },
    ];

    it("renders section headers when renderHeader is provided on a sectioned dropdown", async () => {
        await render(
            <DropDown
                renderHeader={({ section: value }: { section: string }) => <GtkLabel>{value}</GtkLabel>}
                sections={sections}
            />,
        );

        await expectTextPresent("Letters");
        await expectTextPresent("Numbers");
        await expectTextPresent("Alpha");
        await expectTextPresent("One");
    });

    it("renders no section headers when renderHeader is omitted", async () => {
        await render(<DropDown sections={sections} />);
        await screen.findAllByText("Alpha");
        await screen.findAllByText("One");
        expect(screen.queryAllByText("Letters")).toHaveLength(0);
        expect(screen.queryAllByText("Numbers")).toHaveLength(0);
    });
});

describe("render - DropDown (4)", () => {
    it("renders item labels as direct cell children with no wrapper container", async () => {
        await render(<DropDown items={valueItems(["Alpha", "Beta"])} />);
        const labels = await screen.findAllByText("Alpha");
        expect(labels.length).toBeGreaterThan(0);

        for (const label of labels) {
            expect(label.getParent()).not.toBeInstanceOf(Gtk.Box);
        }
    });
});

describe("render - DropDown (5)", () => {
    it("reports the new effective id once when the selected item is removed", async () => {
        await expectRemovalReported({ initialPosition: 0, removedId: "a" });
    });

    it("reports the effective fallback when the controlled selectedId disappears", async () => {
        await expectRemovalReported({ selectedId: "b", initialPosition: 1, removedId: "b" });
    });

    it("does not report when a controlled apply lands on the requested id", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();
        const onSelectionChanged = vi.fn();

        const draw = (selectedId: string) => (
            <DropDown
                ref={dropDownRef}
                selectedId={selectedId}
                onSelectionChanged={onSelectionChanged}
                items={abcItems()}
            />
        );

        const { rerender } = await render(draw("a"));

        await waitFor(() => {
            expect(dropDownRef.current).toHaveObjectProperty("selected", 0);
        });

        await rerender(draw("c"));

        await waitFor(() => {
            expect(dropDownRef.current).toHaveObjectProperty("selected", 2);
        });

        expect(onSelectionChanged).not.toHaveBeenCalled();
    });
});
