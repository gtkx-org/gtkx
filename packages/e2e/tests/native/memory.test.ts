import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { didSettle, drainAfterEachTest, drainGC } from "./helpers/memory.js";

GIMarshallingTests.Object.noneReturn();
GIMarshallingTests.Object.noneOut();
GIMarshallingTests.utf8NoneReturn();
GIMarshallingTests.garrayUtf8NoneReturn();
GIMarshallingTests.gptrarrayUtf8NoneReturn();
GIMarshallingTests.ghashtableUtf8NoneReturn();
Regress.testStrvOutC();

drainAfterEachTest();

const RSS_BUDGET = (process.env.GTKX_ASAN_RUNTIME === undefined ? 40 : 256) * 1024 * 1024;
const THROWING_RSS_BUDGET = 256 * 1024 * 1024;
const WARMUP = 2000;

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const hammer = async (iterations: number, body: () => unknown): Promise<number> => {
    for (let round = 0; round < WARMUP; round += 1) {
        body();
    }

    await drainGC();
    const rss = process.memoryUsage().rss;

    for (let round = 0; round < iterations; round += 1) {
        body();
    }

    await drainGC();

    return process.memoryUsage().rss - rss;
};

const wasCollected = async (ref: WeakRef<object>, rounds = 40): Promise<boolean> => {
    for (let round = 0; round < rounds; round += 1) {
        globalThis.gc?.();
        await settle();
        const isGone = ref.deref() === undefined;
        await settle();

        if (isGone) {
            return true;
        }
    }

    return false;
};

const didThrow = (call: () => void): boolean => {
    try {
        call();

        return false;
    } catch {
        return true;
    }
};

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

test("transfer full string returns stay bounded over twenty thousand calls", async () => {
    expect(
        await hammer(20_000, () => {
            GIMarshallingTests.utf8FullReturn();
            GIMarshallingTests.utf8FullOut();
            Regress.testUtf8NonconstReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("transfer none string returns stay bounded over twenty thousand calls", async () => {
    expect(
        await hammer(20_000, () => {
            GIMarshallingTests.utf8NoneReturn();
            GIMarshallingTests.utf8NoneOut();
            Regress.testUtf8ConstReturn();
        }),
    ).toBeLessThan(RSS_BUDGET);
});

test("transfer full string arguments stay bounded over twenty thousand calls", async () => {
    expect(
        await hammer(20_000, () => {
            GIMarshallingTests.utf8FullIn("const ♥ utf8");
            GIMarshallingTests.utf8NoneIn("const ♥ utf8");
            Regress.testUtf8ConstIn("const ♥ utf8");
            GIMarshallingTests.filenameCopy("const ♥ utf8");
        }),
    ).toBeLessThan(RSS_BUDGET);
});

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
