import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, type ListItem } from "@gtkx/react";
import { cleanup, render } from "@gtkx/testing";
import { bench, describe } from "vitest";
import { renderListView } from "../helpers/list-fixtures.js";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

/**
 * Sizes grown geometrically so an instruction-count gate (CodSpeed) sees a flat
 * per-item slope for the linear paths and a rising slope for any quadratic
 * regression: a quadratic in selection apply or child insertion makes the 2x
 * and 4x cases cost far more than 2x and 4x the base case. Kept modest because
 * the benches run under CodSpeed's Valgrind instrumentation, where exact
 * instruction counts make the slope visible without large inputs.
 */
const SIZES = [100, 200, 400];

/**
 * Section-mode items: the apply path that the GOLD report found quadratic
 * (`collectFlatItems` rebuilt per position). A regression to the per-position
 * rebuild makes resolving `n` positions cost `O(n²)`.
 */
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
            // Apply selection repeatedly so the O(N) apply path — not the one-time
            // render — dominates the measurement; reusing the same `items`
            // reference keeps the model in sync so only `applySelection` runs.
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
