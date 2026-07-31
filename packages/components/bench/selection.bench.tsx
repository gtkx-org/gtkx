import type { ListItem } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { bench, describe } from "vitest";
import { renderListView } from "../tests/helpers/list-fixtures.js";
import { cleanup, render } from "../tests/helpers/production-render.js";

const SIZES = [100, 200, 400];

function makeItems(n: number): ListItem<{ name: string }>[] {
    const items: ListItem<{ name: string }>[] = [];

    for (let i = 0; i < n; i++) {
        items.push({ id: `row-${String(i)}`, value: { name: `row-${String(i)}` } });
    }

    return items;
}

describe("selection apply", () => {
    for (const n of SIZES) {
        const items = makeItems(n);
        const targetId = `row-${String(n - 1)}`;

        bench(`multi-selection across ${String(n)} items`, async () => {
            const { rerender } = await renderListView(items, { selectionMode: Gtk.SelectionMode.MULTIPLE }, render);

            for (let k = 0; k < 3; k++) {
                await rerender(items, { selectionMode: Gtk.SelectionMode.MULTIPLE, selected: [targetId] });
                await rerender(items, { selectionMode: Gtk.SelectionMode.MULTIPLE, selected: [] });
            }

            await cleanup();
        });
    }
});
