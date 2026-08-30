import * as Lifecycle from "@gtkx/gi/gtkxlifecycle";
import assert from "node:assert/strict";

const collect = async () => {
    for (let round = 0; round < 10; round += 1) {
        globalThis.gc();
        await new Promise((resolve) => setImmediate(resolve));
    }
};

const snapshot = () => JSON.parse(Lifecycle.snapshot());

const assertBalanced = (ledger) => {
    assert.equal(ledger.objectsDisposed, ledger.objectsCreated);
    assert.equal(ledger.objectsFinalized, ledger.objectsCreated);
    assert.equal(ledger.objectsWeakNotified, ledger.objectsCreated);
    assert.equal(ledger.watchedWeakNotified, ledger.watchedObjects);
    assert.equal(ledger.watchedFinalized, ledger.watchedObjects);
    assert.equal(ledger.deepFreed, ledger.deepCreated + ledger.deepCopied);
    assert.equal(ledger.refReleased, ledger.refCreated + ledger.refAcquired);
    assert.equal(ledger.refFinalized, ledger.refCreated);
    assert.equal(ledger.callbacksDestroyed, ledger.callbacksRegistered);
    assert.equal(ledger.watchedActive, 0);
    assert.equal(ledger.deepLive, 0);
    assert.equal(ledger.refLive, 0);
    assert.equal(ledger.callbacksPending, 0);
    assert.equal(ledger.deepDuplicateFrees, 0);
    assert.equal(ledger.refDuplicateReleases, 0);
};

export { assertBalanced, collect, snapshot };
