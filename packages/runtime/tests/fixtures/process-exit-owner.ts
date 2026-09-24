import * as Gio from "@gtkx/gi/gio";
import { getHandle, quit, t } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

const mode = process.argv[2];
assert.ok(mode !== undefined && ["explicit", "explicit-error", "natural", "empty"].includes(mode));

if (mode === "empty") {
    quit();
    process.exit(0);
}

const action = Gio.SimpleAction.new("process-exit-owner", null);
const reference = t.bind(
    "libgobject-2.0.so.0",
    "g_object_ref",
    [t.object("borrowed")],
    t.object("full"),
);
const extraOwner = (): WeakRef<object> => {
    const handle = reference(getHandle(action));
    assert.ok(typeof handle === "object" && handle !== null);

    return new WeakRef(handle);
};
const owned = extraOwner();
quit();

assert.ok(globalThis.gc);
for (let round = 0; round < 100 && owned.deref() !== undefined; round++) {
    await setImmediate();
    globalThis.gc();
    await setImmediate();
}
assert.equal(owned.deref(), undefined);
await setImmediate();
assert.equal(action.getName(), "process-exit-owner");

if (mode === "explicit" || mode === "explicit-error") {
    process.exit(mode === "explicit-error" ? 23 : 0);
}
