import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { activateProcessWatch, armParentDeath, closeProcessWatch, openProcessWatch } from "@gtkx/native/internal";
import { readProcessIdentity, watchProcessGroupOwner } from "@gtkx/utils";

if (!isMainThread) {
    const watch = openProcessWatch(process.pid);
    if (watch === null || watch === undefined || !activateProcessWatch(watch)) {
        throw new Error("Worker watch unavailable");
    }
    parentPort?.postMessage("armed");
    setInterval(() => undefined, 1000);
} else if (process.argv[2] === "worker") {
    const before = readdirSync("/proc/self/fd").length;
    for (let index = 0; index < 8; index++) {
        const worker = new Worker(new URL(import.meta.url));
        await new Promise<void>((resolve, reject) => {
            worker.once("message", () => resolve());
            worker.once("error", reject);
        });
        await worker.terminate();
    }
    process.stdout.write(JSON.stringify({ before, after: readdirSync("/proc/self/fd").length }));
} else if (process.argv[2] === "zombie") {
    const holder = spawn("python3", ["-c", "import os,time; child=os.fork(); (os._exit(0) if child == 0 else print(child,flush=True)); time.sleep(20)"], { stdio: ["ignore", "pipe", "inherit"] });
    try {
        const pid = await new Promise<number>((resolve, reject) => {
            holder.stdout.once("data", (chunk: Buffer) => resolve(Number(chunk.toString().trim())));
            holder.once("error", reject);
        });
        const deadline = Date.now() + 5000;
        while (readProcessIdentity(pid) !== undefined) {
            if (Date.now() > deadline) {
                throw new Error("Zombie fixture stayed alive");
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const watch = openProcessWatch(pid);
        if (watch === null || watch === undefined) {
            throw new Error("Zombie pidfd unavailable");
        }
        const activated = activateProcessWatch(watch);
        closeProcessWatch(watch);
        process.stdout.write(JSON.stringify({ activated }));
    } finally {
        holder.kill("SIGKILL");
    }
} else {
    const before = readdirSync("/proc/self/fd").length;
    for (let index = 0; index < 64; index++) {
        const watch = openProcessWatch(process.pid);
        if (watch === null || watch === undefined || !activateProcessWatch(watch)) {
            throw new Error("Process watch unavailable");
        }
        closeProcessWatch(watch);
        closeProcessWatch(watch);
    }
    const owner = readProcessIdentity(process.ppid);
    if (owner === undefined) {
        throw new Error("Parent unavailable");
    }
    let opened = false;
    const unrelated = watchProcessGroupOwner({ pid: process.pid, startTime: readProcessIdentity(process.pid)?.startTime ?? "" }, {
        open: () => { opened = true; return undefined; },
        activate: () => false,
        close: () => undefined,
    });
    const wrongParent = armParentDeath(0);
    process.stdout.write(JSON.stringify({ before, after: readdirSync("/proc/self/fd").length, opened, unrelated: unrelated !== undefined, wrongParent }));
}
