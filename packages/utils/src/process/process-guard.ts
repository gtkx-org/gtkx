import { killMarkedProcesses } from "./kill-marked-processes.ts";

const GUARD_PREFIX = process.argv[2] ?? "";
const WATCHED_SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"] as const satisfies NodeJS.Signals[];

const sweep = (): void => {
    if (GUARD_PREFIX.length > 0) {
        killMarkedProcesses(GUARD_PREFIX);
    }

    process.exit(0);
};

process.stdin.resume();
process.stdin.on("end", sweep);
process.stdin.on("error", sweep);

for (const signal of WATCHED_SIGNALS) {
    process.on(signal, sweep);
}
