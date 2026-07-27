import { bench, describe } from "vitest";
import { drawButtonBox } from "../tests/helpers/button-box.js";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { BENCH_SIZES } from "../tests/helpers/sized-bench.js";

describe("teardown", () => {
    for (const n of BENCH_SIZES) {
        bench(`mount and unmount a box of ${String(n)} buttons`, async () => {
            await render(drawButtonBox(n));
            await cleanup();
        });
    }
});
