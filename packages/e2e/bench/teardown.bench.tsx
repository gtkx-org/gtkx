import { beforeEach, bench, describe } from "vitest";
import { drawButtonBox } from "../tests/helpers/button-box.js";
import { cleanup, render } from "../tests/helpers/production-render.js";

const SIZES = [100, 400];

for (const n of SIZES) {
    describe(`teardown of ${n} buttons`, () => {
        beforeEach(async () => {
            await render(drawButtonBox(n));
        });

        bench(`unmount a box of ${n} buttons`, async () => {
            await cleanup();
        });
    });
}
