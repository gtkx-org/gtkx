import { resolveExecutable } from "@gtkx/utils";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { visibilityTimeoutMs } from "./pnpm-publish.js";
import { checkReleaseChannel, verifyReleaseChannel } from "./release-channel.js";
import { releasePackageDirectories } from "./release-package-set.js";

const { values } = parseArgs({ options: { "from-artifacts": { type: "boolean", default: false } } });
const timeoutMs = visibilityTimeoutMs(process.env.GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS);

const run = async (command: string, args: string[]): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(resolveExecutable(command), args, { stdio: "inherit" });
        child.once("error", reject);
        child.once("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Release command failed: ${command}, exit ${String(code)}`));
            }
        });
    });

await run("pnpm", [
    "--dir",
    fileURLToPath(new URL("../packages/native", import.meta.url)),
    "exec",
    "napi",
    "create-npm-dirs",
]);
await checkReleaseChannel(releasePackageDirectories());
await run("nx", [
    "run-many",
    "-t",
    "release",
    "--outputStyle=stream",
    ...(values["from-artifacts"] ? ["--configuration=release-artifacts"] : []),
]);
await verifyReleaseChannel(releasePackageDirectories(), timeoutMs);
