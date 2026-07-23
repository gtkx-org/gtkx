import { drawButtonBox } from "../tests/helpers/button-box.js";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { describeSizedBench } from "../tests/helpers/sized-bench.js";

const SIZES = [100, 400];

describeSizedBench(
    "teardown",
    SIZES,
    (n) => `mount and unmount a box of ${n} buttons`,
    async (n) => {
        await render(drawButtonBox(n));
        await cleanup();
    },
);
