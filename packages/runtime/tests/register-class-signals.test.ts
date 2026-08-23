import { Object as GObject, SignalFlags } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, type SignalSpec, TYPE_BOOLEAN, TYPE_INT, TYPE_NONE, TYPE_STRING } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const misspell = (name: string): string => name;

const registerSignals = <TSignals extends Record<string, SignalSpec>>(prefix: string, signals: TSignals) => {
    class Emitter extends GObject {}

    return registerClass(Emitter, { typeName: uniqueName(prefix), signals });
};

describe("registerClass — declaring signals", () => {
    it("declares a signal whose handlers receive the emitted arguments", () => {
        const Registered = registerSignals("GtkxSignalBroadcaster", {
            "data-received": { paramTypes: [TYPE_STRING, TYPE_INT] },
        });

        const instance = new Registered();
        const seen: [string, number][] = [];

        instance.connect("data-received", (text: string, count: number) => {
            seen.push([text, count]);
        });

        const result = instance.emit("data-received", "hello", 3);
        expect(result).toBeUndefined();
        expect(seen).toEqual([["hello", 3]]);
    });

    it("takes a wrapper class as a parameter GType and delivers a wrapper instance", () => {
        const Registered = registerSignals("GtkxSignalHolder", { "holder-changed": { paramTypes: [GObject] } });
        const instance = new Registered();
        const payload = new GObject({});
        const received: unknown[] = [];

        instance.connect("holder-changed", (holder: GObject) => {
            received.push(holder);
        });

        instance.emit("holder-changed", payload);
        expect(received).toHaveLength(1);
        expect(received[0]).toBeInstanceOf(GObject);
    });
});

describe("registerClass — signal accumulators", () => {
    it("keeps the first handler's result and stops the emission with first-wins", () => {
        const Registered = registerSignals("GtkxSignalPicker", {
            pick: { returnType: TYPE_STRING, accumulator: "first-wins" },
        });

        const instance = new Registered();
        let isSecondRan = false;
        instance.connect("pick", () => "first");

        instance.connect("pick", () => {
            isSecondRan = true;

            return "second";
        });

        expect(instance.emit("pick")).toBe("first");
        expect(isSecondRan).toBe(false);
    });

    it("stops at the first true and reports it with true-handled", () => {
        const Registered = registerSignals("GtkxSignalHandled", {
            handle: { returnType: TYPE_BOOLEAN, accumulator: "true-handled" },
        });

        const instance = new Registered();
        const calls: string[] = [];

        instance.connect("handle", () => {
            calls.push("first");

            return false;
        });

        instance.connect("handle", () => {
            calls.push("second");

            return true;
        });

        instance.connect("handle", () => {
            calls.push("third");

            return false;
        });

        expect(instance.emit("handle")).toBe(true);
        expect(calls).toEqual(["first", "second"]);
    });
});

describe("registerClass — declared signals through the listener surface", () => {
    it("serves declared signals through on and off alongside inherited ones", () => {
        class FancyButton extends Gtk.Button {}

        const Registered = registerClass(FancyButton, {
            typeName: uniqueName("GtkxSignalButton"),
            signals: { boop: {} },
        });

        const button = new Registered();
        let boops = 0;
        let clicks = 0;

        const onBoop = (): void => {
            boops += 1;
        };

        button.on("boop", onBoop);

        button.connect("clicked", () => {
            clicks += 1;
        });

        button.emit("boop");
        button.emit("clicked");
        button.off("boop", onBoop);
        button.emit("boop");
        expect(boops).toBe(1);
        expect(clicks).toBe(1);
    });

    it("stops delivering to a handler after disconnect", () => {
        const Registered = registerSignals("GtkxSignalMutable", { tick: {} });
        const instance = new Registered();
        let ticks = 0;

        const handlerId = instance.connect("tick", () => {
            ticks += 1;
        });

        instance.emit("tick");
        instance.disconnect(handlerId);
        instance.emit("tick");
        expect(ticks).toBe(1);
    });
});

describe("registerClass — signal edge cases", () => {
    it("declares a signal with no parameters and no return value", () => {
        const Registered = registerSignals("GtkxSignalPinger", { ping: {} });
        const instance = new Registered();
        const seen: unknown[][] = [];

        instance.connect("ping", (...args: unknown[]) => {
            seen.push(args);
        });

        expect(instance.emit("ping")).toBeUndefined();
        expect(seen).toEqual([[]]);
    });

    it("treats an explicit none return type as no return value", () => {
        const Registered = registerSignals("GtkxSignalQuiet", { hush: { returnType: TYPE_NONE } });
        const instance = new Registered();
        let isRan = false;

        instance.connect("hush", () => {
            isRan = true;
        });

        expect(instance.emit("hush")).toBeUndefined();
        expect(isRan).toBe(true);
    });

    it("invokes declared-signal handlers with the same receiver as inherited signals", () => {
        const Registered = registerSignals("GtkxSignalReceiver", { ping: {} });
        const instance = new Registered();
        const label = new Gtk.Label();
        const receivers: unknown[] = [];

        instance.connect("ping", function (this: unknown) {
            receivers.push(this);
        });

        label.connect("notify::label", function (this: unknown) {
            receivers.push(this);
        });

        instance.emit("ping");
        label.label = "changed";
        expect(receivers).toEqual([null, null]);
    });

    it("canonicalizes underscores so both spellings name the same signal", () => {
        const Registered = registerSignals("GtkxSignalRenamer", { ["data_changed"]: { paramTypes: [TYPE_INT] } });
        const instance = new Registered();
        const seen: number[] = [];

        instance.connect("data-changed", (value: number) => {
            seen.push(value);
        });

        instance.emit("data_changed", 7);
        instance.emit("data-changed", 8);
        expect(seen).toEqual([7, 8]);
    });
});

describe("registerClass — detailed and staged signals", () => {
    it("routes detailed emissions to the matching detail when flags include DETAILED", () => {
        const Registered = registerSignals("GtkxSignalAlerter", {
            alert: { flags: SignalFlags.RUN_LAST | SignalFlags.DETAILED, paramTypes: [TYPE_STRING] },
        });

        const instance = new Registered();
        const reds: string[] = [];
        const blues: string[] = [];
        const all: string[] = [];

        instance.connect("alert::red", (message: string) => {
            reds.push(message);
        });

        instance.connect("alert::blue", (message: string) => {
            blues.push(message);
        });

        instance.connect("alert", (message: string) => {
            all.push(message);
        });

        instance.emit("alert::red", "warning");
        expect(reds).toEqual(["warning"]);
        expect(blues).toEqual([]);
        expect(all).toEqual(["warning"]);
    });

    it("runs a handler connected with isAfter after the other handlers", () => {
        const Registered = registerSignals("GtkxSignalStaged", { staged: { flags: SignalFlags.RUN_LAST } });
        const instance = new Registered();
        const order: string[] = [];

        instance.connect(
            "staged",
            () => {
                order.push("after");
            },
            true,
        );

        instance.connect("staged", () => {
            order.push("normal");
        });

        instance.emit("staged");
        expect(order).toEqual(["normal", "after"]);
    });
});

describe("registerClass — signals on subclasses", () => {
    it("keeps a subclass's own signals alongside the ones its registered parent declared", () => {
        const RegisteredBase = registerSignals("GtkxSignalBase", { ping: {} });
        class Sub extends RegisteredBase {}

        const RegisteredSub = registerClass(Sub, {
            typeName: uniqueName("GtkxSignalSub"),
            signals: { pong: {} },
        });

        const parent = new RegisteredBase();
        const child = new RegisteredSub();
        const calls: string[] = [];

        child.connect("ping", () => {
            calls.push("ping");
        });

        child.connect("pong", () => {
            calls.push("pong");
        });

        child.emit("ping");
        child.emit("pong");
        expect(calls).toEqual(["ping", "pong"]);
        expect(() => parent.emit("pong")).toThrow();
    });
});

describe("registerClass — signal error paths: names and accumulators", () => {
    it("throws for an invalid signal name", () => {
        expect(() => registerSignals("GtkxSignalBadName", { "9bad": {} })).toThrow();
    });

    it("throws for an unknown accumulator", () => {
        const accumulator = misspell("maximum") as NonNullable<SignalSpec["accumulator"]>;

        expect(() =>
            registerSignals("GtkxSignalBadAccumulator", {
                combined: { returnType: TYPE_BOOLEAN, accumulator },
            }),
        ).toThrow();
    });

    it("throws for true-handled on a signal without a boolean return", () => {
        expect(() =>
            registerSignals("GtkxSignalBadHandled", {
                handled: { returnType: TYPE_STRING, accumulator: "true-handled" },
            }),
        ).toThrow();
    });

    it("throws for a signal name an ancestor type already carries", () => {
        class Clicky extends Gtk.Button {}

        expect(() =>
            registerClass(Clicky, {
                typeName: uniqueName("GtkxSignalClicky"),
                signals: { clicked: {} },
            }),
        ).toThrow();
    });

    it("throws for a signal name spelled in camelCase", () => {
        expect(() => registerSignals("GtkxSignalCamelName", { dataChanged: {} })).toThrow();
    });

    it("throws for the same signal declared under both spellings", () => {
        expect(() =>
            registerSignals("GtkxSignalDoubled", { ["flip_flop"]: {}, "flip-flop": {} }),
        ).toThrow();
    });
});

describe("registerClass — signal error paths: emission arity", () => {
    it("throws when emit passes fewer arguments than the signal declares", () => {
        const Registered = registerSignals("GtkxSignalUnderfed", {
            fed: { paramTypes: [TYPE_STRING, TYPE_INT] },
        });

        const instance = new Registered();
        expect(() => instance.emit("fed", "only")).toThrow();
    });

    it("throws when emit passes more arguments than the signal declares", () => {
        const Registered = registerSignals("GtkxSignalOverfed", { fed: { paramTypes: [TYPE_INT] } });
        const instance = new Registered();
        expect(() => instance.emit("fed", 1, 2)).toThrow();
    });
});

describe("registerClass — signal error paths: parameter types", () => {
    it("throws for an invalid parameter GType", () => {
        expect(() => registerSignals("GtkxSignalBadParam", { broken: { paramTypes: [0n] } })).toThrow();
    });

    it("throws for a parameter GType that cannot hold a value", () => {
        expect(() => registerSignals("GtkxSignalVoidParam", { broken: { paramTypes: [TYPE_NONE] } })).toThrow();
    });

    it("throws for a parameter class with no registered GType", () => {
        class Plain {
            declare __type__: bigint;
            marker = "no-gtype";
        }

        expect(() =>
            registerSignals("GtkxSignalBadClassParam", { broken: { paramTypes: [Plain] } }),
        ).toThrow();
    });
});
