import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import { getClassType, getHandle, quit, t, toClosure, wrapHandle } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

const mode = process.argv[2];
assert.ok(mode !== undefined && ["natural", "explicit", "explicit-error"].includes(mode));

const newTask = t.bind("libgio-2.0.so.0", "g_task_new", [
    t.object("borrowed"),
    t.object("borrowed"),
    t.callback([t.object("borrowed"), t.object("borrowed"), t.biguint64], t.void, {
        hasUserData: true, userDataIndex: 2, scope: "async",
    }),
], t.object("full"));
const returnValue = t.bind("libgio-2.0.so.0", "g_task_return_value", [
    t.object("borrowed"),
    t.boxed("GValue", { sharedLibrary: "libgobject-2.0.so.0", getTypeFnName: "g_value_get_type" }),
], t.void);
const isCompleted = t.bind("libgio-2.0.so.0", "g_task_get_completed", [t.object("borrowed")], t.boolean);
const observed = { calls: 0 };

const taskWithClosureValue = (): { task: object | undefined; closure: WeakRef<object>; context: GLib.MainContext } => {
    const closure = wrapHandle(toClosure(() => {
        observed.calls += 1;
    }), GObject.Closure);
    const value = new GObject.Value();
    value.init(getClassType(GObject.Closure));
    value.setBoxed(closure);
    const context = GLib.MainContext.new();
    context.pushThreadDefault();
    try {
        const task = newTask(null, null, null);
        assert.ok(typeof task === "object" && task !== null);
        returnValue(task, getHandle(value));

        return { task, closure: new WeakRef(closure), context };
    } finally {
        context.popThreadDefault();
        value.unset();
    }
};

const collect = async (value: WeakRef<object>): Promise<void> => {
    assert.ok(globalThis.gc);
    for (let round = 0; round < 100 && value.deref() !== undefined; round++) {
        await setImmediate();
        globalThis.gc();
        await setImmediate();
    }
    assert.equal(value.deref(), undefined);
};

const subjects = taskWithClosureValue();
assert.equal(subjects.context.iteration(false), true);
assert.equal(isCompleted(subjects.task), true);
assert.equal(subjects.context.pending(), false);
await collect(subjects.closure);
assert.ok(subjects.task);
const owner = new WeakRef(subjects.task);
quit();
subjects.task = undefined;
await collect(owner);
assert.equal(observed.calls, 0);

if (mode === "explicit" || mode === "explicit-error") {
    process.exit(mode === "explicit-error" ? 23 : 0);
}
