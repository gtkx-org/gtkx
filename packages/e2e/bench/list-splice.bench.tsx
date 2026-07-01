import { bench, describe } from "vitest";
import { renderListView } from "../tests/helpers/list-fixtures.js";
import { cleanup, render } from "../tests/helpers/production-render.js";

const SIZES = [100, 400];

const makeIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `row-${i}`);

describe("list splices", () => {
    for (const n of SIZES) {
        const ids = makeIds(n);
        const appended = [...ids, "row-extra"];
        const prepended = ["row-extra", ...ids];
        const removedMiddle = ids.filter((id) => id !== `row-${n / 2}`);
        const reversed = [...ids].reverse();

        bench(`append one item to ${n} rows`, async () => {
            const { rerender } = await renderListView(ids, {}, render);
            for (let k = 0; k < 3; k++) {
                await rerender(appended);
                await rerender(ids);
            }
            await cleanup();
        });

        bench(`prepend one item to ${n} rows`, async () => {
            const { rerender } = await renderListView(ids, {}, render);
            for (let k = 0; k < 3; k++) {
                await rerender(prepended);
                await rerender(ids);
            }
            await cleanup();
        });

        bench(`remove the middle item of ${n} rows`, async () => {
            const { rerender } = await renderListView(ids, {}, render);
            for (let k = 0; k < 3; k++) {
                await rerender(removedMiddle);
                await rerender(ids);
            }
            await cleanup();
        });

        bench(`reverse ${n} rows`, async () => {
            const { rerender } = await renderListView(ids, {}, render);
            for (let k = 0; k < 3; k++) {
                await rerender(reversed);
                await rerender(ids);
            }
            await cleanup();
        });
    }
});
