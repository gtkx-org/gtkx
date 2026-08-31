import type * as GObject from "@gtkx/gi/gobject";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

type Counter = { calls: number };
type Holder<T> = { value: T | null };
type NotifiedCallback = WeakRef<Regress.TestCallbackUserData>;

drainAfterEachTest();

const held = <T>(holder: Holder<T>): T => {
    if (holder.value === null) {
        throw new Error("the callback captured nothing");
    }

    return holder.value;
};

const registerNotified = (value: number): NotifiedCallback => {
    const callback = (): number => value;
    expect(Regress.testCallbackDestroyNotify(callback)).toBe(value);

    return new WeakRef(callback);
};

const constructWithNotified = (value: number): { weak: NotifiedCallback; obj: Regress.TestObj } => {
    const callback = (): number => value;

    return { weak: new WeakRef(callback), obj: Regress.TestObj.newCallback(callback) };
};

const registerAsync = (counter: Counter, value: number): NotifiedCallback => {
    const callback = (): number => {
        counter.calls += 1;

        return value;
    };
    Regress.testCallbackAsync(callback);

    return new WeakRef(callback);
};

test("a call scoped callback runs once and hands its return value back to C", () => {
    let calls = 0;
    const returned = Regress.testCallback(() => {
        calls += 1;

        return 42;
    });
    expect(returned).toBe(42);
    expect(calls).toBe(1);

    let userDataCalls = 0;
    const withUserData = Regress.testCallbackUserData(() => {
        userDataCalls += 1;

        return 7;
    });
    expect(withUserData).toBe(7);
    expect(userDataCalls).toBe(1);
});

test("a multi callback invokes the same function twice and sums the returns", () => {
    let calls = 0;
    const sum = Regress.testMultiCallback(() => {
        calls += 1;

        return 21;
    });
    expect(sum).toBe(42);
    expect(calls).toBe(2);
});

test("void callbacks run and report no value to C", () => {
    let simple = 0;
    Regress.testSimpleCallback(() => {
        simple += 1;
    });
    expect(simple).toBe(1);

    let noptr = 0;
    Regress.testNoptrCallback(() => {
        noptr += 1;
    });
    expect(noptr).toBe(1);

    // @ts-expect-error a callback declared to return a number reports 0 when it returns nothing
    expect(Regress.testCallback(() => {
        noptr += 1;
    })).toBe(0);
    expect(noptr).toBe(2);
});

test("nullable callback arguments accept null and leave C untouched", () => {
    expect(Regress.testCallback(null)).toBe(0);
    expect(Regress.testMultiCallback(null)).toBe(0);
    Regress.testSimpleCallback(null);
    Regress.testNoptrCallback(null);
    Regress.TestObj.staticMethodCallback(null);
    new Regress.TestObj({}).instanceMethodCallback(null);
});

test("instance and static methods invoke their callback argument", () => {
    const obj = new Regress.TestObj({});
    let instanceCalls = 0;
    obj.instanceMethodCallback(() => {
        instanceCalls += 1;

        return 1;
    });
    expect(instanceCalls).toBe(1);

    let staticCalls = 0;
    Regress.TestObj.staticMethodCallback(() => {
        staticCalls += 1;

        return 2;
    });
    expect(staticCalls).toBe(1);
});

test("torture signature 2 runs its callback and returns every out value", () => {
    let calls = 0;
    const out = Regress.testTortureSignature2(
        42,
        () => {
            calls += 1;

            return 0;
        },
        "foo",
        7,
    );
    expect(out).toEqual([42, 84, 10]);
    expect(calls).toBe(1);
});

test("a transfer full object returned from a callback is handed over to C", async () => {
    let calls = 0;
    Regress.testCallbackReturnFull(() => {
        calls += 1;

        return new Regress.TestObj({ int: 5 });
    });
    expect(calls).toBe(1);

    Regress.testCallbackReturnFull(() => Regress.TestObj.newFromFile("/anything"));
    await drainGC();
});

test("notified scope callbacks persist until the notifications are thawed", () => {
    let calls = 0;
    const first = Regress.testCallbackDestroyNotify(() => {
        calls += 1;

        return 3;
    });
    expect(first).toBe(3);
    expect(calls).toBe(1);

    const second = Regress.testCallbackDestroyNotify(() => {
        calls += 1;

        return 4;
    });
    expect(second).toBe(4);
    expect(calls).toBe(2);

    expect(Regress.testCallbackThawNotifications()).toBe(7);
    expect(calls).toBe(4);
    expect(Regress.testCallbackThawNotifications()).toBe(0);
    expect(calls).toBe(4);
});

test("a notified scope callback with no user data is still thawed", () => {
    let calls = 0;
    const returned = Regress.testCallbackDestroyNotifyNoUserData(() => {
        calls += 1;

        return 5;
    });
    expect(returned).toBe(5);
    expect(calls).toBe(1);
    expect(Regress.testCallbackThawNotifications()).toBe(5);
    expect(calls).toBe(2);
});

test("the destroy notify of a notified callback releases the JS function", async () => {
    const weak = registerNotified(6);

    await drainGC();
    expect(weak.deref()).toBeDefined();

    expect(Regress.testCallbackThawNotifications()).toBe(6);
    await drainGC(5);
    expect(weak.deref()).toBeUndefined();
});

test("a constructor taking a notified callback returns an object and defers the notify", async () => {
    const { weak, obj } = constructWithNotified(8);
    expect(obj instanceof Regress.TestObj).toBeTruthy();

    await drainGC();
    expect(weak.deref()).toBeDefined();

    expect(Regress.testCallbackThawNotifications()).toBe(8);
    await drainGC(5);
    expect(weak.deref()).toBeUndefined();
});

test("async scope callbacks are deferred until the async queue is thawed", async () => {
    const counter: Counter = { calls: 0 };
    const weak = registerAsync(counter, 44);
    expect(counter.calls).toBe(0);

    await drainGC();
    expect(weak.deref()).toBeDefined();

    expect(Regress.testCallbackThawAsync()).toBe(44);
    expect(counter.calls).toBe(1);
    expect(Regress.testCallbackThawAsync()).toBe(0);
    expect(counter.calls).toBe(1);
    await drainGC(5);
    expect(weak.deref()).toBeUndefined();
});

test("an async ready callback handed to C is invoked from the main loop", async () => {
    const seen: [GObject.Object | null, string][] = [];
    Regress.testAsyncReadyCallback((source, result) => {
        seen.push([source, result instanceof Gio.AsyncResult ? "result" : typeof result]);
    });
    expect(seen).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]).toBeNull();
    expect(seen[0]?.[1]).toBe("result");
    seen.length = 0;
    await drainGC();
});

test("a gerror callback receives the error C created", () => {
    const seen: [string, number, number, boolean][] = [];
    Regress.testGerrorCallback((error) => {
        seen.push([
            error.message,
            error.code,
            error.domain,
            error.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.NOT_SUPPORTED),
        ]);
    });
    expect(seen).toEqual([
        ["regression test error", Gio.IOErrorEnum.NOT_SUPPORTED, Gio.ioErrorQuark(), true],
    ]);
});

test("a null gerror callback receives null", () => {
    const seen: (GLib.Error | null)[] = [];
    Regress.testNullGerrorCallback((error) => {
        seen.push(error);
    });
    expect(seen).toEqual([null]);
});

test("an owned gerror stays readable after the callback returns", async () => {
    const seen: GLib.Error[] = [];
    Regress.testOwnedGerrorCallback((error) => {
        seen.push(error);
    });
    expect(seen[0]?.message).toBe("regression test owned error");
    expect(seen[0]?.code).toBe(Gio.IOErrorEnum.PERMISSION_DENIED);
    expect(seen[0]?.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.PERMISSION_DENIED)).toBe(true);
    seen.length = 0;
    await drainGC();
});

test("a gerror only lent to a callback is revoked when the callback returns", () => {
    const holder: Holder<GLib.Error> = { value: null };
    Regress.testGerrorCallback((error) => {
        holder.value = error;
        expect(error.code).toBe(Gio.IOErrorEnum.NOT_SUPPORTED);
    });

    const escaped = held(holder);
    expect(() => escaped.code).toThrow();
    expect(() => escaped.message).toThrow();
});

test("callback return values and out parameters come back from the call", () => {
    expect(GIMarshallingTests.callbackReturnValueOnly(() => 42n)).toBe(42n);
    // @ts-expect-error a number widens into the bigint the slot declares
    expect(GIMarshallingTests.callbackReturnValueOnly(() => 42)).toBe(42n);
    expect(GIMarshallingTests.callbackOneOutParameter(() => 43.5)).toBe(43.5);
    expect(GIMarshallingTests.callbackMultipleOutParameters(() => [1.5, 2.5])).toEqual([1.5, 2.5]);
    expect(GIMarshallingTests.callbackReturnValueAndOneOutParameter(() => [11n, 22n])).toEqual([11n, 22n]);
    expect(GIMarshallingTests.callbackReturnValueAndMultipleOutParameters(() => [1n, 2n, 3n])).toEqual([1n, 2n, 3n]);
});

test("out parameter tuples pad missing entries and ignore extra ones", () => {
    // @ts-expect-error a short tuple where two out parameters are declared
    expect(GIMarshallingTests.callbackMultipleOutParameters(() => [1.5])).toEqual([1.5, 0]);
    // @ts-expect-error a long tuple where two out parameters are declared
    expect(GIMarshallingTests.callbackMultipleOutParameters(() => [1.5, 2.5, 3.5])).toEqual([1.5, 2.5]);
    // @ts-expect-error a short tuple where three out parameters are declared
    expect(GIMarshallingTests.callbackReturnValueAndMultipleOutParameters(() => [9n])).toEqual([9n, 0n, 0n]);
});

test("a boxed lent to a callback is mutable and its changes are visible to C", () => {
    const observed: bigint[] = [];
    const base = GIMarshallingTests.callbackOwnedBoxed((box) => {
        observed.push(box.long);
    });
    expect(typeof base).toBe("bigint");
    expect(observed).toEqual([base]);

    const seen: (bigint | boolean)[] = [];
    const bumped = GIMarshallingTests.callbackOwnedBoxed((box) => {
        seen.push(box instanceof GIMarshallingTests.BoxedStruct, box.long);
        box.long = 100n;
    });
    expect(seen).toEqual([true, base + 1n]);
    expect(bumped).toBe(100n);

    const restored = GIMarshallingTests.callbackOwnedBoxed((box) => {
        observed.push(box.long);
    });
    expect(restored).toBe(101n);
    expect(observed).toEqual([base, 101n]);
});

test("a boxed only lent to a callback is revoked when the callback returns", () => {
    const holder: Holder<GIMarshallingTests.BoxedStruct> = { value: null };
    GIMarshallingTests.callbackOwnedBoxed((box) => {
        holder.value = box;
    });

    const escaped = held(holder);
    expect(() => escaped.long).toThrow();
    expect(() => {
        escaped.long = 1n;
    }).toThrow();
});

test("closure user data is elided from the arguments a JS callback receives", () => {
    const seen: number[][] = [];
    GIMarshallingTests.callbackUserDataAfterCallback(1, 2, (...args) => {
        seen.push(args);
    });
    expect(seen).toEqual([[1, 2]]);
});

test("a callback re-enters the binding stack", () => {
    expect(Regress.testCallback(() => Regress.testCallback(() => 21) + 21)).toBe(42);
    expect(Regress.testMultiCallback(() => Regress.testCallbackUserData(() => Regress.testCallback(() => 5)))).toBe(10);

    let inner = 0;
    const nested = Regress.testCallback(() => {
        const obj = new Regress.TestObj({ int: 3 });
        obj.instanceMethodCallback(() => {
            inner += 1;

            return 0;
        });

        return obj.int;
    });
    expect(nested).toBe(3);
    expect(inner).toBe(1);
});

test("an exception thrown inside a callback propagates out of the C call", () => {
    expect(() =>
        Regress.testCallback(() => {
            throw new Error("boom");
        })).toThrow();
    expect(() =>
        Regress.testMultiCallback(() => {
            throw new TypeError("boom");
        })).toThrow();
    expect(() =>
        GIMarshallingTests.callbackMultipleOutParameters(() => {
            throw new Error("boom");
        })).toThrow();

    expect(Regress.testCallback(() => 9)).toBe(9);
    expect(GIMarshallingTests.callbackMultipleOutParameters(() => [4.5, 5.5])).toEqual([4.5, 5.5]);
});

test("a non function where a callback is expected throws", () => {
    // @ts-expect-error a number is not a callback
    expect(() => Regress.testCallback(42)).toThrow();
    // @ts-expect-error an object is not a callback
    expect(() => Regress.testCallback({})).toThrow();
    // @ts-expect-error a string is not a callback
    expect(() => Regress.testCallback("nope")).toThrow();
    // @ts-expect-error a symbol is not a callback
    expect(() => Regress.testCallback(Symbol("nope"))).toThrow();
    // @ts-expect-error a number is not a callback
    expect(() => Regress.testCallbackUserData(7)).toThrow();
    // @ts-expect-error an array is not a callback
    expect(() => Regress.testMultiCallback([])).toThrow();
    // @ts-expect-error an object is not a callback
    expect(() => GIMarshallingTests.callbackReturnValueOnly({})).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a callback
        Regress.TestObj.staticMethodCallback("nope");
    }).toThrow();
});

test("a non function handed to a deferred callback throws at the call site", () => {
    // @ts-expect-error a number is not a source function
    expect(() => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5, 42)).toThrow();
    // @ts-expect-error a string is not a source function
    expect(() => GLib.idleAdd(GLib.PRIORITY_DEFAULT, "nope")).toThrow();
    expect(() => {
        // @ts-expect-error an object is not a callback
        Regress.testCallbackAsync({});
    }).toThrow();
    // @ts-expect-error an array is not a callback
    expect(() => Regress.testCallbackDestroyNotify([])).toThrow();
});

test("array callback arguments arrive without the lengths that size them", () => {
    const seen: [number[], string[]][] = [];
    const sum = Regress.testArrayCallback((...args) => {
        seen.push(args);

        return 1;
    });

    expect(sum).toBe(2);
    expect(seen).toHaveLength(2);
    for (const args of seen) {
        expect(args).toHaveLength(2);
        expect(args[0]).toEqual([-1, 0, 1, 2]);
        expect(args[1]).toEqual(["one", "two", "three"]);
    }
});

test("a hash table callback receives the table it was handed", () => {
    const seen: [Map<string, number>][] = [];
    Regress.testHashTableCallback(
        new Map([
            ["foo", 1],
            ["bar", 2],
            ["baz", 3],
        ]),
        (...args) => {
            seen.push(args);
        },
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(1);
    expect(new Map(seen[0]?.[0])).toEqual(new Map([
        ["foo", 1],
        ["bar", 2],
        ["baz", 3],
    ]));
});

test("a user data slot GIR leaves unannotated is still elided", () => {
    const counts: number[] = [];
    const returned = Regress.testCallbackUserData((...args) => {
        counts.push(args.length);

        return 7;
    });

    expect(returned).toBe(7);
    expect(counts).toEqual([0]);
});

test("an inout array callback parameter round-trips through the handler", () => {
    const seen: [number[]][] = [];
    const remaining = Regress.testArrayInoutCallback((...args) => {
        seen.push(args);

        return args[0].slice(1);
    });

    expect(remaining).toBe(3);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toHaveLength(1);
    expect(seen[0]?.[0]).toEqual([-2, -1, 0, 1, 2]);
    expect(seen[1]).toHaveLength(1);
    expect(seen[1]?.[0]).toEqual([-1, 0, 1, 2]);
});

test("an inout array callback accepts a freshly built array as well as a slice", () => {
    const seen: number[][] = [];
    const remaining = Regress.testArrayInoutCallback((ints) => {
        seen.push(ints);

        return seen.length === 1 ? [-1, 0, 1, 2] : ints.slice(1);
    });

    expect(remaining).toBe(3);
    expect(seen).toEqual([
        [-2, -1, 0, 1, 2],
        [-1, 0, 1, 2],
    ]);
});

test("a callback that cannot fill its out parameters throws into the caller", () => {
    // @ts-expect-error strings are not the numbers the out parameters hold
    expect(() => GIMarshallingTests.callbackMultipleOutParameters(() => ["a", "b"])).toThrow();
    // @ts-expect-error a string is not the number the out parameter holds
    expect(() => GIMarshallingTests.callbackOneOutParameter(() => "nope")).toThrow();
    // @ts-expect-error an object is not the bigint the out parameter holds
    expect(() => GIMarshallingTests.callbackReturnValueAndOneOutParameter(() => [1n, {}])).toThrow();
});

test("the binding survives a callback out parameter failure", () => {
    // @ts-expect-error strings are not the numbers the out parameters hold
    expect(() => GIMarshallingTests.callbackMultipleOutParameters(() => ["a", "b"])).toThrow();
    expect(GIMarshallingTests.callbackReturnValueOnly(() => 42n)).toBe(42n);
    expect(GIMarshallingTests.callbackMultipleOutParameters(() => [1.5, 2.5])).toEqual([1.5, 2.5]);
});
