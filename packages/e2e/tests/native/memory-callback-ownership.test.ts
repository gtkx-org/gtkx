import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { prepareMemoryChecks } from "./helpers/memory-suite.js";
import { hammer, RSS_BUDGET } from "./helpers/memory.js";

prepareMemoryChecks();

test("scope call callback churn stays bounded over twenty thousand calls", async () => {
    let seen: number[] = [];

    expect(
        await hammer(20_000, () => {
            Regress.testCallbackUserData(() => 42);
            GIMarshallingTests.callbackUserDataAfterCallback(1, 2, (a, b) => {
                seen = [a, b];
            });
            Regress.testCallback(null);
        }),
    ).toBeLessThan(RSS_BUDGET);

    expect(seen).toEqual([1, 2]);
});

test("callbacks retained by C and released on thaw stay bounded over ten thousand cycles", async () => {
    expect(
        await hammer(10_000, () => {
            Regress.testCallbackAsync(() => 44);
            Regress.testCallbackThawAsync();
            Regress.testCallbackDestroyNotify(() => 42);
            Regress.testCallbackThawNotifications();
        }),
    ).toBeLessThan(RSS_BUDGET);
});
