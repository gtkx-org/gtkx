import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest, drainGC, gcUntil } from "./helpers/memory.mjs";

GIMarshallingTests.Object.noneReturn();
GIMarshallingTests.Object.noneOut();
GIMarshallingTests.utf8NoneReturn();
GIMarshallingTests.garrayUtf8NoneReturn();
GIMarshallingTests.gptrarrayUtf8NoneReturn();
GIMarshallingTests.ghashtableUtf8NoneReturn();
Regress.testStrvOutC();

drainAfterEachTest();

const RSS_BUDGET = (process.env.GTKX_NATIVE_ASAN === "1" ? 256 : 40) * 1024 * 1024;
const WARMUP = 2000;

const settle = () => new Promise((resolve) => setImmediate(resolve));

const hammer = async (iterations, body) => {
    for (let round = 0; round < WARMUP; round += 1) {
        body(round);
    }

    await drainGC();
    const rss = process.memoryUsage().rss;

    for (let round = 0; round < iterations; round += 1) {
        body(round);
    }

    await drainGC();
    const growth = process.memoryUsage().rss - rss;
    assert.ok(growth < RSS_BUDGET, `rss grew by ${growth} bytes over ${iterations} iterations`);
};

const collectWeak = async (ref, rounds = 40) => {
    for (let round = 0; round < rounds; round += 1) {
        globalThis.gc();
        await settle();
        const isGone = ref.deref() === undefined;
        await settle();

        if (isGone) {
            return true;
        }
    }

    return false;
};

test("transfer full string returns stay bounded over twenty thousand calls", async () => {
    await hammer(20_000, () => {
        assert.equal(GIMarshallingTests.utf8FullReturn(), "const ♥ utf8");
        assert.equal(GIMarshallingTests.utf8FullOut(), "const ♥ utf8");
        assert.equal(Regress.testUtf8NonconstReturn(), "nonconst ♥ utf8");
    });
});

test("transfer none string returns stay bounded over twenty thousand calls", async () => {
    await hammer(20_000, () => {
        assert.equal(GIMarshallingTests.utf8NoneReturn(), "const ♥ utf8");
        assert.equal(GIMarshallingTests.utf8NoneOut(), "const ♥ utf8");
        assert.equal(Regress.testUtf8ConstReturn(), "const ♥ utf8");
    });
});

test("transfer full string arguments stay bounded over twenty thousand calls", async () => {
    await hammer(20_000, () => {
        GIMarshallingTests.utf8FullIn("const ♥ utf8");
        GIMarshallingTests.utf8NoneIn("const ♥ utf8");
        Regress.testUtf8ConstIn("const ♥ utf8");
        assert.equal(GIMarshallingTests.filenameCopy("const ♥ utf8"), "const ♥ utf8");
    });
});

test("C array returns of both transfers stay bounded over ten thousand calls", async () => {
    await hammer(10_000, () => {
        assert.deepEqual(GIMarshallingTests.arrayReturn(), [-1, 0, 1, 2]);
        assert.deepEqual(GIMarshallingTests.arrayFixedIntReturn(), [-1, 0, 1, 2]);
        assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedReturn(), ["0", "1", "2"]);
        assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedReturnNull(), []);
        assert.deepEqual(Regress.testArrayIntFullOut(), [0, 1, 2, 3, 4]);
        assert.deepEqual(Regress.testArrayIntNoneOut(), [1, 2, 3, 4, 5]);
    });
});

test("GArray and GPtrArray returns of every transfer stay bounded over ten thousand calls", async () => {
    await hammer(10_000, () => {
        assert.deepEqual(GIMarshallingTests.garrayUtf8FullReturn(), ["0", "1", "2"]);
        assert.deepEqual(GIMarshallingTests.garrayUtf8NoneReturn(), ["0", "1", "2"]);
        assert.deepEqual(GIMarshallingTests.garrayUtf8ContainerReturn(), ["0", "1", "2"]);
        assert.deepEqual(GIMarshallingTests.gptrarrayUtf8FullReturn(), ["0", "1", "2"]);
        assert.deepEqual(GIMarshallingTests.gptrarrayUtf8NoneReturn(), ["0", "1", "2"]);
        assert.deepEqual(GIMarshallingTests.gptrarrayUtf8ContainerReturn(), ["0", "1", "2"]);
    });
});

test("strv returns of every transfer stay bounded over ten thousand calls", async () => {
    await hammer(10_000, () => {
        assert.deepEqual(GIMarshallingTests.gstrvReturn(), ["0", "1", "2"]);
        assert.deepEqual(Regress.testStrvOut(), ["thanks", "for", "all", "the", "fish"]);
        assert.deepEqual(Regress.testStrvOutC(), ["thanks", "for", "all", "the", "fish"]);
        assert.deepEqual(Regress.testStrvOutContainer(), ["1", "2", "3"]);
    });
});

test("strv arguments stay bounded over ten thousand calls", async () => {
    await hammer(10_000, () => {
        GIMarshallingTests.gstrvIn(["0", "1", "2"]);
        assert.equal(Regress.testStrvIn(["1", "2", "3"]), true);
    });
});

test("boxed round trips stay bounded over twenty thousand iterations", async () => {
    await hammer(20_000, () => {
        const boxed = Regress.TestBoxed.newAlternativeConstructor1(5);
        const copy = boxed.copy();
        assert.equal(copy.someInt8, 5);
        assert.equal(boxed.equals(copy), true);
        assert.equal(GIMarshallingTests.BoxedStruct.returnv().string, "hello");
    });
});

test("boxed returns carrying nested allocations stay bounded over ten thousand iterations", async () => {
    await hammer(10_000, () => {
        const boxed = Regress.TestBoxedD.new("abcd", 8);
        assert.equal(boxed.getMagic(), 12);
        assert.equal(boxed.copy().getMagic(), 12);
        const refcounted = Regress.TestBoxedC.new();
        assert.equal(refcounted.anotherThing, 42);
    });
});

test("object construction and drop stays bounded over ten thousand iterations", async () => {
    await hammer(10_000, () => {
        const obj = new Regress.TestObj({ int: 3 });
        assert.equal(obj.int, 3);
        const marshalling = new GIMarshallingTests.Object({ int: 7 });
        assert.equal(marshalling.int, 7);
    });
});

test("transfer full object returns stay bounded over ten thousand calls", async () => {
    await hammer(10_000, () => {
        assert.equal(GIMarshallingTests.Object.fullReturn().int, 0);
        assert.equal(GIMarshallingTests.Object.fullOut().int, 0);
        assert.equal(GIMarshallingTests.Object.new(42).int, 42);
    });
});

test("transfer none object returns hand back one cached wrapper over ten thousand calls", async () => {
    const singleton = GIMarshallingTests.Object.noneReturn();

    await hammer(10_000, () => {
        assert.equal(GIMarshallingTests.Object.noneReturn(), singleton);
        assert.equal(GIMarshallingTests.Object.noneOut().int, 0);
        assert.equal(Regress.TestObj.nullOut(), null);
    });
});

test("a retained object hands back the same wrapper across a hammer loop", async () => {
    const owner = new Regress.TestObj({});
    const companion = new GObject.Object({});
    owner.setBare(companion);

    await hammer(10_000, () => {
        assert.equal(owner.bare, companion);
    });

    owner.setBare(null);
    assert.equal(owner.bare, null);
});

test("hashtable returns of every transfer stay bounded over ten thousand calls", async () => {
    await hammer(10_000, () => {
        assert.equal(GIMarshallingTests.ghashtableUtf8FullReturn().get("-1"), "1");
        assert.equal(GIMarshallingTests.ghashtableUtf8NoneReturn().get("2"), "-2");
        assert.equal(GIMarshallingTests.ghashtableUtf8ContainerReturn().get("0"), "0");
        assert.equal(Regress.testGhashEverythingReturn().get("foo"), "bar");
        assert.equal(Regress.testGhashNothingReturn().get("baz"), "bat");
        assert.equal(Regress.testGhashContainerReturn().get("qux"), "quux");
    });
});

test("nested hashtable full returns stay bounded over five thousand calls", async () => {
    await hammer(5000, () => {
        const nested = Regress.testGhashNestedEverythingReturn();
        assert.equal(nested.get("wibble").get("foo"), "bar");
        assert.equal(Regress.testGhashNullReturn(), null);
    });
});

test("gvalue round trips stay bounded over ten thousand iterations", async () => {
    const intType = GObject.typeFromName("gint");
    const stringType = GObject.typeFromName("gchararray");

    await hammer(10_000, () => {
        const number = new GObject.Value();
        number.init(intType);
        number.setInt(42);
        assert.equal(GIMarshallingTests.gvalueRoundTrip(number), 42);
        assert.equal(GIMarshallingTests.gvalueCopy(number), 42);

        const text = new GObject.Value();
        text.init(stringType);
        text.setString("gtkx");
        assert.equal(GIMarshallingTests.gvalueRoundTrip(text), "gtkx");

        assert.equal(GIMarshallingTests.gvalueReturn(), 42);
        assert.equal(GIMarshallingTests.gvalueOut().getInt(), 42);
    });
});

test("a gvalue built with new releases the string content it holds", async () => {
    const stringType = GObject.typeFromName("gchararray");
    const payload = "x".repeat(8192);

    const batch = async () => {
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

    const growth = process.memoryUsage().rss - rss;
    assert.ok(growth < RSS_BUDGET, `rss grew by ${growth} bytes`);
});

test("gvalues carrying objects and boxed payloads stay bounded over five thousand iterations", async () => {
    const objectType = GObject.typeFromName("GObject");

    await hammer(5000, () => {
        const holder = new GObject.Value();
        holder.init(objectType);
        const payload = new GObject.Object({});
        holder.setObject(payload);
        assert.equal(GIMarshallingTests.gvalueRoundTrip(holder), payload);
        assert.equal(Regress.testValueReturn(17), 17);
        assert.equal(Regress.testIntValueArg(42), 42);
    });
});

test("scope call callback churn stays bounded over twenty thousand calls", async () => {
    await hammer(20_000, () => {
        assert.equal(
            Regress.testCallbackUserData(() => 42),
            42,
        );
        let seen = null;
        GIMarshallingTests.callbackUserDataAfterCallback(1, 2, (a, b) => {
            seen = [a, b];
        });
        assert.deepEqual(seen, [1, 2]);
        assert.equal(Regress.testCallback(null), 0);
    });
});

test("callbacks retained by C and released on thaw stay bounded over ten thousand cycles", async () => {
    await hammer(10_000, () => {
        Regress.testCallbackAsync(() => 44);
        assert.equal(Regress.testCallbackThawAsync(), 44);
        assert.equal(
            Regress.testCallbackDestroyNotify(() => 42),
            42,
        );
        assert.equal(Regress.testCallbackThawNotifications(), 42);
    });
});

test("fundamental object churn stays bounded over ten thousand iterations", async () => {
    await hammer(10_000, () => {
        assert.equal(Regress.testFundamentalArgumentIn(Regress.TestFundamentalSubObject.new("data")), true);
        const borrowed = Regress.TestFundamentalSubObject.new("data");
        assert.equal(Regress.testFundamentalArgumentOut(borrowed), borrowed);
    });
});

test("throwing calls do not accumulate over ten thousand failures", async () => {
    await hammer(10_000, () => {
        assert.throws(() => GIMarshallingTests.gerror());
    });
});

test("arguments rejected mid-marshalling do not accumulate over ten thousand failures", async () => {
    await hammer(10_000, () => {
        assert.throws(() => GIMarshallingTests.arrayInUtf8TwoIn([-1, 0, 1, 2], "1", 42));
        assert.throws(() => GIMarshallingTests.gstrvIn(["0", "1", 2]));
        assert.throws(() => Regress.testGhashNothingIn(new Map([["foo", 3]])));
    });
});

test("dropped object, boxed and fundamental wrappers are collected", async () => {
    let finalized = 0;
    const registry = new FinalizationRegistry(() => {
        finalized += 1;
    });

    const track = (make) => {
        const value = make();
        registry.register(value, 1);

        return new WeakRef(value);
    };

    const objectRef = track(() => {
        const value = new Regress.TestObj({ int: 3 });
        assert.equal(value.int, 3);

        return value;
    });

    const boxedRef = track(() => {
        const value = Regress.TestBoxed.newAlternativeConstructor1(5);
        assert.equal(value.someInt8, 5);

        return value;
    });

    const fundamentalRef = track(() => {
        const value = Regress.TestFundamentalSubObject.new("data");
        assert.equal(Regress.testFundamentalArgumentOut(value), value);

        return value;
    });

    assert.equal(await collectWeak(objectRef), true);
    assert.equal(await collectWeak(boxedRef), true);
    assert.equal(await collectWeak(fundamentalRef), true);
    assert.equal(await gcUntil(() => finalized === 3), true);
    assert.equal(finalized, 3);
});

test("a wrapper handed back by C is collected once nothing holds it", async () => {
    const trackWeakly = (make) => {
        const value = make();
        assert.equal(value.int, 0);

        return new WeakRef(value);
    };

    const returnedRef = trackWeakly(() => GIMarshallingTests.Object.fullReturn());
    const outRef = trackWeakly(() => GIMarshallingTests.Object.fullOut());
    assert.equal(await collectWeak(returnedRef), true);
    assert.equal(await collectWeak(outRef), true);
});
