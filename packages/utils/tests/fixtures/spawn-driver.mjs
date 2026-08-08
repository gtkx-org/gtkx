import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnWithParentDeathSignal } from "../../src/process/index.ts";

const [escapeePidPath = "", handlePidPath = "", mode = "exit"] = process.argv.slice(2);
const payload = join(import.meta.dirname, "spawn-escapee.mjs");
const child = spawnWithParentDeathSignal(process.execPath, [payload, escapeePidPath]);

const finish = () => {
    if (mode === "throw") {
        throw new Error("gtkx-driver-uncaught");
    }

    if (mode === "drain") {
        process.stdin.destroy();

        return;
    }

    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
};

child.unref();
writeFileSync(handlePidPath, String(child.pid ?? 0));
process.stdin.on("data", finish);
