import * as GObject from "@gtkx/gi/gobject";
import { registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";

const Payload = registerClass(class PropertyLifetimePayload extends GObject.Object {}, {
    typeName: "GtkxRuntimePropertyLifetimePayload",
});

const Holder = registerClass(
    class PropertyLifetimeHolder extends GObject.Object {
        declare held: GObject.Object | null;
    },
    {
        typeName: "GtkxRuntimePropertyLifetimeHolder",
        properties: {
            held: GObject.paramSpecObject("held", null, null, Payload, GObject.ParamFlags.READWRITE),
        },
    },
);

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function collectUntilReleased(...references: WeakRef<object>[]): Promise<void> {
    if (globalThis.gc === undefined) {
        throw new Error("Property lifetime tests require --expose-gc");
    }

    for (let round = 0; round < 30; round++) {
        await settle();
        globalThis.gc();
        await settle();
        if (references.every((reference) => reference.deref() === undefined)) {
            return;
        }
    }
}

function assignPayload(holder: InstanceType<typeof Holder>): WeakRef<GObject.Object> {
    const payload = new Payload({});
    holder.held = payload;

    return new WeakRef(payload);
}

test("registered object properties release their values when the instance is collected", async () => {
    const references = (() => {
        const holder = new Holder({});

        return { holder: new WeakRef(holder), payload: assignPayload(holder) };
    })();

    await collectUntilReleased(references.holder, references.payload);

    expect(references.holder.deref()).toBeUndefined();
    expect(references.payload.deref()).toBeUndefined();
});

test("replacing and clearing registered object properties release the previous values", async () => {
    const holder = new Holder({});
    const first = assignPayload(holder);
    const second = assignPayload(holder);

    await collectUntilReleased(first);

    expect(first.deref()).toBeUndefined();
    expect(holder.held).toBe(second.deref());
    expect(holder.held).toBeInstanceOf(Payload);

    holder.held = null;
    await collectUntilReleased(second);

    expect(second.deref()).toBeUndefined();
    expect(holder.held).toBeNull();
});

test("rejected object properties preserve the current value without retaining either value after collection", async () => {
    const references = await (async () => {
        const holder = new Holder({});
        const accepted = assignPayload(holder);
        const rejected = (() => {
            const payload = new GObject.Object({});

            expect(() => {
                holder.held = payload;
            }).toThrow(TypeError);

            return new WeakRef(payload);
        })();

        await collectUntilReleased(rejected);

        expect(rejected.deref()).toBeUndefined();
        expect(holder.held).toBe(accepted.deref());
        expect(holder.held).toBeInstanceOf(Payload);

        return { holder: new WeakRef(holder), accepted };
    })();

    await collectUntilReleased(references.holder, references.accepted);

    expect(references.holder.deref()).toBeUndefined();
    expect(references.accepted.deref()).toBeUndefined();
});
