import { isMainThread, parentPort, Worker } from "node:worker_threads";

if (isMainThread) {
    const results: unknown[] = [];
    for (let index = 0; index < 2; index++) {
        const worker = new Worker(new URL(import.meta.url));
        results.push(
            await new Promise<unknown>((resolve, reject) => {
                let result: unknown;
                worker.once("message", (message: unknown) => {
                    result = message;
                });
                worker.once("error", reject);
                worker.once("exit", (code) => {
                    if (code !== 0 || result === undefined) {
                        reject(new Error(`The library worker exited without a result, code ${String(code)}`));
                    } else {
                        resolve(result);
                    }
                });
            }),
        );
    }
    process.stdout.write(JSON.stringify(results));
} else {
    const { quit, resolveType, t, typeName } = await import("@gtkx/runtime");
    const absolute = t.bind("libc.so.6", "abs", [t.int32], t.int32);
    const before = absolute(-31);
    const registered = typeName(resolveType("libgobject-2.0.so.0", "g_bytes_get_type"));
    const variant = t.fundamental("libglib-2.0.so.0", "g_variant_ref", "g_variant_unref");
    const create = t.bind("libglib-2.0.so.0", "g_variant_new_int32", [t.int32], { ...variant, ownership: "full" });
    const read = t.bind("libglib-2.0.so.0", "g_variant_get_int32", [variant], t.int32);
    const held = create(23);
    const heldBefore = read(held);

    quit();

    parentPort?.postMessage({ before, after: absolute(-47), typeName: registered, heldBefore, heldAfter: read(held) });
}
