import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest, drainGC } from "./helpers/memory.mjs";

drainAfterEachTest();

const registerNotified = (value) => {
    const callback = () => value;
    assert.equal(Regress.testCallbackDestroyNotify(callback), value);

    return new WeakRef(callback);
};

const constructWithNotified = (value) => {
    const callback = () => value;

    return { weak: new WeakRef(callback), obj: Regress.TestObj.newCallback(callback) };
};

const registerAsync = (counter, value) => {
    const callback = () => {
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
    assert.equal(returned, 42);
    assert.equal(calls, 1);

    let userDataCalls = 0;
    const withUserData = Regress.testCallbackUserData(() => {
        userDataCalls += 1;

        return 7;
    });
    assert.equal(withUserData, 7);
    assert.equal(userDataCalls, 1);
});

test("a multi callback invokes the same function twice and sums the returns", () => {
    let calls = 0;
    const sum = Regress.testMultiCallback(() => {
        calls += 1;

        return 21;
    });
    assert.equal(sum, 42);
    assert.equal(calls, 2);
});

test("void callbacks run and report no value to C", () => {
    let simple = 0;
    Regress.testSimpleCallback(() => {
        simple += 1;
    });
    assert.equal(simple, 1);

    let noptr = 0;
    Regress.testNoptrCallback(() => {
        noptr += 1;
    });
    assert.equal(noptr, 1);

    assert.equal(
        Regress.testCallback(() => {
            noptr += 1;
        }),
        0,
    );
    assert.equal(noptr, 2);
});

test("nullable callback arguments accept null and leave C untouched", () => {
    assert.equal(Regress.testCallback(null), 0);
    assert.equal(Regress.testMultiCallback(null), 0);
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
    assert.equal(instanceCalls, 1);

    let staticCalls = 0;
    Regress.TestObj.staticMethodCallback(() => {
        staticCalls += 1;

        return 2;
    });
    assert.equal(staticCalls, 1);
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
    assert.deepEqual(out, [42, 84, 10]);
    assert.equal(calls, 1);
});

test("a transfer full object returned from a callback is handed over to C", async () => {
    let calls = 0;
    Regress.testCallbackReturnFull(() => {
        calls += 1;

        return new Regress.TestObj({ int: 5 });
    });
    assert.equal(calls, 1);

    Regress.testCallbackReturnFull(() => Regress.TestObj.newFromFile("/anything"));
    await drainGC();
});

test("notified scope callbacks persist until the notifications are thawed", () => {
    let calls = 0;
    const first = Regress.testCallbackDestroyNotify(() => {
        calls += 1;

        return 3;
    });
    assert.equal(first, 3);
    assert.equal(calls, 1);

    const second = Regress.testCallbackDestroyNotify(() => {
        calls += 1;

        return 4;
    });
    assert.equal(second, 4);
    assert.equal(calls, 2);

    assert.equal(Regress.testCallbackThawNotifications(), 7);
    assert.equal(calls, 4);
    assert.equal(Regress.testCallbackThawNotifications(), 0);
    assert.equal(calls, 4);
});

test("a notified scope callback with no user data is still thawed", () => {
    let calls = 0;
    const returned = Regress.testCallbackDestroyNotifyNoUserData(() => {
        calls += 1;

        return 5;
    });
    assert.equal(returned, 5);
    assert.equal(calls, 1);
    assert.equal(Regress.testCallbackThawNotifications(), 5);
    assert.equal(calls, 2);
});

test("the destroy notify of a notified callback releases the JS function", async () => {
    const weak = registerNotified(6);

    await drainGC();
    assert.notEqual(weak.deref(), undefined);

    assert.equal(Regress.testCallbackThawNotifications(), 6);
    await drainGC(5);
    assert.equal(weak.deref(), undefined);
});

test("a constructor taking a notified callback returns an object and defers the notify", async () => {
    const { weak, obj } = constructWithNotified(8);
    assert.ok(obj instanceof Regress.TestObj);

    await drainGC();
    assert.notEqual(weak.deref(), undefined);

    assert.equal(Regress.testCallbackThawNotifications(), 8);
    await drainGC(5);
    assert.equal(weak.deref(), undefined);
});

test("async scope callbacks are deferred until the async queue is thawed", async () => {
    const counter = { calls: 0 };
    const weak = registerAsync(counter, 44);
    assert.equal(counter.calls, 0);

    await drainGC();
    assert.notEqual(weak.deref(), undefined);

    assert.equal(Regress.testCallbackThawAsync(), 44);
    assert.equal(counter.calls, 1);
    assert.equal(Regress.testCallbackThawAsync(), 0);
    assert.equal(counter.calls, 1);
    await drainGC(5);
    assert.equal(weak.deref(), undefined);
});

test("an async ready callback handed to C is invoked from the main loop", async () => {
    const seen = [];
    Regress.testAsyncReadyCallback((source, result) => {
        seen.push([source, result instanceof Gio.AsyncResult ? "result" : typeof result]);
    });
    assert.deepEqual(seen, []);

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(seen.length, 1);
    assert.equal(seen[0][0], null);
    assert.equal(seen[0][1], "result");
    seen.length = 0;
    await drainGC();
});

test("a gerror callback receives the error C created", () => {
    const seen = [];
    Regress.testGerrorCallback((error) => {
        seen.push([
            error.message,
            error.code,
            error.domain,
            error.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.NOT_SUPPORTED),
        ]);
    });
    assert.deepEqual(seen, [
        ["regression test error", Gio.IOErrorEnum.NOT_SUPPORTED, Gio.ioErrorQuark(), true],
    ]);
});

test("a null gerror callback receives null", () => {
    const seen = [];
    Regress.testNullGerrorCallback((error) => {
        seen.push(error);
    });
    assert.deepEqual(seen, [null]);
});

test("an owned gerror stays readable after the callback returns", async () => {
    const seen = [];
    Regress.testOwnedGerrorCallback((error) => {
        seen.push(error);
    });
    assert.equal(seen[0].message, "regression test owned error");
    assert.equal(seen[0].code, Gio.IOErrorEnum.PERMISSION_DENIED);
    assert.equal(seen[0].matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.PERMISSION_DENIED), true);
    seen.length = 0;
    await drainGC();
});

test("a gerror only lent to a callback is revoked when the callback returns", () => {
    let escaped = null;
    Regress.testGerrorCallback((error) => {
        escaped = error;
        assert.equal(error.code, Gio.IOErrorEnum.NOT_SUPPORTED);
    });
    assert.throws(() => escaped.code);
    assert.throws(() => escaped.message);
});

test("callback return values and out parameters come back from the call", () => {
    assert.equal(
        GIMarshallingTests.callbackReturnValueOnly(() => 42n),
        42n,
    );
    assert.equal(
        GIMarshallingTests.callbackReturnValueOnly(() => 42),
        42n,
    );
    assert.equal(
        GIMarshallingTests.callbackOneOutParameter(() => 43.5),
        43.5,
    );
    assert.deepEqual(
        GIMarshallingTests.callbackMultipleOutParameters(() => [1.5, 2.5]),
        [1.5, 2.5],
    );
    assert.deepEqual(
        GIMarshallingTests.callbackReturnValueAndOneOutParameter(() => [11n, 22n]),
        [11n, 22n],
    );
    assert.deepEqual(
        GIMarshallingTests.callbackReturnValueAndMultipleOutParameters(() => [1n, 2n, 3n]),
        [1n, 2n, 3n],
    );
});

test("out parameter tuples pad missing entries and ignore extra ones", () => {
    assert.deepEqual(
        GIMarshallingTests.callbackMultipleOutParameters(() => [1.5]),
        [1.5, 0],
    );
    assert.deepEqual(
        GIMarshallingTests.callbackMultipleOutParameters(() => [1.5, 2.5, 3.5]),
        [1.5, 2.5],
    );
    assert.deepEqual(
        GIMarshallingTests.callbackReturnValueAndMultipleOutParameters(() => [9n]),
        [9n, 0n, 0n],
    );
});

test("a boxed lent to a callback is mutable and its changes are visible to C", () => {
    const observed = [];
    const base = GIMarshallingTests.callbackOwnedBoxed((box) => {
        observed.push(box.long);
    });
    assert.equal(typeof base, "bigint");
    assert.deepEqual(observed, [base]);

    const seen = [];
    const bumped = GIMarshallingTests.callbackOwnedBoxed((box) => {
        seen.push(box instanceof GIMarshallingTests.BoxedStruct, box.long);
        box.long = 100n;
    });
    assert.deepEqual(seen, [true, base + 1n]);
    assert.equal(bumped, 100n);

    const restored = GIMarshallingTests.callbackOwnedBoxed((box) => {
        observed.push(box.long);
    });
    assert.equal(restored, 101n);
    assert.deepEqual(observed, [base, 101n]);
});

test("a boxed only lent to a callback is revoked when the callback returns", () => {
    let escaped = null;
    GIMarshallingTests.callbackOwnedBoxed((box) => {
        escaped = box;
    });
    assert.throws(() => escaped.long);
    assert.throws(() => {
        escaped.long = 1n;
    });
});

test("closure user data is elided from the arguments a JS callback receives", () => {
    const seen = [];
    GIMarshallingTests.callbackUserDataAfterCallback(1, 2, (...args) => {
        seen.push(args);
    });
    assert.deepEqual(seen, [[1, 2]]);
});

test("a callback re-enters the binding stack", () => {
    assert.equal(
        Regress.testCallback(() => Regress.testCallback(() => 21) + 21),
        42,
    );
    assert.equal(
        Regress.testMultiCallback(() => Regress.testCallbackUserData(() => Regress.testCallback(() => 5))),
        10,
    );

    let inner = 0;
    const nested = Regress.testCallback(() => {
        const obj = new Regress.TestObj({ int: 3 });
        obj.instanceMethodCallback(() => {
            inner += 1;

            return 0;
        });

        return obj.int;
    });
    assert.equal(nested, 3);
    assert.equal(inner, 1);
});

test("an exception thrown inside a callback propagates out of the C call", () => {
    assert.throws(() =>
        Regress.testCallback(() => {
            throw new Error("boom");
        }),
    );
    assert.throws(() =>
        Regress.testMultiCallback(() => {
            throw new TypeError("boom");
        }),
    );
    assert.throws(() =>
        GIMarshallingTests.callbackMultipleOutParameters(() => {
            throw new Error("boom");
        }),
    );

    assert.equal(
        Regress.testCallback(() => 9),
        9,
    );
    assert.deepEqual(
        GIMarshallingTests.callbackMultipleOutParameters(() => [4.5, 5.5]),
        [4.5, 5.5],
    );
});

test("a non function where a callback is expected throws", () => {
    assert.throws(() => Regress.testCallback(42));
    assert.throws(() => Regress.testCallback({}));
    assert.throws(() => Regress.testCallback("nope"));
    assert.throws(() => Regress.testCallback(Symbol("nope")));
    assert.throws(() => Regress.testCallbackUserData(7));
    assert.throws(() => Regress.testMultiCallback([]));
    assert.throws(() => GIMarshallingTests.callbackReturnValueOnly({}));
    assert.throws(() => Regress.TestObj.staticMethodCallback("nope"));
});

test("a non function handed to a deferred callback throws at the call site", () => {
    assert.throws(() => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5, 42));
    assert.throws(() => GLib.idleAdd(GLib.PRIORITY_DEFAULT, "nope"));
    assert.throws(() => Regress.testCallbackAsync({}));
    assert.throws(() => Regress.testCallbackDestroyNotify([]));
});

test("array callback arguments arrive without the lengths that size them", () => {
    const seen = [];
    const sum = Regress.testArrayCallback((...args) => {
        seen.push(args);

        return 1;
    });

    assert.equal(sum, 2);
    assert.equal(seen.length, 2);
    for (const args of seen) {
        assert.equal(args.length, 2);
        assert.deepEqual(args[0], [-1, 0, 1, 2]);
        assert.deepEqual(args[1], ["one", "two", "three"]);
    }
});

test("a hash table callback receives the table it was handed", () => {
    const seen = [];
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

    assert.equal(seen.length, 1);
    assert.equal(seen[0].length, 1);
    assert.deepEqual(
        new Map(seen[0][0]),
        new Map([
            ["foo", 1],
            ["bar", 2],
            ["baz", 3],
        ]),
    );
});

test("a user data slot GIR leaves unannotated is still elided", () => {
    const counts = [];
    const returned = Regress.testCallbackUserData((...args) => {
        counts.push(args.length);

        return 7;
    });

    assert.equal(returned, 7);
    assert.deepEqual(counts, [0]);
});

test("an inout array callback parameter round-trips through the handler", () => {
    const seen = [];
    const remaining = Regress.testArrayInoutCallback((...args) => {
        seen.push(args);

        return args[0].slice(1);
    });

    assert.equal(remaining, 3);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].length, 1);
    assert.deepEqual(seen[0][0], [-2, -1, 0, 1, 2]);
    assert.equal(seen[1].length, 1);
    assert.deepEqual(seen[1][0], [-1, 0, 1, 2]);
});

test("an inout array callback accepts a freshly built array as well as a slice", () => {
    const seen = [];
    const remaining = Regress.testArrayInoutCallback((ints) => {
        seen.push(ints);

        return seen.length === 1 ? [-1, 0, 1, 2] : ints.slice(1);
    });

    assert.equal(remaining, 3);
    assert.deepEqual(seen, [
        [-2, -1, 0, 1, 2],
        [-1, 0, 1, 2],
    ]);
});

test("a callback that cannot fill its out parameters throws into the caller", () => {
    assert.throws(() => GIMarshallingTests.callbackMultipleOutParameters(() => ["a", "b"]));
    assert.throws(() => GIMarshallingTests.callbackOneOutParameter(() => "nope"));
    assert.throws(() => GIMarshallingTests.callbackReturnValueAndOneOutParameter(() => [1n, {}]));
});

test("the binding survives a callback out parameter failure", () => {
    assert.throws(() => GIMarshallingTests.callbackMultipleOutParameters(() => ["a", "b"]));
    assert.equal(
        GIMarshallingTests.callbackReturnValueOnly(() => 42n),
        42n,
    );
    assert.deepEqual(
        GIMarshallingTests.callbackMultipleOutParameters(() => [1.5, 2.5]),
        [1.5, 2.5],
    );
});
