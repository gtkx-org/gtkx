import type { ReactNode } from "react";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing/internal";
import { bench, describe } from "vitest";

const DEPTHS = [25, 100];

const nestBoxes = (depth: number): ReactNode =>
    depth === 0 ? <GtkLabel>leaf</GtkLabel> : <GtkBox>{nestBoxes(depth - 1)}</GtkBox>;

describe("deep mount", () => {
    for (const depth of DEPTHS) {
        bench(`mount a chain of ${String(depth)} nested boxes`, async () => {
            await render(nestBoxes(depth));
            await cleanup();
        });
    }
});
