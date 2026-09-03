import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { getInstanceType, registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

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

const askCalls: [unknown, unknown][] = [];
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
    const calls: unknown[][] = [];
    const emit: (signal: "test") => unknown = obj.emit.bind(obj);
    const handlerId = obj.connect("test", (...args) => {
        calls.push(args);
    });

    expect(typeof handlerId).toBe("number");
    // @ts-expect-error connect hands back a number and the handler-id parameter is declared bigint
    expect(GObject.signalHandlerIsConnected(obj, handlerId)).toBe(true);
    expect(emit("test")).toBeUndefined();
    expect(calls).toEqual([[]]);

    obj.emit("test");
    expect(calls).toHaveLength(2);
});

test("every connected handler runs, with after handlers last", () => {
    const obj = new Regress.TestObj({});
    const order: string[] = [];
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
    expect(order).toEqual(["first", "second", "after"]);
});

test("a disconnected handler no longer runs", () => {
    const obj = new Regress.TestObj({});
    const runs: boolean[] = [];
    const kept: boolean[] = [];
    const handlerId = obj.connect("test", () => {
        runs.push(true);
    });

    const keptId = obj.connect("test", () => {
        kept.push(true);
    });

    obj.emit("test");
    expect(runs).toHaveLength(1);
    expect(kept).toHaveLength(1);

    obj.disconnect(handlerId);
    // @ts-expect-error connect hands back a number and the handler-id parameter is declared bigint
    expect(GObject.signalHandlerIsConnected(obj, handlerId)).toBe(false);
    obj.emit("test");
    expect(runs).toHaveLength(1);
    expect(kept).toHaveLength(2);

    // @ts-expect-error connect hands back a number and the handler-id parameter is declared bigint
    GObject.signalHandlerDisconnect(obj, keptId);
    // @ts-expect-error connect hands back a number and the handler-id parameter is declared bigint
    expect(GObject.signalHandlerIsConnected(obj, keptId)).toBe(false);
    obj.emit("test");
    expect(kept).toHaveLength(2);
});

test("on, once and off connect and remove handlers by function", () => {
    const obj = new Regress.TestObj({});
    const seen: string[] = [];
    const handler = () => {
        seen.push("on");
    };

    obj.on("test", handler);
    obj.emit("test");
    expect(seen).toEqual(["on"]);

    obj.off("test", handler);
    obj.emit("test");
    expect(seen).toEqual(["on"]);

    obj.once("test", () => {
        seen.push("once");
    });
    obj.emit("test");
    obj.emit("test");
    expect(seen).toEqual(["on", "once"]);
});

test("natural connect and collision-safe signal and property helpers remain independent", () => {
    const socket = Gio.Socket.new(Gio.SocketFamily.IPV4, Gio.SocketType.DATAGRAM, Gio.SocketProtocol.UDP);
    const address = Gio.InetSocketAddress.new(Gio.InetAddress.newLoopback(Gio.SocketFamily.IPV4), 9);
    expect(socket.connect(address, null)).toBe(true);

    const states: boolean[] = [];
    const handlerId = GObject.signalConnect(socket, "notify::blocking", () => {
        states.push(GObject.getObjectProperty(socket, "blocking"));
    });

    GObject.setObjectProperty(socket, "blocking", false);
    expect(states).toEqual([false]);
    GObject.signalDisconnect(socket, handlerId);
    GObject.setObjectProperty(socket, "blocking", true);
    expect(states).toEqual([false]);
    expect(socket.close()).toBe(true);
});

test("an object signal argument arrives as the very wrapper it was emitted with", () => {
    const obj = new Regress.TestObj({ int: 11 });
    const received: GObject.Object[] = [];
    const handlerId = obj.connect("sig-with-obj", (argument) => {
        received.push(argument);
    });

    obj.emit("sig-with-obj", obj);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(obj);
    expect((received[0] as Regress.TestObj).int).toBe(11);

    obj.disconnect(handlerId);
    received.length = 0;
});

test("object signal arguments emitted from C decode by transfer", () => {
    const obj = new Regress.TestObj({});
    const none: GObject.Object[] = [];
    const full: GObject.Object[] = [];
    const noneId = obj.connect("sig-with-obj", (argument) => {
        none.push(argument);
    });

    const fullId = obj.connect("sig-with-obj-full", (argument) => {
        full.push(argument);
    });

    obj.emitSigWithObj();
    expect(none).toHaveLength(1);
    expect(none[0] instanceof Regress.TestObj).toBeTruthy();
    expect((none[0] as Regress.TestObj).int).toBe(3);
    expect(none[0]).not.toBe(obj);

    obj.emitSigWithObjFull();
    expect(full).toHaveLength(1);
    expect(full[0] instanceof Regress.TestObj).toBeTruthy();
    expect((full[0] as Regress.TestObj).int).toBe(5);

    obj.disconnect(noneId);
    obj.disconnect(fullId);
    none.length = 0;
    full.length = 0;
});

test("64-bit signal arguments reach the handler as bigints", () => {
    const obj = new Regress.TestObj({});
    const signed: bigint[] = [];
    const unsigned: bigint[] = [];
    obj.connect("sig-with-int64-prop", (i) => {
        signed.push(i);
    });

    obj.connect("sig-with-uint64-prop", (i) => {
        unsigned.push(i);
    });

    obj.emit("sig-with-int64-prop", 2n ** 63n - 1n);
    obj.emit("sig-with-int64-prop", -(2n ** 63n));
    expect(signed).toEqual([2n ** 63n - 1n, -(2n ** 63n)]);

    obj.emit("sig-with-uint64-prop", 2n ** 64n - 1n);
    obj.emit("sig-with-uint64-prop", 0n);
    expect(unsigned).toEqual([2n ** 64n - 1n, 0n]);
});

test("the inout signal argument the handler returns is written back to C", () => {
    const obj = new Regress.TestObj({});
    const positions: number[] = [];
    obj.connect("sig-with-inout-int", (position) => {
        positions.push(position);

        return position + 1;
    });

    expect(obj.emit("sig-with-inout-int", 10)).toBe(11);
    expect(positions).toEqual([10]);

    obj.emitSigWithInoutInt();
    expect(positions).toEqual([10, 42]);
});

test("array signal arguments decode to JS arrays", () => {
    const obj = new Regress.TestObj({});
    const lengths: [number[] | null, number][] = [];
    const strvs: string[][] = [];
    obj.connect("sig-with-array-len-prop", (arr, len) => {
        lengths.push([arr, len]);
    });

    obj.connect("sig-with-strv", (strs) => {
        strvs.push(strs);
    });

    obj.emitSigWithArrayLenProp();
    expect(lengths).toEqual([[[0, 1, 2, 3, 4], 5]]);

    obj.emit("sig-with-strv", ["one", "two", "three"]);
    expect(strvs).toEqual([["one", "two", "three"]]);

    obj.emit("sig-with-strv", []);
    expect(strvs[1]).toEqual([]);
});

test("a handler's return value reaches the emitter even for a void declared marshaller", () => {
    const obj = new Regress.TestObj({});
    obj.connect("sig-with-uint64-prop", () => 99n);
    obj.connect("sig-with-int64-prop", () => 77n);

    expect(obj.emit("sig-with-uint64-prop", 7n)).toBe(99n);
    expect(obj.emit("sig-with-int64-prop", 42n)).toBe(77n);
    expect(obj.emit("sig-with-uint64-prop", 0n)).toBe(99n);
});

test("the last connected handler's return value is the one the emitter sees", () => {
    const obj = new Regress.TestObj({});
    obj.connect("sig-with-int64-prop", () => 1n);
    obj.connect("sig-with-int64-prop", () => 2n);

    expect(obj.emit("sig-with-int64-prop", 0n)).toBe(2n);
});

test("a string returning signal hands the emitter the string the handler built", () => {
    const obj = new Regress.AnnotationObject({});
    const seen: [string, string][] = [];
    obj.connect("attribute-signal", (arg1, arg2) => {
        seen.push([arg1, arg2]);

        return `${arg1}-${arg2}`;
    });

    expect(obj.emit("attribute-signal", "one", "two")).toBe("one-two");
    expect(seen).toEqual([["one", "two"]]);
});

test("a handler returning nothing leaves the emitter with the default value", () => {
    const obj = new Regress.TestObj({});
    const calls: boolean[] = [];
    obj.connect("sig-with-uint64-prop", () => {
        calls.push(true);
    });

    expect(obj.emit("sig-with-uint64-prop", 7n)).toBe(0n);
    expect(calls).toHaveLength(1);
});

test("a transfer full strv signal argument reaches the handler without being freed twice", () => {
    const obj = new Regress.TestObj({});
    const seen: string[][] = [];
    obj.connect("sig-with-strv-full", (strs) => {
        seen.push(strs);
    });

    obj.emitSigWithGstrvFull();
    obj.emitSigWithGstrvFull();
    expect(seen).toEqual([
        ["foo", "bar", "baz"],
        ["foo", "bar", "baz"],
    ]);
});

test("two handlers on the same transfer full signal both see the argument", () => {
    const obj = new Regress.TestObj({});
    const seen: string[][] = [];
    obj.connect("sig-with-strv-full", (strs) => {
        seen.push(strs);
    });

    obj.connect("sig-with-strv-full", (strs) => {
        seen.push(strs);
    });

    obj.emitSigWithGstrvFull();
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual(["foo", "bar", "baz"]);
    expect(seen[1]).toEqual(["foo", "bar", "baz"]);
});

test("a transfer full object signal argument keeps its reference across emissions", () => {
    const obj = new Regress.TestObj({});
    const seen: number[] = [];
    obj.connect("sig-with-obj-full", (received) => {
        seen.push((received as Regress.TestObj).int);
    });

    obj.emitSigWithObjFull();
    obj.emitSigWithObjFull();
    expect(seen).toEqual([5, 5]);
});

test("the gerror signal argument decodes and accepts null", () => {
    const obj = new Regress.TestObj({});
    const errors: (string | null)[] = [];
    obj.connect("sig-with-gerror", (error) => {
        errors.push(error === null ? null : error.message);
    });

    obj.emitSigWithError();
    expect(errors).toEqual(["Something failed"]);

    obj.emitSigWithNullError();
    expect(errors).toEqual(["Something failed", null]);

    obj.emit("sig-with-gerror", null);
    expect(errors).toEqual(["Something failed", null, null]);
});

test("the static scope boxed signal argument decodes to its wrapper", () => {
    const obj = new Regress.TestObj({});
    const boxes: [boolean, number, number, number][] = [];
    obj.connect("test-with-static-scope-arg", (boxed) => {
        boxes.push([boxed instanceof Regress.TestSimpleBoxedA, boxed.someInt, boxed.someInt8, boxed.someDouble]);
    });

    obj.emit("test-with-static-scope-arg", new Regress.TestSimpleBoxedA({ someInt: 9, someInt8: 3, someDouble: 4 }));
    expect(boxes).toEqual([[true, 9, 3, 4]]);
});

test("a detailed signal only reaches the handlers of its own detail", () => {
    const obj = new Regress.TestObj({});
    const seen: string[] = [];
    obj.connect("all", () => {
        seen.push("plain");
    });

    obj.connect("all::mine", () => {
        seen.push("mine");
    });

    obj.emit("all::mine");
    expect(seen).toEqual(["plain", "mine"]);

    seen.length = 0;
    obj.emit("all::other");
    expect(seen).toEqual(["plain"]);

    seen.length = 0;
    obj.emit("all");
    expect(seen).toEqual(["plain"]);
});

test("run-first and run-cleanup signals reach their handlers", () => {
    const obj = new Regress.TestObj({});
    const seen: string[] = [];
    obj.connect("first", () => {
        seen.push("first");
    });

    obj.connect("cleanup", () => {
        seen.push("cleanup");
    });

    obj.emit("first");
    obj.emit("cleanup");
    expect(seen).toEqual(["first", "cleanup"]);
});

test("an interface signal reaches handlers on an implementing instance", () => {
    const sub = Regress.TestSubObj.new();
    const pointers: number[] = [];
    const inherited: boolean[] = [];
    sub.connect("interface-signal", (ptr) => {
        pointers.push(ptr);
    });

    sub.connect("test", () => {
        inherited.push(true);
    });

    sub.emitSignal();
    expect(pointers).toEqual([0]);

    sub.emit("interface-signal", 5);
    expect(pointers).toEqual([0, 5]);

    sub.emit("test");
    expect(inherited).toHaveLength(1);
});

test("signal ids and names resolve through the GObject signal API", () => {
    const testId = GObject.signalLookup("test", Regress.TestObj);
    expect(testId > 0).toBeTruthy();
    expect(GObject.signalName(testId)).toBe("test");
    expect(GObject.signalLookup("first", Regress.TestObj)).not.toBe(testId);
    expect(GObject.signalListIds(Regress.TestObj).includes(testId)).toBeTruthy();
    const shoutId = GObject.signalLookup("shout", Shouting);
    expect(shoutId > 0).toBeTruthy();
    const shoutType = getInstanceType(new Shouting({}));
    expect(GObject.signalLookup("shout", shoutType)).toBe(shoutId);
    expect(GObject.signalLookup("shout", Regress.TestObj)).toBe(0);
});

test("a declared signal carries its handler's return value back to the emitter", () => {
    const instance = new Shouting({});
    const heard: string[] = [];
    instance.connect("shout", (text) => {
        if (typeof text === "string") {
            heard.push(text);
        }

        return 7;
    });

    expect(instance.emit("shout", "hey")).toBe(7);
    expect(heard).toEqual(["hey"]);

    expect(instance.emit("shout", "again")).toBe(7);
    expect(heard).toEqual(["hey", "again"]);
});

test("a class closure override runs with the emitter and returns its value", () => {
    const instance = new Answering({});

    expect(instance.emit("ask", "why")).toBe(42);
    expect(askCalls).toHaveLength(1);
    expect(askCalls[0]?.[0]).toBe(instance);
    expect(askCalls[0]?.[1]).toBe("why");
    expect(getInstanceType(instance)).toBe(GObject.typeFromName(`GtkxSignalsAnswerer${suffix}`));

    askCalls.length = 0;
});

test("a class closure override only runs for the derived type", () => {
    const derived = new Quieting({});
    const plain = new Regress.TestObj({});
    const before = quietRuns.count;

    derived.emit("test");
    expect(quietRuns.count).toBe(before + 1);

    plain.emit("test");
    expect(quietRuns.count).toBe(before + 1);

    derived.emit("test");
    expect(quietRuns.count).toBe(before + 2);
});

test("connecting to or emitting a signal the type does not have throws", () => {
    const obj = new Regress.TestObj({});
    const unsupported = {} as Regress.TestObj;
    expect(() => GObject.signalConnect(unsupported, "test", spareHandler)).toThrow();
    expect(() => {
        GObject.signalEmit(unsupported, "test");
    }).toThrow();
    // @ts-expect-error no-such-signal is not a TestObj signal
    expect(() => obj.connect("no-such-signal", spareHandler)).toThrow();
    // @ts-expect-error no-such-signal is not a TestObj signal
    expect(() => obj.emit("no-such-signal")).toThrow();
    // @ts-expect-error interface-signal is not a TestObj signal
    expect(() => obj.emit("interface-signal", 1)).toThrow();
});

test("signal emission rejects arguments of the wrong type", () => {
    const obj = new Regress.TestObj({});
    expect(() => {
        // @ts-expect-error a plain object is not a GObject
        obj.emit("sig-with-obj", {});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a GObject
        obj.emit("sig-with-obj", "nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a GObject
        obj.emit("sig-with-obj", Symbol("nope"));
    }).toThrow();
    // @ts-expect-error a string is not an int64
    expect(() => obj.emit("sig-with-int64-prop", "nope")).toThrow();
    // @ts-expect-error a symbol is not an int64
    expect(() => obj.emit("sig-with-int64-prop", Symbol("nope"))).toThrow();
    expect(() => obj.emit("sig-with-inout-int", 1.5)).toThrow();
    // @ts-expect-error a string is not an inout int
    expect(() => obj.emit("sig-with-inout-int", "nope")).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a strv
        obj.emit("sig-with-strv", 42);
    }).toThrow();
});

test("a declared signal rejects the wrong argument count and types", () => {
    const instance = new Picking({});
    expect(() => instance.emit("pick")).toThrow();
    expect(() => instance.emit("pick", "a", "b")).toThrow();
    expect(() => instance.emit("pick", 42)).toThrow();
    expect(() => instance.emit("pick", {})).toThrow();
});

test("overriding a class closure with a value that is not a closure throws", () => {
    const signalId = GObject.signalLookup("hum", Muting);
    expect(signalId > 0).toBeTruthy();
    expect(() => {
        // @ts-expect-error a number is not a closure
        GObject.signalOverrideClassClosure(signalId, Muting, 42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a closure
        GObject.signalOverrideClassClosure(signalId, Muting, "nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a closure
        GObject.signalOverrideClassClosure(signalId, Muting, {});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a closure
        GObject.signalOverrideClassClosure(signalId, Muting, Symbol("nope"));
    }).toThrow();
});
