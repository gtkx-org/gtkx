import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

type Failure = "none" | "constructed" | "first";

const observedClass = (typeName: string) => {
    const events: string[] = [];
    const wrappers: WeakRef<object>[] = [];
    const state: { failure: Failure } = { failure: "none" };

    class Observed extends GObject.Object {
        declare firstValue: number | undefined;
        declare secondValue: number | undefined;

        get first(): number {
            return this.firstValue ?? 0;
        }

        set first(value: number) {
            events.push("first");
            if (state.failure === "first") {
                throw new Error("First property setter failed");
            }
            this.firstValue = value;
        }

        get second(): number {
            return this.secondValue ?? 0;
        }

        set second(value: number) {
            events.push("second");
            this.secondValue = value;
        }

        override vfuncConstructed(): void {
            super.vfuncConstructed();
            wrappers.push(new WeakRef(this));
            events.push("constructed");
            if (state.failure === "constructed") {
                throw new Error("Constructed callback failed");
            }
        }
    }

    const Registered = registerClass(Observed, {
        typeName,
        properties: {
            first: GObject.paramSpecInt("first", null, null, 0, 100, 0, GObject.ParamFlags.READWRITE),
            second: GObject.paramSpecInt("second", null, null, 0, 100, 0, GObject.ParamFlags.READWRITE),
        },
    });

    return { Registered, events, wrappers, state };
};

test("registered construction runs nonconstruct setters after constructed and releases wrappers", async () => {
    const { Registered, events, wrappers } = observedClass("GtkxConstructionErrorHappy");
    const construct = () => {
        const empty = new Registered({});
        expect(GObject.getProperty(empty, "first")).toBe(0);
        expect(GObject.getProperty(empty, "second")).toBe(0);

        const instance = new Registered({ first: 3, second: 7 });
        expect(GObject.getProperty(instance, "first")).toBe(3);
        expect(GObject.getProperty(instance, "second")).toBe(7);
    };

    construct();
    expect(events).toEqual(["constructed", "constructed", "first", "second"]);
    expect(wrappers).toHaveLength(2);
    expect(await didSettle(() => wrappers.every((wrapper) => wrapper.deref() === undefined))).toBe(true);
});

test.each([
    { failure: "constructed", expected: ["constructed"], typeName: "GtkxConstructionErrorConstructed" },
    { failure: "first", expected: ["constructed", "first"], typeName: "GtkxConstructionErrorFirstSetter" },
] as const)("a $failure exception skips later setters and preserves subsequent construction", async ({
    failure,
    expected,
    typeName,
}) => {
    const { Registered, events, wrappers, state } = observedClass(typeName);
    state.failure = failure;
    expect(() => new Registered({ first: 3, second: 7 })).toThrow();
    expect(events).toEqual(expected);
    expect(wrappers).toHaveLength(1);

    state.failure = "none";
    events.length = 0;
    const construct = () => {
        const instance = new Registered({ first: 11, second: 13 });
        expect(GObject.getProperty(instance, "first")).toBe(11);
        expect(GObject.getProperty(instance, "second")).toBe(13);
    };

    construct();
    expect(events).toEqual(["constructed", "first", "second"]);
    expect(wrappers).toHaveLength(2);
    expect(await didSettle(() => wrappers.every((wrapper) => wrapper.deref() === undefined))).toBe(true);
});
