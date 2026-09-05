import { Worker } from "node:worker_threads";
import { expect, it } from "vitest";

type WorkerReport = {
    runtimeDir: string | undefined;
    busAddress: string | undefined;
    execArgv: string[];
};

type WorkerResult = {
    report: WorkerReport;
    exitCode: number;
};

const WORKER_SOURCE = `
const { parentPort } = require("node:worker_threads");
parentPort.postMessage({
    runtimeDir: process.env.XDG_RUNTIME_DIR,
    busAddress: process.env.DBUS_SESSION_BUS_ADDRESS,
    execArgv: process.execArgv,
});
`;

const runInheritedWorker = (worker: Worker): Promise<WorkerResult> =>
    new Promise((resolve, reject) => {
        let report: WorkerReport | undefined;

        const cleanup = (): void => {
            clearTimeout(timeout);
            worker.off("message", onMessage);
            worker.off("error", onError);
            worker.off("exit", onExit);
        };

        const onMessage = (value: WorkerReport): void => {
            report = value;
        };

        const onError = (error: Error): void => {
            cleanup();
            reject(error);
        };

        const onExit = (exitCode: number): void => {
            cleanup();

            if (report === undefined) {
                reject(new Error("The worker exited before reporting its environment"));

                return;
            }

            resolve({ report, exitCode });
        };

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("The worker did not exit after posting its result"));
        }, 3000);

        worker.on("message", onMessage);
        worker.once("error", onError);
        worker.once("exit", onExit);
    });

it("keeps an inherited worker on its test worker's headless display", async () => {
    const worker = new Worker(WORKER_SOURCE, { eval: true });

    try {
        const { report, exitCode } = await runInheritedWorker(worker);
        expect(process.execArgv.some((argument) => argument.includes("worker-preload"))).toBe(true);
        expect(report.execArgv).toEqual(process.execArgv);
        expect(report.runtimeDir).toBe(process.env.XDG_RUNTIME_DIR);
        expect(report.busAddress).toBe(process.env.DBUS_SESSION_BUS_ADDRESS);
        expect(exitCode).toBe(0);
    } finally {
        if (worker.threadId !== -1) {
            await worker.terminate();
        }
    }
});
