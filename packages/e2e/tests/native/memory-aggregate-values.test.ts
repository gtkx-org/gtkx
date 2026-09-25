import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { prepareMemoryChecks } from "./helpers/memory-suite.js";
import { hammer, RSS_BUDGET } from "./helpers/memory.js";

prepareMemoryChecks();

test("C array returns of both transfers stay bounded over ten thousand calls", async () => {
    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.arrayReturn();
            GIMarshallingTests.arrayFixedIntReturn();
            GIMarshallingTests.arrayZeroTerminatedReturn();
            GIMarshallingTests.arrayZeroTerminatedReturnNull();
            Regress.testArrayIntFullOut();
            Regress.testArrayIntNoneOut();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("GArray and GPtrArray returns of every transfer stay bounded over ten thousand calls", async () => {
    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.garrayUtf8FullReturn();
            GIMarshallingTests.garrayUtf8NoneReturn();
            GIMarshallingTests.garrayUtf8ContainerReturn();
            GIMarshallingTests.gptrarrayUtf8FullReturn();
            GIMarshallingTests.gptrarrayUtf8NoneReturn();
            GIMarshallingTests.gptrarrayUtf8ContainerReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("strv returns of every transfer stay bounded over ten thousand calls", async () => {
    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.gstrvReturn();
            Regress.testStrvOut();
            Regress.testStrvOutC();
            Regress.testStrvOutContainer();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("strv arguments stay bounded over ten thousand calls", async () => {
    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.gstrvIn(["0", "1", "2"]);
            Regress.testStrvIn(["1", "2", "3"]);
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("hashtable returns of every transfer stay bounded over ten thousand calls", async () => {
    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.ghashtableUtf8FullReturn();
            GIMarshallingTests.ghashtableUtf8NoneReturn();
            GIMarshallingTests.ghashtableUtf8ContainerReturn();
            Regress.testGhashEverythingReturn();
            Regress.testGhashNothingReturn();
            Regress.testGhashContainerReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("nested hashtable full returns stay bounded over five thousand calls", async () => {
    expect(
        await hammer(5000, () => {
            Regress.testGhashNestedEverythingReturn();
            Regress.testGhashNullReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});
