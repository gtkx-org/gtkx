import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const KEEP_ALIVE_MS = 60_000;
const KEEP_ALIVE_SCRIPT = `setInterval(() => process.uptime(), ${String(KEEP_ALIVE_MS)})`;

const escapee = spawn(process.execPath, ["-e", KEEP_ALIVE_SCRIPT], {
    detached: true,
    stdio: "ignore",
});

const stayAlive = () => process.uptime();

escapee.unref();
writeFileSync(process.argv[2] ?? "", String(escapee.pid ?? 0));
setInterval(stayAlive, KEEP_ALIVE_MS);
