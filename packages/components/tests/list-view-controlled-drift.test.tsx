import type { ListItem, ListViewProps } from "@gtkx/components";
import type { ReactNode } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";

type Named = { name: string };
type ControlledProps = Pick<ListViewProps<Named>, "selectedIds" | "expandedIds">;

type DriftFixture = {
    model: Gtk.SelectionModel;
    rerenderItems: () => Promise<void>;
};

const SELECTED_IDS = ["b"];
const EXPANDED_IDS = ["p-0"];
const EXPANDED_ROW_COUNT = 3;

const flatItems = (): ListItem<Named>[] => ["a", "b", "c"].map((id) => ({ id, value: { name: id } }));

const treeItems = (): ListItem<Named>[] => [
    { id: "p-0", value: { name: "p-0" }, children: [{ id: "p-0-c-0", value: { name: "p-0-c-0" } }] },
    { id: "p-1", value: { name: "p-1" } },
];

const renderName = ({ item }: { item: Named }): ReactNode => <GtkLabel>{item.name}</GtkLabel>;

const renderDriftFixture = async (
    items: () => ListItem<Named>[],
    controlled: ControlledProps,
): Promise<DriftFixture> => {
    const listRef = createRef<Gtk.ListView>();

    const app = (data: ListItem<Named>[]): ReactNode => (
        <ScrollWrapper>
            <ListView<Named> ref={listRef} items={data} renderItem={renderName} {...controlled} />
        </ScrollWrapper>
    );

    const { rerender } = await render(app(items()));

    return {
        model: getSelectionModel(listRef),
        rerenderItems: async () => {
            await rerender(app(items()));
        },
    };
};

describe("render - ListView - controlled props re-assert over widget drift", () => {
    it("restores selectedIds after the widget selects another row on its own", async () => {
        const { model, rerenderItems } = await renderDriftFixture(flatItems, { selectedIds: SELECTED_IDS });

        await waitFor(() => {
            expect(model.isSelected(1)).toBe(true);
        });

        await act(() => {
            model.selectItem(0, true);
        });

        await rerenderItems();

        await waitFor(() => {
            expect(model.isSelected(0)).toBe(false);
            expect(model.isSelected(1)).toBe(true);
        });
    });

    it("restores expandedIds after a row collapses itself", async () => {
        const { model, rerenderItems } = await renderDriftFixture(treeItems, { expandedIds: EXPANDED_IDS });

        await waitFor(() => {
            expect(model.getNItems()).toBe(EXPANDED_ROW_COUNT);
        });

        await act(() => {
            getTreeRow(model, 0).setExpanded(false);
        });

        await rerenderItems();

        await waitFor(() => {
            expect(model.getNItems()).toBe(EXPANDED_ROW_COUNT);
        });
    });
});
