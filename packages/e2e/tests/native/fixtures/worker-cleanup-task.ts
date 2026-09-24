import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import {
    bind,
    bindVfunc,
    call,
    type Descriptor,
    type ExternalObject,
    getType,
    getWrapper,
    type Handle,
    newObject,
    registerClass,
    resolveType,
    setWrapper,
} from "@gtkx/native";
import { quit } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { parentPort, workerData } from "node:worker_threads";

type NativeHandle = ExternalObject<Handle>;
type Wrapper = { handle?: NativeHandle };
type Setup = { library: string; mode: "complete" | "cancel" };

const { library, mode } = workerData as Setup;
assert.ok(parentPort);
const port = parentPort;
const UINT: Descriptor = { kind: "uint32" };
const INT: Descriptor = { kind: "int32" };
const VOID: Descriptor = { kind: "void" };
const OBJECT: Descriptor = { kind: "object", ownership: "borrowed" };
const TEARDOWN_OBJECT: Descriptor = { kind: "object", ownership: "borrowed", isCallScoped: true };
const parentType = resolveType(library, "gtkx_worker_cleanup_object_get_type");
const create = bind(library, "gtkx_worker_cleanup_new", [UINT], { kind: "object", ownership: "full" });
const kindBinding = bind(library, "gtkx_worker_cleanup_set_kind", [OBJECT, UINT], VOID);
const disposed = bind(library, "gtkx_worker_cleanup_disposed", [UINT], INT);
const finalized = bind(library, "gtkx_worker_cleanup_finalized", [UINT], INT);
const noteJsEntry = bind(library, "gtkx_worker_cleanup_note_js_entry", [], VOID);
const offset = (symbol: string): number => call(bind(library, symbol, [], UINT), []).value as number;
const disposeOffset = offset("gtkx_worker_cleanup_dispose_offset");
const finalizeOffset = offset("gtkx_worker_cleanup_finalize_offset");
const parentSlot = (byteOffset: number) => bindVfunc({
    instanceType: parentType,
    byteOffset,
    label: "GtkxWorkerCleanupObject",
    argDescriptors: [OBJECT],
    returnDescriptor: VOID,
});
const parentDispose = parentSlot(disposeOffset);
const parentFinalize = parentSlot(finalizeOffset);
const subtype = registerClass("GtkxWorkerCleanupSubclass", parentType, {
    vfuncs: [
        {
            byteOffset: disposeOffset,
            argDescriptors: [TEARDOWN_OBJECT],
            returnDescriptor: VOID,
            fn: (instance: NativeHandle) => {
                call(noteJsEntry, []);
                call(parentDispose, [instance]);
            },
        },
        {
            byteOffset: finalizeOffset,
            argDescriptors: [TEARDOWN_OBJECT],
            returnDescriptor: VOID,
            fn: (instance: NativeHandle) => {
                call(noteJsEntry, []);
                call(parentFinalize, [instance]);
            },
        },
    ],
});

const wrapped = (type: bigint, kind: number): Wrapper => {
    const wrapper: Wrapper = {};
    newObject(type, [], [], wrapper, (handle) => {
        wrapper.handle = handle;
        setWrapper(handle, wrapper);
    });
    assert.ok(wrapper.handle);
    assert.equal(getType(wrapper.handle), type);
    assert.equal(getWrapper(wrapper.handle), wrapper);
    call(kindBinding, [wrapper.handle, kind]);

    return wrapper;
};

const raw = call(create, [0]).value as NativeHandle;
assert.equal(getType(raw), parentType);
const retained: object[] = [raw, wrapped(parentType, 1), wrapped(subtype, 2)];
const subjects: { queued: Wrapper | undefined } = { queued: wrapped(parentType, 3) };
assert.ok(subjects.queued);
const queuedWeak = new WeakRef(subjects.queued);
const action = Gio.SimpleAction.new("cleanup", null);
const observed = { signalCalls: 0, completed: 0 };
const handler = (): void => {
    observed.signalCalls += 1;
};
action.on("activate", handler);
action.activate(null);
action.off("activate", handler);
action.activate(null);
assert.equal(observed.signalCalls, 1);

const context = GLib.MainContext.new();
const cancellable = Gio.Cancellable.new();
if (mode === "cancel") {
    cancellable.cancel();
}
const completion = Promise.withResolvers<undefined>();
context.pushThreadDefault();
let task: Gio.Task;
try {
    task = Gio.Task.new(null, cancellable, (source, result) => {
        try {
            assert.equal(source, null);
            assert.ok(result instanceof Gio.Task);
            observed.completed += 1;
            if (mode === "cancel") {
                assert.throws(() => result.propagateInt());
            } else {
                assert.equal(result.propagateInt(), 23);
            }
            completion.resolve(undefined);
        } catch (error) {
            completion.reject(error);
        }
    });
} finally {
    context.popThreadDefault();
}
task.returnInt(23);
assert.equal(context.iteration(false), true);
await completion.promise;
assert.equal(observed.completed, 1);
quit();
subjects.queued = undefined;

assert.ok(globalThis.gc);
for (let round = 0; round < 100 && queuedWeak.deref() !== undefined; round++) {
    await setImmediate();
    globalThis.gc();
    await setImmediate();
}
assert.equal(queuedWeak.deref(), undefined);
assert.deepEqual([0, 1, 2, 3].map((kind) => call(finalized, [kind]).value), [0, 0, 0, 0]);
assert.deepEqual([0, 1, 2, 3].map((kind) => call(disposed, [kind]).value), [0, 0, 0, 0]);
port.on("message", () => {
    assert.equal(retained.length, 3);
});
port.postMessage({ ...observed, cancelled: mode === "cancel", queuedCollected: true });
