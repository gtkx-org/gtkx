import { isMainThread, parentPort, Worker } from "node:worker_threads";

if (isMainThread) {
    const target = process.argv[2];

    if (target === undefined) {
        throw new Error("The bootstrap fixture needs an import target");
    }

    await import(target === "leaf" ? new URL("../../src/type.ts", import.meta.url).href : target);

    const worker = new Worker(new URL(import.meta.url));

    try {
        const result = await new Promise<unknown>((resolve, reject) => {
            worker.once("message", resolve);
            worker.once("error", reject);
            worker.once("exit", (code) => {
                reject(new Error(`The bootstrap worker exited before responding with code ${String(code)}`));
            });
        });

        process.stdout.write(JSON.stringify(result));
    } finally {
        await worker.terminate();
    }
} else {
    try {
        const { TYPE_INT, typeName } = await import("@gtkx/runtime");
        parentPort?.postMessage({ typeName: typeName(TYPE_INT) });
    } catch (error) {
        parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
}
