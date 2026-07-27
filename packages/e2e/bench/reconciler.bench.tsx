import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { bench, describe } from "vitest";
import { cleanup, render } from "../tests/helpers/production-render.js";

const SIZES = [100, 200, 400];

describe("child insertion", () => {
    for (const n of SIZES) {
        const labels = Array.from({ length: n }, (_, i) => `label-${String(i)}`).map((text) => (
            <GtkLabel key={text} label={text} />
        ));

        bench(`mount a box of ${String(n)} children`, async () => {
            await render(
                <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
                    <GtkBox>{labels}</GtkBox>
                </GtkScrolledWindow>,
            );

            await cleanup();
        });
    }
});
