import { bench, describe } from "vitest";
import { renderListView } from "../tests/helpers/list-fixtures.js";
import { cleanup, render } from "../tests/helpers/production-render.js";

const SIZES = [100, 400];

const makeIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `row-${String(i)}`);

const spliceBench = (ids: string[], spliced: string[]) => async (): Promise<void> => {
    const { rerender } = await renderListView(ids, {}, render);

    for (let k = 0; k < 3; k++) {
        await rerender(spliced);
        await rerender(ids);
    }

    await cleanup();
};

describe("list splices", () => {
    for (const n of SIZES) {
        const ids = makeIds(n);
        bench(`append one item to ${String(n)} rows`, spliceBench(ids, [...ids, "row-extra"]));
        bench(`prepend one item to ${String(n)} rows`, spliceBench(ids, ["row-extra", ...ids]));

        bench(
            `remove the middle item of ${String(n)} rows`,
            spliceBench(
                ids,
                ids.filter((id) => id !== `row-${String(n / 2)}`),
            ),
        );

        bench(`reverse ${String(n)} rows`, spliceBench(ids, ids.toReversed()));
    }
});
