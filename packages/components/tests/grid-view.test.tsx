import { GridView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { expect, it } from "vitest";

it("renders a controlled grid, reports selection and releases its model on unmount", async () => {
    const ref = createRef<Gtk.GridView>();
    const selections: string[][] = [];
    const items = ["Alpha", "Beta"].map((value) => ({ id: value, value }));
    const grid = (selectedIds: string[]) => (
        <GridView
            ref={ref}
            items={items}
            selectedIds={selectedIds}
            selectionMode={Gtk.SelectionMode.SINGLE}
            estimatedItemHeight={40}
            estimatedItemWidth={80}
            onSelectionChanged={(ids) => selections.push(ids)}
            renderItem={({ item }) => <GtkLabel>{item}</GtkLabel>}
        />
    );
    const { rerender, unmount } = await render(grid(["Alpha"]));
    const model = ref.current?.getModel();
    expect(model?.isSelected(0)).toBe(true);
    await userEvent.click(await screen.findByText("Beta"));
    expect(selections).toContainEqual(["Beta"]);
    await rerender(grid(["Beta"]));
    await waitFor(() => expect(model?.isSelected(1)).toBe(true));
    expect(model?.isSelected(0)).toBe(false);
    await unmount();
    expect(ref.current).toBeNull();
    expect(screen.queryByText("Beta")).toBeNull();
});
