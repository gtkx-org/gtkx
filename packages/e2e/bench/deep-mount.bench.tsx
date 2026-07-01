import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { bench, describe } from "vitest";
import { cleanup, render } from "../tests/helpers/production-render.js";

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
