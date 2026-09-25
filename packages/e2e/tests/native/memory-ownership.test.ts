import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { prepareMemoryChecks } from "./helpers/memory-suite.js";
import {
    didSettle,
    didThrow,
    hammer,
    RSS_BUDGET,
    THROWING_RSS_BUDGET,
    wasCollected,
} from "./helpers/memory.js";

prepareMemoryChecks();

const callGerror = (): void => {
    GIMarshallingTests.gerror();
};

const callWithWrongStringArgument = (): void => {
    // @ts-expect-error the trailing parameter takes a string, not a number
    GIMarshallingTests.arrayInUtf8TwoIn([-1, 0, 1, 2], "1", 42);
};

const callWithWrongStrvElement = (): void => {
    // @ts-expect-error a strv takes strings, not numbers
    GIMarshallingTests.gstrvIn(["0", "1", 2]);
};

const callWithWrongHashValue = (): void => {
    // @ts-expect-error the table takes string values, not numbers
    Regress.testGhashNothingIn(new Map([["foo", 3]]));
};

const trackWeakly = (make: () => GIMarshallingTests.Object): WeakRef<GIMarshallingTests.Object> => {
    const value = make();
    expect(value.int).toBe(0);

    return new WeakRef(value);
};

test("boxed round trips stay bounded over twenty thousand iterations", async () => {
    expect(
        await hammer(20_000, () => {
            const boxed = Regress.TestBoxed.newAlternativeConstructor1(5);
            const copy = boxed.copy();
            boxed.equals(copy);

            return GIMarshallingTests.BoxedStruct.returnv().string;
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("boxed returns carrying nested allocations stay bounded over ten thousand iterations", async () => {
    expect(
        await hammer(10_000, () => {
            const boxed = Regress.TestBoxedD.new("abcd", 8);
            boxed.getMagic();
            boxed.copy().getMagic();

            return Regress.TestBoxedC.new().anotherThing;
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("object construction and drop stays bounded over ten thousand iterations", async () => {
    expect(
        await hammer(10_000, () => {
            const obj = new Regress.TestObj({ int: 3 });
            const marshalling = new GIMarshallingTests.Object({ int: 7 });

            return obj.int + marshalling.int;
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("transfer full object returns stay bounded over ten thousand calls", async () => {
    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.Object.fullReturn();
            GIMarshallingTests.Object.fullOut();
            GIMarshallingTests.Object.new(42);
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("transfer none object returns hand back one cached wrapper over ten thousand calls", async () => {
    const singleton = GIMarshallingTests.Object.noneReturn();
    expect(GIMarshallingTests.Object.noneReturn()).toBe(singleton);

    expect(
        await hammer(10_000, () => {
            GIMarshallingTests.Object.noneReturn();
            GIMarshallingTests.Object.noneOut();
            Regress.TestObj.nullOut();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("a retained object hands back the same wrapper across a hammer loop", async () => {
    const owner = new Regress.TestObj({});
    const companion = new GObject.Object({});
    owner.setBare(companion);
    expect(owner.bare).toBe(companion);

    expect(await hammer(10_000, () => owner.bare)).toBeLessThan(RSS_BUDGET);

    owner.setBare(null);
    expect(owner.bare).toBeNull();
});

test("fundamental object churn stays bounded over ten thousand iterations", async () => {
    expect(
        await hammer(10_000, () => {
            Regress.testFundamentalArgumentIn(Regress.TestFundamentalSubObject.new("data"));
            Regress.testFundamentalArgumentOut(Regress.TestFundamentalSubObject.new("data"));
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("throwing calls do not accumulate over ten thousand failures", async () => {
    expect(callGerror).toThrow();

    expect(await hammer(10_000, () => didThrow(callGerror))).toBeLessThan(THROWING_RSS_BUDGET);
});

test("arguments rejected mid-marshalling do not accumulate over ten thousand failures", async () => {
    expect(callWithWrongStringArgument).toThrow();
    expect(callWithWrongStrvElement).toThrow();
    expect(callWithWrongHashValue).toThrow();

    expect(
        await hammer(10_000, () => {
            didThrow(callWithWrongStringArgument);
            didThrow(callWithWrongStrvElement);
            didThrow(callWithWrongHashValue);
        }),
    ).toBeLessThan(THROWING_RSS_BUDGET);
});

test("dropped object, boxed and fundamental wrappers are collected", async () => {
    let finalized = 0;
    const registry: FinalizationRegistry<number> = new FinalizationRegistry(() => {
        finalized += 1;
    });

    const track = <TValue extends object>(make: () => TValue): WeakRef<TValue> => {
        const value = make();
        registry.register(value, 1);

        return new WeakRef(value);
    };

    const objectRef = track(() => {
        const value = new Regress.TestObj({ int: 3 });
        expect(value.int).toBe(3);

        return value;
    });

    const boxedRef = track(() => {
        const value = Regress.TestBoxed.newAlternativeConstructor1(5);
        expect(value.someInt8).toBe(5);

        return value;
    });

    const fundamentalRef = track(() => {
        const value = Regress.TestFundamentalSubObject.new("data");
        expect(Regress.testFundamentalArgumentOut(value)).toBe(value);

        return value;
    });

    expect(await wasCollected(objectRef)).toBe(true);
    expect(await wasCollected(boxedRef)).toBe(true);
    expect(await wasCollected(fundamentalRef)).toBe(true);
    expect(await didSettle(() => finalized === 3)).toBe(true);
    expect(finalized).toBe(3);
});

test("a wrapper handed back by C is collected once nothing holds it", async () => {
    const returnedRef = trackWeakly(() => GIMarshallingTests.Object.fullReturn());
    const outRef = trackWeakly(() => GIMarshallingTests.Object.fullOut());

    expect(await wasCollected(returnedRef)).toBe(true);
    expect(await wasCollected(outRef)).toBe(true);
});
