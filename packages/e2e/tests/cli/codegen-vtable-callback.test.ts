import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import {
    compileNativeFixture,
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckSource,
} from "./type-consumer.js";

const FIXTURE = fileURLToPath(new URL("fixtures/hook-slots.c", import.meta.url));
const CONSUMER = `import assert from "node:assert/strict";
import {
    Station, type HookFunc, getDataDestroyCount, getCallbackCount,
    getBaseCallCount, getNullCallCount, getLastValue, getBaseResult,
} from "@gtkx/gi/hookslots";
import { quit, registerClass } from "@gtkx/runtime";

const retained: { callback: HookFunc | null } = { callback: null };
const observed: (boolean | null)[] = [];
let shouldThrow = false;

class Receiver extends Station {
    override vfuncWatch(callback: HookFunc | null): void {
        if (shouldThrow) {
            throw new Error("Receiver rejected the callback");
        }
        retained.callback = callback;
        observed.push(callback === null ? null : callback(12));
        super.vfuncWatch(callback);
    }

    send(callback: HookFunc | null): void {
        super.vfuncWatch(callback);
    }
}

const collectUntil = async (ready: () => boolean): Promise<void> => {
    const collect = globalThis.gc;
    assert.ok(collect);
    for (let index = 0; index < 64 && !ready(); index++) {
        collect();
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
    assert.equal(ready(), true);
};

const invokeRetained = (): void => {
    const callback = retained.callback;
    assert.ok(callback);
    assert.equal(callback(7), false);
};

try {
    const Registered = registerClass(Receiver, { typeName: "GtkxNotifiedReceiver" });
    const receiver = new Registered();
    const destroyed = getDataDestroyCount();
    const calls = getCallbackCount();
    const baseCalls = getBaseCallCount();
    const nullCalls = getNullCallCount();

    receiver.invokeWatch(true);
    assert.deepEqual(observed, [true]);
    assert.equal(getCallbackCount(), calls + 2);
    assert.equal(getBaseCallCount(), baseCalls + 1);
    assert.equal(getLastValue(), 42);
    assert.equal(getBaseResult(), true);
    assert.equal(getDataDestroyCount(), destroyed);
    invokeRetained();
    assert.equal(getCallbackCount(), calls + 3);
    retained.callback = null;
    await collectUntil(() => getDataDestroyCount() === destroyed + 1);

    receiver.invokeWatch(false);
    assert.deepEqual(observed, [true, null]);
    assert.equal(getNullCallCount(), nullCalls + 1);
    assert.equal(getBaseResult(), false);
    assert.equal(getDataDestroyCount(), destroyed + 1);

    const sent: number[] = [];
    receiver.send((value) => { sent.push(value); return value === 42; });
    assert.deepEqual(sent, [42]);
    assert.equal(getBaseResult(), true);
    const beforeInvalid = getBaseCallCount();
    assert.throws(() => Reflect.apply(receiver.send, receiver, ["invalid"]));
    assert.equal(getBaseCallCount(), beforeInvalid);

    shouldThrow = true;
    assert.throws(() => receiver.invokeWatch(true));
    assert.equal(getBaseCallCount(), beforeInvalid);
    await collectUntil(() => getDataDestroyCount() === destroyed + 2);
} finally {
    retained.callback = null;
    quit();
}
`;

describe("generated virtual callback consumers", () => {
    it("retains notified callbacks across subclass chain-up and releases their native data", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-vtable-callback-",
            config: fixtureConfig("HookSlots-1.0"),
            files: { "probe.ts": CONSUMER },
        });
        expect(runCli(project, ["codegen"]).status).toBe(0);
        compileNativeFixture(project, FIXTURE, "libhookslots.so.0", "gobject-2.0");
        expect(() => {
            runNativeConsumer(project, "probe.ts", ["--expose-gc"]);
        }).not.toThrow();
        isolateTypeConsumer(project);
        expect(typecheckSource(project, CONSUMER)).toBe(0);
    });
});
