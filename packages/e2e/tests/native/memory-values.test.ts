import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { prepareMemoryChecks } from "./helpers/memory-suite.js";
import { drainGC, hammer, RSS_BUDGET } from "./helpers/memory.js";

prepareMemoryChecks();

test("gvalue round trips stay bounded over ten thousand iterations", async () => {
    const intType = GObject.typeFromName("gint");
    const stringType = GObject.typeFromName("gchararray");

    expect(
        await hammer(10_000, () => {
            const number = new GObject.Value();
            number.init(intType);
            number.setInt(42);
            GIMarshallingTests.gvalueRoundTrip(number);
            GIMarshallingTests.gvalueCopy(number);

            const text = new GObject.Value();
            text.init(stringType);
            text.setString("gtkx");
            GIMarshallingTests.gvalueRoundTrip(text);

            GIMarshallingTests.gvalueReturn();
            GIMarshallingTests.gvalueOut().getInt();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("a gvalue built with new releases the string content it holds", async () => {
    const stringType = GObject.typeFromName("gchararray");
    const payload = "x".repeat(8192);

    const batch = async (): Promise<void> => {
        for (let round = 0; round < 2000; round += 1) {
            const value = new GObject.Value();
            value.init(stringType);
            value.setString(payload);
        }

        await drainGC();
    };

    await batch();
    const rss = process.memoryUsage().rss;

    for (let round = 0; round < 20; round += 1) {
        await batch();
    }

    expect(process.memoryUsage().rss - rss).toBeLessThan(RSS_BUDGET);
});

test("gvalues carrying objects and boxed payloads stay bounded over five thousand iterations", async () => {
    const objectType = GObject.typeFromName("GObject");

    expect(
        await hammer(5000, () => {
            const holder = new GObject.Value();
            holder.init(objectType);
            holder.setObject(new GObject.Object({}));
            GIMarshallingTests.gvalueRoundTrip(holder);
            Regress.testValueReturn(17);
            Regress.testIntValueArg(42);
        }),
    ).toBeLessThan(RSS_BUDGET);
});
