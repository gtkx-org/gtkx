import { cleanup, render } from "@gtkx/testing/internal";
import { bench, describe } from "vitest";
import { drawButtonBox } from "../tests/helpers/button-box.js";
import { BENCH_SIZES } from "../tests/helpers/sized-bench.js";

describe("signal handler churn", () => {
    for (const n of BENCH_SIZES) {
        bench(`swap ${String(n)} signal handlers`, async () => {
            const { rerender } = await render(drawButtonBox(n));

            for (let k = 0; k < 10; k++) {
                await rerender(drawButtonBox(n));
            }

            await cleanup();
        });
    }
});
