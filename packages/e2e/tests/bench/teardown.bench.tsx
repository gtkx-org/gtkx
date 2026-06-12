import { cleanup, render } from "@gtkx/testing";
import { beforeEach, bench, describe } from "vitest";
import { drawButtonBox } from "../helpers/button-box.js";

/**
 * Isolates unmount cost — signal disconnects, detach walks, registry
 * release — from the mount that precedes it. The mount runs in a vitest
 * `beforeEach`, which the CodSpeed analysis runner executes outside the
 * instrumented window, so the measured body is only the `cleanup()` call.
 * Plain `vitest bench` (tinybench) never runs suite hooks, so the body stays
 * idempotent — local wall-clock numbers for this file are a smoke signal
 * only; the CodSpeed instruction count is the gate.
 */
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
