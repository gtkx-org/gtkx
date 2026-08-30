import * as Lifecycle from "@gtkx/gi/gtkxlifecycle";
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertBalanced, collect, snapshot } from "./lifecycle-ledger.mjs";

test("generated lifecycle bindings cover the happy path", async () => {
    Lifecycle.reset();
    const callbackInvocations = (() => {
        const object = Lifecycle.Object.new("object");
        const deep = Lifecycle.DeepBoxed.new("deep");
        const deepCopy = deep.copy();
        const refBoxed = Lifecycle.RefBoxed.new("ref");
        let invocations = 0;

        assert.equal(object.getValue(), "object");
        object.setValue("updated");
        assert.equal(object.getValue(), "updated");
        assert.equal(Lifecycle.getObjectRefCount(object), 1);
        assert.equal(Lifecycle.watchObject(object), true);
        assert.equal(deep.getValue(), "deep");
        deepCopy.setValue("copy");
        assert.equal(deep.getValue(), "deep");
        assert.equal(deepCopy.getValue(), "copy");
        assert.equal(refBoxed.getValue(), "ref");
        assert.equal(refBoxed.getRefCount(), 1);

        Lifecycle.callbackRegister(() => {
            invocations += 1;
        });
        assert.equal(Lifecycle.callbacksPending(), 1);
        Lifecycle.callbacksInvoke();
        Lifecycle.callbacksRelease();

        return invocations;
    })();

    assert.equal(callbackInvocations, 1);
    await collect();
    const ledger = snapshot();

    assert.equal(ledger.objectsCreated, 1);
    assert.equal(ledger.watchedObjects, 1);
    assert.equal(ledger.deepCreated, 1);
    assert.equal(ledger.deepCopied, 1);
    assert.equal(ledger.refCreated, 1);
    assert.equal(ledger.callbacksInvoked, 1);
    assertBalanced(ledger);
});

test("generated lifecycle bindings cover edge cases", async () => {
    Lifecycle.reset();
    const callbackInvocations = (() => {
        const object = Lifecycle.Object.new("");
        const deep = Lifecycle.DeepBoxed.new("");
        const firstCopy = deep.copy();
        const secondCopy = deep.copy();
        const refBoxed = Lifecycle.RefBoxed.new("");
        let invocations = 0;

        assert.equal(Lifecycle.watchObject(object), true);
        assert.equal(Lifecycle.watchObject(object), false);
        assert.equal(Lifecycle.getObjectRefCount(object), 1);
        assert.equal(object.getValue(), "");
        assert.equal(deep.getValue(), "");
        firstCopy.setValue("first");
        secondCopy.setValue("second");
        assert.deepEqual([deep.getValue(), firstCopy.getValue(), secondCopy.getValue()], ["", "first", "second"]);
        assert.equal(refBoxed.getValue(), "");

        Lifecycle.callbackRegister(() => {
            invocations += 1;
        });
        Lifecycle.callbackRegister(() => {
            invocations += 10;
        });
        Lifecycle.callbacksInvoke();
        Lifecycle.callbacksInvoke();
        assert.equal(Lifecycle.callbacksPending(), 2);
        Lifecycle.callbacksRelease();
        Lifecycle.callbacksRelease();
        Lifecycle.callbacksInvoke();

        return invocations;
    })();

    assert.equal(callbackInvocations, 22);
    await collect();
    const ledger = snapshot();

    assert.equal(ledger.watchedObjects, 1);
    assert.equal(ledger.deepCopied, 2);
    assert.equal(ledger.callbacksRegistered, 2);
    assert.equal(ledger.callbacksInvoked, 4);
    assertBalanced(ledger);
});

test("generated lifecycle bindings cover error paths", () => {
    Lifecycle.reset();

    assert.throws(() => Lifecycle.Object.new());
    assert.throws(() => Lifecycle.DeepBoxed.new());
    assert.throws(() => Lifecycle.RefBoxed.new());
    assert.throws(() => Lifecycle.getObjectRefCount(null));
    assert.throws(() => Lifecycle.watchObject(null));
    assert.throws(() => Lifecycle.callbackRegister());
});
