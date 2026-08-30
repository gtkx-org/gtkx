import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const mode = process.argv[2];
const task = fileURLToPath(new URL("worker-task.mjs", import.meta.url));
const worker = new Worker(task, mode === "terminate" ? { workerData: "linger" } : {});

const nextMessage = () =>
    new Promise((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
    });

const report = await nextMessage();

process.stdout.write(`REPORT ${JSON.stringify(report)}\n`);

if (mode === "terminate") {
    worker.postMessage("quit");
    process.stdout.write(`ACK ${await nextMessage()}\n`);
    process.stdout.write(`TERMINATED ${await worker.terminate()}\n`);
} else {
    const code = await new Promise((resolve, reject) => {
        worker.once("exit", resolve);
        worker.once("error", reject);
    });

    process.stdout.write(`EXITED ${code}\n`);
}
