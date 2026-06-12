import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { bench, describe } from "vitest";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

/**
 * Sizes grown geometrically so an instruction-count gate (CodSpeed) sees a
 * flat per-item slope for the linear `applyProps` diff walk and a rising
 * slope for any quadratic regression. Kept modest because the benches run
 * under CodSpeed's Valgrind instrumentation, where exact instruction counts
 * make the slope visible without large inputs.
 */
const SIZES = [100, 400];

/**
 * Rebuilds the full element tree on every call so each rerender presents
 * fresh element objects to the reconciler and forces the per-instance prop
 * diff to run, with `suffix` deciding whether the diff finds a change.
 */
const drawLabels = (n: number, suffix: string): ReactNode => (
    <ScrollWrapper>
        <GtkBox>
            {Array.from({ length: n }, (_, i) => `label-${i}`).map((name) => (
                <GtkLabel key={name} label={`${name}-${suffix}`} />
            ))}
        </GtkBox>
    </ScrollWrapper>
);

describe("prop update", () => {
    for (const n of SIZES) {
        bench(`update one prop across ${n} labels`, async () => {
            await render(drawLabels(n, "a"));
            for (let k = 0; k < 3; k++) {
                await render(drawLabels(n, "b"));
                await render(drawLabels(n, "a"));
            }
            await cleanup();
        });
    }
});

describe("no-op rerender", () => {
    for (const n of SIZES) {
        bench(`rerender ${n} labels with unchanged props`, async () => {
            await render(drawLabels(n, "a"));
            for (let k = 0; k < 10; k++) {
                await render(drawLabels(n, "a"));
            }
            await cleanup();
        });
    }
});
