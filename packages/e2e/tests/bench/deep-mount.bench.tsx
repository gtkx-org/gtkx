import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { bench, describe } from "vitest";

/**
 * Depths grown geometrically so an instruction-count gate (CodSpeed) sees a
 * flat per-level slope for the work that scales with ancestry depth — the
 * GType-ancestry slot walks in `createWidgetComponent` and per-level
 * attach-rule resolution — where the wide-mount bench in
 * `reconciler.bench.tsx` only scales sibling count.
 */
const DEPTHS = [25, 100];

const nestBoxes = (depth: number): ReactNode =>
    depth === 0 ? <GtkLabel label="leaf" /> : <GtkBox>{nestBoxes(depth - 1)}</GtkBox>;

describe("deep mount", () => {
    for (const depth of DEPTHS) {
        bench(`mount a chain of ${depth} nested boxes`, async () => {
            await render(nestBoxes(depth));
            await cleanup();
        });
    }
});
