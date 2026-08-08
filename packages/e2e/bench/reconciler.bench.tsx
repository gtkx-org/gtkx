import { GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing/internal";
import { bench, describe } from "vitest";
import { scrolledBox } from "../tests/helpers/scrolled-box.js";

const SIZES = [100, 200, 400];

describe("child insertion", () => {
    for (const n of SIZES) {
        const labels = Array.from({ length: n }, (_, i) => `label-${String(i)}`).map((text) => (
            <GtkLabel key={text} label={text} />
        ));

        bench(`mount a box of ${String(n)} children`, async () => {
            await render(scrolledBox(labels));
            await cleanup();
        });
    }
});
