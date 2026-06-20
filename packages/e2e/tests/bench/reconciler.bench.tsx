import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import type { ListItem } from "@gtkx/react";
import { cleanup, render } from "@gtkx/testing";
import { bench, describe } from "vitest";
import { renderListView } from "../helpers/list-fixtures.js";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

const SIZES = [100, 200, 400];

function makeSectionItems(n: number): ListItem<{ name: string }>[] {
    const perSection = 100;
    const sections: ListItem<{ name: string }>[] = [];
    for (let start = 0; start < n; start += perSection) {
        const children: ListItem<{ name: string }>[] = [];
        for (let i = start; i < Math.min(start + perSection, n); i++) {
            children.push({ id: `row-${i}`, value: { name: `row-${i}` } });
        }
        sections.push({ id: `sec-${start}`, section: true, value: { name: `Section ${start}` }, children });
    }
    return sections;
}

describe("selection apply", () => {
    for (const n of SIZES) {
        const items = makeSectionItems(n);
        const targetId = `row-${n - 1}`;

        bench(`multi-selection across ${n} items`, async () => {
            const { rerender } = await renderListView(items, { selectionMode: Gtk.SelectionMode.MULTIPLE });
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
