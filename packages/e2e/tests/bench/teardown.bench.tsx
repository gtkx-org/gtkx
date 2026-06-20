import { cleanup, render } from "@gtkx/testing";
import { beforeEach, bench, describe } from "vitest";
import { drawButtonBox } from "../helpers/button-box.js";

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
