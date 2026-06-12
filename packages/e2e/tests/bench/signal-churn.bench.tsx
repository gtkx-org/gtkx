import { cleanup, render } from "@gtkx/testing";
import { bench, describe } from "vitest";
import { drawButtonBox } from "../helpers/button-box.js";

/**
 * Sizes grown geometrically so an instruction-count gate (CodSpeed) sees a
 * flat per-handler slope for the `SignalStore` swap path and a rising slope
 * for any quadratic regression. Every rerender hands each button a fresh
 * `onClicked` closure identity, so the only diff the commit applies is the
 * per-button handler swap.
 */
const SIZES = [100, 400];

describe("signal handler churn", () => {
    for (const n of SIZES) {
        bench(`swap ${n} signal handlers`, async () => {
            await render(drawButtonBox(n));
            for (let k = 0; k < 10; k++) {
                await render(drawButtonBox(n));
            }
            await cleanup();
        });
    }
});
