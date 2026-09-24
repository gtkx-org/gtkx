import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.callbacks",
    libraries: ["CallbackPointers-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as CallbackPointers from "@gtkx/gi/callbackpointers";
`;
const ACCEPTED = IMPORTS + `
const compareObjects = (a: GObject.Object | null, b: GObject.Object | null): number => a === b ? 0 : 1;
export const callbackInputs = (object: GObject.Object, result: Gio.AsyncResult, iterator: GLib.SequenceIter) => {
    const ready: Parameters<Gio.AsyncReadyCallback> = [object, result];
    const compare: Parameters<GLib.SequenceIterCompareFunc> = [iterator, iterator];
    const source: Parameters<GLib.SourceFunc> = [];
    const destroy: Parameters<GLib.DestroyNotify> = [];
    const idle: Parameters<typeof GLib.idleAdd> = [0, () => false];
    const explicit: Parameters<CallbackPointers.SafeFolded> = [object, 3];
    const named: Parameters<CallbackPointers.SafeNamed> = [null, 4];
    const alias: Parameters<CallbackPointers.SafeAlias> = [object, 5];
    const bytes: Parameters<CallbackPointers.SafeBytes> = [new Uint8Array([1, 2])];
    return { ready, compare, source, destroy, idle, explicit, named, alias, bytes };
};
export const callbacks = (probe: CallbackPointers.Probe, store: CallbackPointers.Store) => {
    probe.useSafe((source, count) => source !== null && count > 0);
    probe.useNamed((source, count) => source === null || count === 0);
    probe.useBytes((bytes) => { void bytes; });
    store.sortWithAlias(compareObjects);
};
export const comparators = (store: Gio.ListStore, item: GObject.Object) => {
    store.sort(compareObjects);
    const equal: [boolean, number] = store.findWithEqualFuncFull(item, (a, b) => a === b);
    const sorter = Gtk.CustomSorter.new(compareObjects);
    sorter.setSortFunc(null);
    return { equal, sorter };
};
`;
const REJECTED: Record<string, string> = {
    "raw-input-type": "export type Callback = CallbackPointers.RawInput;",
    "aliased-input-type": "export type Callback = CallbackPointers.AliasInput;",
    "raw-output-type": "export type Callback = CallbackPointers.RawOutput;",
    "raw-return-type": "export type Callback = CallbackPointers.RawReturn;",
    "skipped-return-type": "export type Callback = CallbackPointers.SkippedReturn;",
    "collection-type": "export type Callback = CallbackPointers.CollectionInput;",
    "nested-callback-type": "export type Callback = CallbackPointers.NestedCallback;",
    "callback-return-type": "export type Callback = CallbackPointers.CallbackReturn;",
    "unsafe-alias": "export type Callback = CallbackPointers.RawAlias;",
    "generic-comparator-alias": "export type Callback = CallbackPointers.CompareAlias;",
    "raw-owner": "export type Method = CallbackPointers.Probe[\"useRaw\"];",
    "alias-owner": "export type Method = CallbackPointers.Probe[\"useAlias\"];",
    "output-owner": "export type Method = CallbackPointers.Probe[\"useOutput\"];",
    "return-owner": "export type Method = CallbackPointers.Probe[\"useReturn\"];",
    "collection-owner": "export type Method = CallbackPointers.Probe[\"useCollection\"];",
    "static-owner": "export const factory = CallbackPointers.Probe.newWithRaw;",
    "namespace-owner": "export const invoke = CallbackPointers.useRaw;",
    "task-thread": "export type Method = Gio.Task[\"runInThread\"];",
    "task-thread-sync": "export type Method = Gio.Task[\"runInThreadSync\"];",
    "byte-array-comparator": "export const sort = GLib.ByteArray.sort;",
    "byte-array-data-comparator": "export const sort = GLib.ByteArray.sortWithData;",
    "thread-callback-type": "export type Callback = Gio.TaskThreadFunc;",
    "copy-callback-type": "export type Callback = GLib.CopyFunc;",
    "async-extra-data": "export const args = (result: Gio.AsyncResult): Parameters<Gio.AsyncReadyCallback> => " +
        "[null, result, null];",
    "alias-extra-data": "export const args: Parameters<CallbackPointers.SafeAlias> = [null, 1, null];",
};
const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import { quit } from "@gtkx/runtime";

try {
    assert.equal("runInThread" in Gio.Task.prototype, false);
    assert.equal("runInThreadSync" in Gio.Task.prototype, false);
    assert.equal("sort" in GLib.ByteArray, false);
    assert.equal("sortWithData" in GLib.ByteArray, false);
    const context = GLib.MainContext.new();
    const source = GLib.idleSourceNew();
    const sourceCalls: unknown[][] = [];
    try {
        source.setCallback((...args) => {
            sourceCalls.push(args);
            return false;
        });
        source.attach(context);
        assert.equal(context.iteration(false), true);
        assert.deepEqual(sourceCalls, [[]]);
        assert.equal(source.isDestroyed(), true);
    } finally {
        source.destroy();
    }
    const owner = Gio.SimpleAction.new("owner", null);
    for (const cancelled of [false, true]) {
        const cancellable = Gio.Cancellable.new();
        if (cancelled) {
            cancellable.cancel();
        }
        const calls: Parameters<Gio.AsyncReadyCallback>[] = [];
        context.pushThreadDefault();
        let task: Gio.Task;
        try {
            task = Gio.Task.new(owner, cancellable, (...args) => { calls.push(args); });
        } finally {
            context.popThreadDefault();
        }
        task.returnInt(23);
        assert.equal(context.iteration(false), true);
        assert.equal(calls.length, 1);
        const [args] = calls;
        assert.ok(args);
        assert.equal(args.length, 2);
        assert.equal(args[0], owner);
        assert.equal(args[1], task);
        if (cancelled) {
            assert.throws(() => task.propagateInt());
        } else {
            assert.equal(task.propagateInt(), 23);
        }
    }
    const first = Gio.SimpleAction.new("first", null);
    const second = Gio.SimpleAction.new("second", null);
    const store = Gio.ListStore.new(Gio.SimpleAction);
    const compared: (GObject.Object | null)[][] = [];
    store.append(second);
    store.append(first);
    store.sort((a, b) => {
        compared.push([a, b]);
        assert.ok(a === first || a === second);
        assert.ok(b === first || b === second);
        return a === b ? 0 : a === first ? -1 : 1;
    });
    assert.ok(compared.length > 0);
    assert.equal(store.getItem(0), first);
    assert.equal(store.getItem(1), second);
    const equalCalls: (GObject.Object | null)[][] = [];
    assert.deepEqual(store.findWithEqualFuncFull(first, (a, b) => {
        equalCalls.push([a, b]);
        return a === b;
    }), [true, 0]);
    assert.deepEqual(equalCalls, [[first, first]]);
    store.removeAll();
} finally {
    quit();
}
`;
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.ts`, IMPORTS + source,
]));
const CALLBACK_OMISSIONS = [
    "RawInput", "AliasInput", "RawOutput", "RawReturn", "SkippedReturn", "CollectionInput", "NestedCallback",
    "CallbackReturn",
    "RawAlias", "CompareAlias",
];
const METHOD_OMISSIONS = [
    "useRaw", "useAlias", "useOutput", "useReturn", "useSkipped", "useCollection", "useNested", "useCallbackReturn",
    "newWithRaw",
];

describe("generated effective callback contracts", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/CallbackPointers-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-callback-signatures-",
            config: CONFIG,
            files: {
                "gir/CallbackPointers-1.0.gir": fixture,
                "accepted.ts": ACCEPTED,
                "native.ts": NATIVE_CONSUMER,
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts the effective callback arity, typed payloads and specialized object comparators", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects unsupported callback contract %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });

    it("aligns public callback and owner reference pages with the effective signatures", () => {
        const reference = loadApiReference({
            libraries: ["CallbackPointers-1.0", "Gtk-4.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        for (const name of CALLBACK_OMISSIONS) {
            expect(reference.lookup(`CallbackPointers.${name}`).outcome).toBe("notFound");
        }
        const probe = reference.lookup("CallbackPointers.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of METHOD_OMISSIONS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        expect(probe).toHaveProperty("markdown", expect.stringContaining("### `useSafe`"));
        expect(reference.lookup("CallbackPointers.SafeAlias", "alias").outcome).toBe("page");
        expect(reference.lookup("CallbackPointers.useRaw", "function").outcome).toBe("notFound");
        const ready = reference.lookup("Gio.AsyncReadyCallback", "callback");
        expect(ready.outcome).toBe("page");
        expect(ready).toHaveProperty("markdown", expect.stringContaining("res: Gio.AsyncResult) => void"));
        const source = reference.lookup("GLib.SourceFunc", "callback");
        expect(source).toHaveProperty("markdown", expect.stringContaining("type SourceFunc = () => boolean"));
        expect(reference.lookup("Gio.TaskThreadFunc", "callback").outcome).toBe("notFound");
    });

    it("dispatches real source, completion and object comparator callbacks with the public shape", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-callback-values-",
            config: 'export default { applicationId: "org.gtkx.callbackvalues", libraries: ["Gio-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
