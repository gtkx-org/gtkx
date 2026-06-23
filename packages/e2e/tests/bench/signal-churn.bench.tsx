import { cleanup, render } from "@gtkx/testing";
import { bench, describe } from "vitest";
import { drawButtonBox } from "../helpers/button-box.js";

const SIZES = [100, 400];

describe("signal handler churn", () => {
    for (const n of SIZES) {
        bench(`swap ${n} signal handlers`, async () => {
            const { rerender } = await render(drawButtonBox(n));
            for (let k = 0; k < 10; k++) {
                await rerender(drawButtonBox(n));
            }
            await cleanup();
        });
    }
});
