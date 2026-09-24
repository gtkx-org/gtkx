import assert from "node:assert/strict";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const library = process.argv[2];
const mode = process.argv[3];
assert.ok(library);
assert.ok(mode === "complete" || mode === "cancel");

const worker = new Worker(fileURLToPath(new URL("worker-cleanup-task.ts", import.meta.url)), {
    workerData: { library, mode },
});
const messages: unknown[] = await once(worker, "message");
const [report] = messages;
assert.deepEqual(report, { completed: 1, cancelled: mode === "cancel", signalCalls: 1, queuedCollected: true });
assert.equal(await worker.terminate(), 1);

const { bind, call, quit } = await import("@gtkx/native");
const count = { kind: "uint32" } as const;
const integer = { kind: "int32" } as const;
const finalized = bind(library, "gtkx_worker_cleanup_finalized", [count], integer);
const disposed = bind(library, "gtkx_worker_cleanup_disposed", [count], integer);
const wrongThread = bind(library, "gtkx_worker_cleanup_wrong_thread", [], integer);
const jsEntries = bind(library, "gtkx_worker_cleanup_js_entries", [], integer);

try {
    assert.deepEqual([0, 1, 2, 3].map((kind) => call(finalized, [kind]).value), [1, 1, 1, 1]);
    assert.deepEqual([0, 1, 2, 3].map((kind) => call(disposed, [kind]).value), [1, 1, 1, 1]);
    assert.equal(call(wrongThread, []).value, 0);
    assert.equal(call(jsEntries, []).value, 0);
} finally {
    quit();
}
