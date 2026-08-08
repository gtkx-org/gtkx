import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing/internal";
import { bench, describe } from "vitest";
import { scrolledBox } from "../tests/helpers/scrolled-box.js";
import { BENCH_SIZES } from "../tests/helpers/sized-bench.js";

const TOGGLED_SUFFIXES = ["b", "a", "b", "a", "b", "a"];
const UNCHANGED_SUFFIXES = Array.from({ length: 10 }, () => "a");

const drawLabels = (n: number, suffix: string): ReactNode =>
    scrolledBox(
        Array.from({ length: n }, (_, i) => `label-${String(i)}`).map((name) => (
            <GtkLabel key={name} label={`${name}-${suffix}`} />
        )),
    );

const rerenderLabels = async (n: number, suffixes: string[]): Promise<void> => {
    const { rerender } = await render(drawLabels(n, "a"));

    for (const suffix of suffixes) {
        await rerender(drawLabels(n, suffix));
    }

    await cleanup();
};

describe("prop update", () => {
    for (const n of BENCH_SIZES) {
        bench(`update one prop across ${String(n)} labels`, () => rerenderLabels(n, TOGGLED_SUFFIXES));
    }
});

describe("no-op rerender", () => {
    for (const n of BENCH_SIZES) {
        bench(`rerender ${String(n)} labels with unchanged props`, () => rerenderLabels(n, UNCHANGED_SUFFIXES));
    }
});
