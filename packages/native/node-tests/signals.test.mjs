import assert from "node:assert/strict";
import { test } from "node:test";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { getInstanceType, registerClass } from "@gtkx/runtime";
import { installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

const suffix = String(process.pid);

const spareHandler = () => 1;

class Shouter extends Regress.TestObj {}
class Answerer extends Regress.TestObj {}
class Quiet extends Regress.TestObj {}
class Picky extends Regress.TestObj {}
class Mute extends Regress.TestObj {}

const Shouting = registerClass(Shouter, {
    typeName: `GtkxSignalsShouter${suffix}`,
    signals: {
        shout: { flags: GObject.SignalFlags.RUN_LAST, paramTypes: [GObject.TYPE_STRING], returnType: GObject.TYPE_INT },
    },
});

const Answering = registerClass(Answerer, {
    typeName: `GtkxSignalsAnswerer${suffix}`,
    signals: {
        ask: { flags: GObject.SignalFlags.RUN_LAST, paramTypes: [GObject.TYPE_STRING], returnType: GObject.TYPE_INT },
    },
});

const Quieting = registerClass(Quiet, { typeName: `GtkxSignalsQuiet${suffix}` });
const Picking = registerClass(Picky, {
    typeName: `GtkxSignalsPicky${suffix}`,
    signals: { pick: { paramTypes: [GObject.TYPE_STRING] } },
});
const Muting = registerClass(Mute, { typeName: `GtkxSignalsMute${suffix}`, signals: { hum: {} } });

const askCalls = [];
const quietRuns = { count: 0 };

GObject.signalOverrideClassClosure(GObject.signalLookup("ask", Answering), Answering, (emitter, question) => {
    askCalls.push([emitter, question]);

    return 42;
});

GObject.signalOverrideClassClosure(GObject.signalLookup("test", Quieting), Quieting, () => {
    quietRuns.count += 1;
});

test("the test signal runs its connected handler with no arguments", () => {
    const obj = new Regress.TestObj({});
    const calls = [];
    const handlerId = obj.connect("test", (...args) => {
        calls.push(args);
    });

    assert.equal(typeof handlerId, "number");
    assert.equal(GObject.signalHandlerIsConnected(obj, handlerId), true);
    assert.equal(obj.emit("test"), undefined);
    assert.deepEqual(calls, [[]]);

    obj.emit("test");
    assert.equal(calls.length, 2);
});

test("every connected handler runs, with after handlers last", () => {
    const obj = new Regress.TestObj({});
    const order = [];
    obj.connect("test", () => {
        order.push("first");
    });

    obj.connect(
        "test",
        () => {
            order.push("after");
        },
        true,
    );

    obj.connect("test", () => {
        order.push("second");
    });

    obj.emit("test");
    assert.deepEqual(order, ["first", "second", "after"]);
});

test("a disconnected handler no longer runs", () => {
    const obj = new Regress.TestObj({});
    const runs = [];
    const kept = [];
    const handlerId = obj.connect("test", () => {
        runs.push(true);
    });

    const keptId = obj.connect("test", () => {
        kept.push(true);
    });

    obj.emit("test");
    assert.equal(runs.length, 1);
    assert.equal(kept.length, 1);

    obj.disconnect(handlerId);
    assert.equal(GObject.signalHandlerIsConnected(obj, handlerId), false);
    obj.emit("test");
    assert.equal(runs.length, 1);
    assert.equal(kept.length, 2);

    GObject.signalHandlerDisconnect(obj, keptId);
    assert.equal(GObject.signalHandlerIsConnected(obj, keptId), false);
    obj.emit("test");
    assert.equal(kept.length, 2);
});

test("on, once and off connect and remove handlers by function", () => {
    const obj = new Regress.TestObj({});
    const seen = [];
    const handler = () => {
        seen.push("on");
    };

    obj.on("test", handler);
    obj.emit("test");
    assert.deepEqual(seen, ["on"]);

    obj.off("test", handler);
    obj.emit("test");
    assert.deepEqual(seen, ["on"]);

    obj.once("test", () => {
        seen.push("once");
    });
    obj.emit("test");
    obj.emit("test");
    assert.deepEqual(seen, ["on", "once"]);
});

test("an object signal argument arrives as the very wrapper it was emitted with", () => {
    const obj = new Regress.TestObj({ int: 11 });
    const received = [];
    const handlerId = obj.connect("sig-with-obj", (argument) => {
        received.push(argument);
    });

    obj.emit("sig-with-obj", obj);
    assert.equal(received.length, 1);
    assert.equal(received[0], obj);
    assert.equal(received[0].int, 11);

    obj.disconnect(handlerId);
    received.length = 0;
});

test("object signal arguments emitted from C decode by transfer", () => {
    const obj = new Regress.TestObj({});
    const none = [];
    const full = [];
    const noneId = obj.connect("sig-with-obj", (argument) => {
        none.push(argument);
    });

    const fullId = obj.connect("sig-with-obj-full", (argument) => {
        full.push(argument);
    });

    obj.emitSigWithObj();
    assert.equal(none.length, 1);
    assert.ok(none[0] instanceof Regress.TestObj);
    assert.equal(none[0].int, 3);
    assert.notEqual(none[0], obj);

    obj.emitSigWithObjFull();
    assert.equal(full.length, 1);
    assert.ok(full[0] instanceof Regress.TestObj);
    assert.equal(full[0].int, 5);

    obj.disconnect(noneId);
    obj.disconnect(fullId);
    none.length = 0;
    full.length = 0;
});

test("64-bit signal arguments reach the handler as bigints", () => {
    const obj = new Regress.TestObj({});
    const signed = [];
    const unsigned = [];
    obj.connect("sig-with-int64-prop", (i) => {
        signed.push(i);
    });

    obj.connect("sig-with-uint64-prop", (i) => {
        unsigned.push(i);
    });

    obj.emit("sig-with-int64-prop", 2n ** 63n - 1n);
    obj.emit("sig-with-int64-prop", -(2n ** 63n));
    assert.deepEqual(signed, [2n ** 63n - 1n, -(2n ** 63n)]);

    obj.emit("sig-with-uint64-prop", 2n ** 64n - 1n);
    obj.emit("sig-with-uint64-prop", 0n);
    assert.deepEqual(unsigned, [2n ** 64n - 1n, 0n]);
});

test("the inout signal argument the handler returns is written back to C", () => {
    const obj = new Regress.TestObj({});
    const positions = [];
    obj.connect("sig-with-inout-int", (position) => {
        positions.push(position);

        return position + 1;
    });

    assert.equal(obj.emit("sig-with-inout-int", 10), 11);
    assert.deepEqual(positions, [10]);

    obj.emitSigWithInoutInt();
    assert.deepEqual(positions, [10, 42]);
});

test("array signal arguments decode to JS arrays", () => {
    const obj = new Regress.TestObj({});
    const lengths = [];
    const strvs = [];
    obj.connect("sig-with-array-len-prop", (arr, len) => {
        lengths.push([arr, len]);
    });

    obj.connect("sig-with-strv", (strs) => {
        strvs.push(strs);
    });

    obj.emitSigWithArrayLenProp();
    assert.deepEqual(lengths, [[[0, 1, 2, 3, 4], 5]]);

    obj.emit("sig-with-strv", ["one", "two", "three"]);
    assert.deepEqual(strvs, [["one", "two", "three"]]);

    obj.emit("sig-with-strv", []);
    assert.deepEqual(strvs[1], []);
});

test("the gerror signal argument decodes and accepts null", () => {
    const obj = new Regress.TestObj({});
    const errors = [];
    obj.connect("sig-with-gerror", (error) => {
        errors.push(error === null ? null : error.message);
    });

    obj.emitSigWithError();
    assert.deepEqual(errors, ["Something failed"]);

    obj.emitSigWithNullError();
    assert.deepEqual(errors, ["Something failed", null]);

    obj.emit("sig-with-gerror", null);
    assert.deepEqual(errors, ["Something failed", null, null]);
});

test("the static scope boxed signal argument decodes to its wrapper", () => {
    const obj = new Regress.TestObj({});
    const boxes = [];
    obj.connect("test-with-static-scope-arg", (boxed) => {
        boxes.push([boxed instanceof Regress.TestSimpleBoxedA, boxed.someInt, boxed.someInt8, boxed.someDouble]);
    });

    obj.emit("test-with-static-scope-arg", new Regress.TestSimpleBoxedA({ someInt: 9, someInt8: 3, someDouble: 4 }));
    assert.deepEqual(boxes, [[true, 9, 3, 4]]);
});

test("a detailed signal only reaches the handlers of its own detail", () => {
    const obj = new Regress.TestObj({});
    const seen = [];
    obj.connect("all", () => {
        seen.push("plain");
    });

    obj.connect("all::mine", () => {
        seen.push("mine");
    });

    obj.emit("all::mine");
    assert.deepEqual(seen, ["plain", "mine"]);

    seen.length = 0;
    obj.emit("all::other");
    assert.deepEqual(seen, ["plain"]);

    seen.length = 0;
    obj.emit("all");
    assert.deepEqual(seen, ["plain"]);
});

test("run-first and run-cleanup signals reach their handlers", () => {
    const obj = new Regress.TestObj({});
    const seen = [];
    obj.connect("first", () => {
        seen.push("first");
    });

    obj.connect("cleanup", () => {
        seen.push("cleanup");
    });

    obj.emit("first");
    obj.emit("cleanup");
    assert.deepEqual(seen, ["first", "cleanup"]);
});

test("an interface signal reaches handlers on an implementing instance", () => {
    const sub = Regress.TestSubObj.new();
    const pointers = [];
    const inherited = [];
    sub.connect("interface-signal", (ptr) => {
        pointers.push(ptr);
    });

    sub.connect("test", () => {
        inherited.push(true);
    });

    sub.emitSignal();
    assert.deepEqual(pointers, [0]);

    sub.emit("interface-signal", 5);
    assert.deepEqual(pointers, [0, 5]);

    sub.emit("test");
    assert.equal(inherited.length, 1);
});

test("signal ids and names resolve through the GObject signal API", () => {
    const testId = GObject.signalLookup("test", Regress.TestObj);
    assert.ok(testId > 0);
    assert.equal(GObject.signalName(testId), "test");
    assert.notEqual(GObject.signalLookup("first", Regress.TestObj), testId);
    assert.ok(GObject.signalListIds(Regress.TestObj).includes(testId));
    const shoutId = GObject.signalLookup("shout", Shouting);
    assert.ok(shoutId > 0);
    const shoutType = getInstanceType(new Shouting({}));
    assert.equal(GObject.signalLookup("shout", shoutType), shoutId);
    assert.equal(GObject.signalLookup("shout", Regress.TestObj), 0);
});

test("a declared signal carries its handler's return value back to the emitter", () => {
    const instance = new Shouting({});
    const heard = [];
    instance.connect("shout", (text) => {
        heard.push(text);

        return 7;
    });

    assert.equal(instance.emit("shout", "hey"), 7);
    assert.deepEqual(heard, ["hey"]);

    assert.equal(instance.emit("shout", "again"), 7);
    assert.deepEqual(heard, ["hey", "again"]);
});

test("a class closure override runs with the emitter and returns its value", () => {
    const instance = new Answering({});

    assert.equal(instance.emit("ask", "why"), 42);
    assert.equal(askCalls.length, 1);
    assert.equal(askCalls[0][0], instance);
    assert.equal(askCalls[0][1], "why");
    assert.equal(getInstanceType(instance), GObject.typeFromName(`GtkxSignalsAnswerer${suffix}`));

    askCalls.length = 0;
});

test("a class closure override only runs for the derived type", () => {
    const derived = new Quieting({});
    const plain = new Regress.TestObj({});
    const before = quietRuns.count;

    derived.emit("test");
    assert.equal(quietRuns.count, before + 1);

    plain.emit("test");
    assert.equal(quietRuns.count, before + 1);

    derived.emit("test");
    assert.equal(quietRuns.count, before + 2);
});

test("connecting to or emitting a signal the type does not have throws", () => {
    const obj = new Regress.TestObj({});
    assert.throws(() => obj.connect("no-such-signal", spareHandler));
    assert.throws(() => obj.emit("no-such-signal"));
    assert.throws(() => obj.emit("interface-signal", 1));
});

test("signal emission rejects arguments of the wrong type", () => {
    const obj = new Regress.TestObj({});
    assert.throws(() => obj.emit("sig-with-obj", {}));
    assert.throws(() => obj.emit("sig-with-obj", "nope"));
    assert.throws(() => obj.emit("sig-with-obj", Symbol("nope")));
    assert.throws(() => obj.emit("sig-with-int64-prop", "nope"));
    assert.throws(() => obj.emit("sig-with-int64-prop", Symbol("nope")));
    assert.throws(() => obj.emit("sig-with-inout-int", 1.5));
    assert.throws(() => obj.emit("sig-with-inout-int", "nope"));
    assert.throws(() => obj.emit("sig-with-strv", 42));
});

test("a declared signal rejects the wrong argument count and types", () => {
    const instance = new Picking({});
    assert.throws(() => instance.emit("pick"));
    assert.throws(() => instance.emit("pick", "a", "b"));
    assert.throws(() => instance.emit("pick", 42));
    assert.throws(() => instance.emit("pick", {}));
});

test("overriding a class closure with a value that is not a closure throws", () => {
    const signalId = GObject.signalLookup("hum", Muting);
    assert.ok(signalId > 0);
    assert.throws(() => GObject.signalOverrideClassClosure(signalId, Muting, 42));
    assert.throws(() => GObject.signalOverrideClassClosure(signalId, Muting, "nope"));
    assert.throws(() => GObject.signalOverrideClassClosure(signalId, Muting, {}));
    assert.throws(() => GObject.signalOverrideClassClosure(signalId, Muting, Symbol("nope")));
});
