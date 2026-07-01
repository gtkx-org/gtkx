import type { ItemNode } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { bench, describe } from "vitest";
import { renderListView } from "../tests/helpers/list-fixtures.js";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { ScrollWrapper } from "../tests/helpers/scroll-wrapper.js";

const SIZES = [100, 200, 400];

function makeItems(n: number): ItemNode<{ name: string }>[] {
    const items: ItemNode<{ name: string }>[] = [];
    for (let i = 0; i < n; i++) {
        items.push({ id: `row-${i}`, value: { name: `row-${i}` } });
    }
    return items;
}

describe("selection apply", () => {
    for (const n of SIZES) {
        const items = makeItems(n);
        const targetId = `row-${n - 1}`;

        bench(`multi-selection across ${n} items`, async () => {
            const { rerender } = await renderListView(items, { selectionMode: Gtk.SelectionMode.MULTIPLE }, render);
            for (let k = 0; k < 3; k++) {
                await rerender(items, { selectionMode: Gtk.SelectionMode.MULTIPLE, selected: [targetId] });
                await rerender(items, { selectionMode: Gtk.SelectionMode.MULTIPLE, selected: [] });
            }
            await cleanup();
        });
    }
});

describe("child insertion", () => {
    for (const n of SIZES) {
        const labels = Array.from({ length: n }, (_, i) => `label-${i}`).map((text) => (
            <GtkLabel key={text} label={text} />
        ));

        bench(`mount a box of ${n} children`, async () => {
            await render(
                <ScrollWrapper>
                    <GtkBox>{labels}</GtkBox>
                </ScrollWrapper>,
            );
            await cleanup();
        });
    }
});
