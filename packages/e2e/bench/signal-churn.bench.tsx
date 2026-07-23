import { drawButtonBox } from "../tests/helpers/button-box.js";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { describeSizedBench } from "../tests/helpers/sized-bench.js";

const SIZES = [100, 400];

describeSizedBench(
    "signal handler churn",
    SIZES,
    (n) => `swap ${n} signal handlers`,
    async (n) => {
        const { rerender } = await render(drawButtonBox(n));
        for (let k = 0; k < 10; k++) {
            await rerender(drawButtonBox(n));
        }
        await cleanup();
    },
);
