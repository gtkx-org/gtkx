import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { bench, describe } from "vitest";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

const SIZES = [100, 400];

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
            const { rerender } = await render(drawLabels(n, "a"));
            for (let k = 0; k < 3; k++) {
                await rerender(drawLabels(n, "b"));
                await rerender(drawLabels(n, "a"));
            }
            await cleanup();
        });
    }
});

describe("no-op rerender", () => {
    for (const n of SIZES) {
        bench(`rerender ${n} labels with unchanged props`, async () => {
            const { rerender } = await render(drawLabels(n, "a"));
            for (let k = 0; k < 10; k++) {
                await rerender(drawLabels(n, "a"));
            }
            await cleanup();
        });
    }
});
