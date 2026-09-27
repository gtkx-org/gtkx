import { resolveExecutable } from "@gtkx/utils";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkReleaseChannel, promoteRelease } from "./release-channel.js";
import { releasePackageDirectories } from "./release-package-set.js";

const run = async (command: string, args: string[]): Promise<void> => new Promise((resolve, reject) => {
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
    "--dir", fileURLToPath(new URL("../packages/native", import.meta.url)), "exec", "napi", "create-npm-dirs",
]);
await checkReleaseChannel(releasePackageDirectories());
await run("nx", ["run-many", "-t", "release", "--skip-nx-cache", "--outputStyle=stream"]);
await promoteRelease(releasePackageDirectories());
