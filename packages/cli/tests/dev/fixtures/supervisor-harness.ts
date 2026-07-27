import { fileURLToPath } from "node:url";
import { defaultForkRunner, type ForkRunner, runDevSupervisor } from "../../../src/dev/supervisor.js";

const childFixture = fileURLToPath(new URL("graceful-child.mjs", import.meta.url));

const fork: ForkRunner = (_modulePath, args, cwd) => {
    const child = defaultForkRunner(childFixture, args, cwd);
    process.stdout.write(`CHILD_PID ${String(child.pid ?? "")}\n`);

    return child;
};

await runDevSupervisor("entry.tsx", process.cwd(), undefined, fork);
