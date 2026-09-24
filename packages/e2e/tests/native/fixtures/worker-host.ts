import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const mode = process.argv[2];
const willLinger = mode === "terminate";
const task = fileURLToPath(new URL("worker-task.ts", import.meta.url));

if (mode === "conflict") {
    await import("@gtkx/gi/glib");
}

const worker = new Worker(task, willLinger ? { workerData: "linger" } : {});
const reportEvent: unknown[] = await once(worker, "message");

process.stdout.write(`REPORT ${JSON.stringify(reportEvent[0])}\n`);

if (mode === "terminate") {
    worker.postMessage("quit");
    const acknowledgementEvent: unknown[] = await once(worker, "message");
    process.stdout.write(`ACK ${String(acknowledgementEvent[0])}\n`);
    process.stdout.write(`TERMINATED ${String(await worker.terminate())}\n`);
} else {
    const exitEvent: unknown[] = await once(worker, "exit");

    process.stdout.write(`EXITED ${String(exitEvent[0])}\n`);
}
