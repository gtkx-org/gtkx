import { bench, describe } from "vitest";
import { renderListView } from "../tests/helpers/list-fixtures.js";
import { cleanup, render } from "../tests/helpers/production-render.js";

const SIZES = [100, 400];

const makeIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `row-${i}`);

const benchSplice = (name: string, ids: string[], spliced: string[]): void => {
    bench(name, async () => {
        const { rerender } = await renderListView(ids, {}, render);
        for (let k = 0; k < 3; k++) {
            await rerender(spliced);
            await rerender(ids);
        }
        await cleanup();
    });
};

describe("list splices", () => {
    for (const n of SIZES) {
        const ids = makeIds(n);
        benchSplice(`append one item to ${n} rows`, ids, [...ids, "row-extra"]);
        benchSplice(`prepend one item to ${n} rows`, ids, ["row-extra", ...ids]);
        benchSplice(
            `remove the middle item of ${n} rows`,
            ids,
            ids.filter((id) => id !== `row-${n / 2}`),
        );
        benchSplice(`reverse ${n} rows`, ids, [...ids].reverse());
    }
});
