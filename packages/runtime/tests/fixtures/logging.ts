import { isMainThread, parentPort, Worker } from "node:worker_threads";

const mode = process.argv[2];

if (mode === "workers" && isMainThread) {
    const records: unknown[] = [];
    for (let index = 0; index < 2; index += 1) {
        const worker = new Worker(new URL(import.meta.url));
        try {
            records.push(
                await new Promise<unknown>((resolve, reject) => {
                    worker.once("message", resolve);
                    worker.once("error", reject);
                    worker.once("exit", (code) => reject(new Error(`Logging worker exited with ${String(code)}`)));
                }),
            );
        } finally {
            await worker.terminate();
        }
    }
    process.stdout.write(JSON.stringify(records));
} else {
    const { onLog, t } = await import("@gtkx/runtime");
    const log = t.bind(
        "libglib-2.0.so.0",
        "g_log_structured_standard",
        [t.string(), t.uint32, t.string(), t.string(), t.string(), t.string()],
        t.void,
    );
    const emit = (message: string, level = 64): void => {
        log("gtkx-logging-fixture", level, "logging.ts", "1", "fixture", message);
    };

    if (!isMainThread) {
        onLog((_level, _domain, message) => {
            parentPort?.postMessage(message);
        });
        emit("worker record");
        setInterval(() => {}, 60_000);
    } else if (mode === "throw") {
        const thrown: unknown[] = [];
        const records: string[] = [];
        process.on("uncaughtException", (error: Error) => {
            thrown.push(error.message);
        });
        const first = onLog((_level, _domain, message) => {
            throw new Error(message);
        });
        const second = onLog((_level, _domain, message) => {
            records.push(message);
        });
        emit("first record");
        emit("second record");
        first.unsubscribe();
        second.unsubscribe();
        setTimeout(() => process.stdout.write(JSON.stringify({ thrown, records })), 100);
    } else if (mode === "fatal") {
        onLog(() => process.stdout.write("FATAL LISTENER RAN\n"));
        const alwaysFatal = t.bind("libglib-2.0.so.0", "g_log_set_always_fatal", [t.uint32], t.uint32);
        alwaysFatal(16);
        emit("fatal diagnostic", 16);
    } else if (mode === "unhandled") {
        onLog(() => {
            throw new Error("uncaught log listener");
        });
        emit("unhandled record");
        setTimeout(() => {}, 1_000);
    } else {
        throw new Error(`Unknown logging fixture mode ${String(mode)}`);
    }
}
