import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { describeSizedBench } from "../tests/helpers/sized-bench.js";

const SIZES = [100, 400];

const drawLabels = (n: number, suffix: string): ReactNode => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        <GtkBox>
            {Array.from({ length: n }, (_, i) => `label-${i}`).map((name) => (
                <GtkLabel key={name} label={`${name}-${suffix}`} />
            ))}
        </GtkBox>
    </GtkScrolledWindow>
);

const describeLabelRerenders = (title: string, name: (n: number) => string, suffixes: string[]): void =>
    describeSizedBench(title, SIZES, name, async (n) => {
        const { rerender } = await render(drawLabels(n, "a"));
        for (const suffix of suffixes) {
            await rerender(drawLabels(n, suffix));
        }
        await cleanup();
    });

describeLabelRerenders("prop update", (n) => `update one prop across ${n} labels`, ["b", "a", "b", "a", "b", "a"]);

describeLabelRerenders(
    "no-op rerender",
    (n) => `rerender ${n} labels with unchanged props`,
    Array.from({ length: 10 }, () => "a"),
);
