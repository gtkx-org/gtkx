import { ColumnView, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it, vi } from "vitest";

type Task = { id: string; title: string };

const TASKS: Task[] = [
    { id: "a", title: "Buy milk" },
    { id: "b", title: "Walk dog" },
    { id: "c", title: "Write docs" },
];

function SelectScreen({ listRef }: { listRef: RefObject<Gtk.ListView | null> }) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const visible = TASKS.filter(() => true);
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`${selectedIds.length} selected`}</GtkLabel>
            <GtkButton label="Select All" onClicked={() => setSelectedIds(visible.map((task) => task.id))} />
            <GtkScrolledWindow vexpand minContentHeight={300}>
                <ListView<Task>
                    ref={listRef}
                    items={visible.map((task) => ({ id: task.id, value: task }))}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    selectedIds={selectedIds}
                    onSelectionChanged={setSelectedIds}
                    estimatedItemHeight={56}
                    renderItem={({ item }) => <GtkLabel>{item.title}</GtkLabel>}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
}

function ControlledColumnView({
    columnViewRef,
    selectedIds,
    onSelectionChanged,
}: {
    columnViewRef: RefObject<Gtk.ColumnView | null>;
    selectedIds: string[];
    onSelectionChanged: (ids: string[]) => void;
}) {
    return (
        <GtkScrolledWindow vexpand minContentHeight={300}>
            <ColumnView<Task>
                ref={columnViewRef}
                items={TASKS.map((task) => ({ id: task.id, value: task }))}
                selectionMode={Gtk.SelectionMode.MULTIPLE}
                selectedIds={selectedIds}
                onSelectionChanged={onSelectionChanged}
                estimatedItemHeight={56}
                columns={[
                    {
                        id: "title",
                        title: "Title",
                        expand: true,
                        renderCell: ({ item }) => <GtkLabel>{item.title}</GtkLabel>,
                    },
                ]}
            />
        </GtkScrolledWindow>
    );
}

describe("render - ColumnView - controlled selection updates", () => {
    it("applies a selectedIds change after mount without spurious onSelectionChanged calls", async () => {
        const columnViewRef = createRef<Gtk.ColumnView>();
        const onSelectionChanged = vi.fn();

        const { rerender } = await render(
            <ControlledColumnView
                columnViewRef={columnViewRef}
                selectedIds={[]}
                onSelectionChanged={onSelectionChanged}
            />,
        );
        onSelectionChanged.mockClear();

        await rerender(
            <ControlledColumnView
                columnViewRef={columnViewRef}
                selectedIds={["a", "c"]}
                onSelectionChanged={onSelectionChanged}
            />,
        );

        await waitFor(() => {
            const model = (columnViewRef.current as Gtk.ColumnView).getModel() as Gtk.MultiSelection;
            expect(model.getSelection().getSize()).toBe(2n);
            expect(model.isSelected(0)).toBe(true);
            expect(model.isSelected(1)).toBe(false);
            expect(model.isSelected(2)).toBe(true);
        });
        expect(onSelectionChanged.mock.calls).toEqual([[["a", "c"]]]);
    });
});

describe("render - ListView - controlled multi-selection feedback", () => {
    it("updates parent state when a row is selected", async () => {
        const listRef = createRef<Gtk.ListView>();
        await render(<SelectScreen listRef={listRef} />);

        await userEvent.selectOptions(listRef.current as Gtk.ListView, 0);

        await waitFor(() => {
            expect(screen.queryAllByText("1 selected")).toHaveLength(1);
        });
    });

    it("selects every row when Select All updates selectedIds", async () => {
        const listRef = createRef<Gtk.ListView>();
        await render(<SelectScreen listRef={listRef} />);

        const selectAll = screen.getByText("Select All");
        await userEvent.click(selectAll);

        await waitFor(() => {
            expect(screen.queryAllByText("3 selected")).toHaveLength(1);
            const model = (listRef.current as Gtk.ListView).getModel() as Gtk.MultiSelection;
            expect(model.getSelection().getSize()).toBe(3n);
        });
    });
});
