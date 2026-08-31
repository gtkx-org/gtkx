import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const mode = process.argv[2];
const willLinger = mode === "terminate" || mode === "kill";
const task = fileURLToPath(new URL("worker-task.ts", import.meta.url));
const worker = new Worker(task, willLinger ? { workerData: "linger" } : {});

const nextMessage = () =>
    new Promise((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
    });

const report = await nextMessage();

process.stdout.write(`REPORT ${JSON.stringify(report)}\n`);

if (mode === "terminate") {
    worker.postMessage("quit");
    process.stdout.write(`ACK ${String(await nextMessage())}\n`);
    process.stdout.write(`TERMINATED ${String(await worker.terminate())}\n`);
} else if (mode === "kill") {
    process.stdout.write(`TERMINATED ${String(await worker.terminate())}\n`);
} else {
    const code = await new Promise<number>((resolve, reject) => {
        worker.once("exit", resolve);
        worker.once("error", reject);
    });

    process.stdout.write(`EXITED ${String(code)}\n`);
}
