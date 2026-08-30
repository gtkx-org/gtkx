import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Worker } from "node:worker_threads";
import * as native from "../main.js";

const GLIB = "libglib-2.0.so.0";
const GIO = "libgio-2.0.so.0";
const GOBJECT = "libgobject-2.0.so.0";
const LIBDL = "libdl.so.2";
const BIGUINT64 = { kind: "biguint64" };
const INT32 = { kind: "int32" };
const UINT32 = { kind: "uint32" };
const STRING = { kind: "string", ownership: "borrowed" };
const VOID = { kind: "void" };
const FUNCTIONS = [
    "alloc",
    "bind",
    "bindField",
    "bindFunctionPointer",
    "bindVfunc",
    "call",
    "copy",
    "getFundamentalWrapper",
    "getType",
    "getTypeClass",
    "getWrapper",
    "init",
    "keepAlive",
    "newObject",
    "quit",
    "read",
    "readField",
    "registerClass",
    "resolveType",
    "setFundamentalWrapper",
    "setWrapper",
    "write",
    "writeField",
];

const collect = async () => {
    for (let round = 0; round < 5; round += 1) {
        globalThis.gc?.();
        await new Promise((resolve) => setImmediate(resolve));
    }
};

const runWorker = (mode = "graceful") =>
    new Promise((resolve, reject) => {
        const worker = new Worker(new URL("worker-fixture.mjs", import.meta.url), { workerData: mode });
        const shouldTerminate = mode.endsWith("terminate");
        let hasCompleted = false;

        worker.once("message", async (value) => {
            hasCompleted = value === 37;
            if (shouldTerminate) {
                try {
                    await worker.terminate();
                } catch (error) {
                    reject(error);
                }
            }
        });
        worker.once("error", reject);
        worker.once("exit", (code) => {
            if (hasCompleted && (code === 0 || shouldTerminate)) {
                resolve();

                return;
            }

            reject(new Error("worker failed"));
        });
    });

after(async () => {
    await collect();
    native.keepAlive(false);
    native.quit();
});

test("the public loader initializes the complete function surface", () => {
    const functions = Object.entries(native)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => name)
        .toSorted((left, right) => left.localeCompare(right));

    assert.deepEqual(functions, FUNCTIONS);
    native.keepAlive(false);
    native.keepAlive(false);
    assert.doesNotThrow(() => native.init());
});

test("memory and field access cover happy, edge, and error paths", () => {
    const source = native.alloc(8);
    const destination = native.alloc(8);
    const field = native.bindField(UINT32);

    assert.equal(native.read(source, UINT32, 0), 0);
    native.write(source, UINT32, 0, 23);
    native.writeField(field, source, 4, 37);
    assert.equal(native.readField(field, source, 4), 37);
    native.copy(destination, source, 8);
    assert.deepEqual([native.read(destination, UINT32, 0), native.readField(field, destination, 4)], [23, 37]);

    native.copy(destination, destination, 0);
    assert.equal(native.read(destination, UINT32, 0), 23);

    assert.throws(() => native.alloc(-1));
    assert.throws(() => native.write(source, UINT32, 0, true));
    assert.throws(() => native.read(source, UINT32, -1));
    assert.throws(() => native.bindField({ kind: "not-a-descriptor" }));
});

test("symbols and function pointers cover happy, edge, and error paths", () => {
    const gobjectType = native.resolveType(GOBJECT, "g_object_get_type");
    const compare = native.bind(GLIB, "g_strcmp0", [STRING, STRING], INT32);
    const dlsym = native.bind(LIBDL, "dlsym", [BIGUINT64, STRING], BIGUINT64);
    const strlenAddress = native.call(dlsym, [0n, "strlen"]);
    const strlen = native.bindFunctionPointer(strlenAddress, [STRING], BIGUINT64, "strlen");

    assert.ok(gobjectType > 0n);
    assert.equal(native.call(compare, ["alpha", "alpha"]), 0);
    assert.equal(native.call(compare, [null, null]), 0);
    assert.equal(native.call(strlen, ["gtkx"]), 4n);
    assert.equal(native.resolveType(GOBJECT, "gtkx_missing_get_type"), 0n);

    assert.throws(() => native.call(compare, ["alpha"]));
    assert.throws(() => native.bindFunctionPointer(0n, [], VOID, "null"));
    assert.throws(() => native.call(native.bind(GLIB, "gtkx_missing_symbol", [], VOID), []));
});

test("GObject types and wrappers cover happy, edge, and error paths", async () => {
    const gobjectType = native.resolveType(GOBJECT, "g_object_get_type");
    const classHandle = native.getTypeClass(gobjectType);
    const borrowedObject = { kind: "object", ownership: "borrowed" };
    const gobjectRef = native.bind(GOBJECT, "g_object_ref", [borrowedObject], BIGUINT64);
    const gobjectUnref = native.bind(GOBJECT, "g_object_unref", [borrowedObject], VOID);
    const wrapper = { value: 37 };
    let objectHandle;

    const existing = native.newObject(gobjectType, [], [], wrapper, (handle, associated) => {
        objectHandle = handle;
        native.setWrapper(handle, associated);
    });

    assert.equal(existing, null);
    assert.equal(native.read(classHandle, BIGUINT64, 0), gobjectType);
    assert.equal(native.getType(objectHandle), gobjectType);
    assert.equal(native.getWrapper(objectHandle), wrapper);

    const name = `GtkxNodeNative${process.pid}`;
    const registered = native.registerClass(name, gobjectType);
    const fromName = native.call(native.bind(GOBJECT, "g_type_from_name", [STRING], BIGUINT64), [name]);

    assert.ok(registered > 0n);
    assert.equal(fromName, registered);
    assert.equal(native.getType(native.alloc(1)), 0n);
    assert.equal(native.getWrapper(native.alloc(1)), null);

    let retainedHandle;

    {
        const retainedWrapper = {};

        native.newObject(gobjectType, [], [], retainedWrapper, (handle, associated) => {
            retainedHandle = handle;
            native.setWrapper(handle, associated);
        });
    }

    native.quit();
    native.init();
    native.call(gobjectRef, [retainedHandle]);
    await collect();
    assert.notEqual(native.getWrapper(retainedHandle), null);
    native.call(gobjectUnref, [retainedHandle]);

    assert.throws(() => native.setWrapper(native.alloc(1), {}));
    assert.throws(() => native.getTypeClass(0n));
    assert.throws(() => native.registerClass(name, gobjectType));
    assert.throws(() => native.newObject(gobjectType, ["missing"], [], {}, () => null));
});

test("fundamental identity and vfunc binding cover happy, edge, and error paths", () => {
    const borrowedObject = { kind: "object", ownership: "borrowed" };
    const fullObject = { kind: "object", ownership: "full" };
    const variantDescriptor = {
        kind: "fundamental",
        ownership: "full",
        sharedLibrary: GLIB,
        refFnName: "g_variant_ref_sink",
        unrefFnName: "g_variant_unref",
        typeName: "GVariant",
    };
    const variant = native.call(native.bind(GLIB, "g_variant_new_uint32", [UINT32], variantDescriptor), [37]);
    const wrapper = { value: 37 };
    const menu = native.call(native.bind(GIO, "g_menu_new", [], fullObject), []);
    const menuType = native.resolveType(GIO, "g_menu_get_type");
    const vfunc = native.bindVfunc({
        instanceType: menuType,
        byteOffset: 136,
        label: "GMenuModelClass.is_mutable",
        argDescriptors: [borrowedObject],
        returnDescriptor: { kind: "boolean" },
    });

    native.setFundamentalWrapper(variant, wrapper);
    assert.equal(native.getFundamentalWrapper(variant), wrapper);
    assert.equal(native.call(vfunc, [menu]), true);

    const plain = native.alloc(1);
    native.setFundamentalWrapper(plain, {});
    assert.equal(native.getFundamentalWrapper(plain), null);

    assert.throws(() => native.bindVfunc({
        byteOffset: 0,
        label: "missing",
        argDescriptors: [],
        returnDescriptor: VOID,
    }));
});

test("worker environments initialize and tear down independently", async () => {
    await assert.rejects(runWorker());
    await collect();
    native.keepAlive(false);
    native.quit();
    await runWorker();
    await runWorker("natural");
    await runWorker("terminate");
    await runWorker("natural");
    await runWorker("wrapper-terminate");
    await runWorker("natural");
    native.init();
});
