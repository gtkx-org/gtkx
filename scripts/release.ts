import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { releasePackages, verifyRelease, visibilityTimeoutMs } from "./release-registry.ts";

const { values } = parseArgs({
    options: {
        "from-artifacts": { type: "boolean", default: false },
        "verify-only": { type: "boolean", default: false },
    },
});
const packages = releasePackages();

if (values["verify-only"]) {
    const registry = new URL(process.env.NPM_CONFIG_REGISTRY ?? "https://registry.npmjs.org/");
    await verifyRelease(packages.map((entry) => ({ ...entry, registry: entry.registry ?? registry })));
} else {
    const timeoutMs = visibilityTimeoutMs();
    const { checkReleaseChannel } = await import("./release-package.ts");
    const resolved = await checkReleaseChannel(packages);

    await new Promise<void>((resolve, reject) => {
        const child = spawn(
            "pnpm",
            [
                "exec",
                "nx",
                "run-many",
                "-t",
                "release",
                "--outputStyle=stream",
                ...(values["from-artifacts"] ? ["--configuration=release-artifacts"] : []),
            ],
            { stdio: "inherit" },
        );
        child.once("error", reject);
        child.once("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Release tasks failed, exit ${String(code)}`));
            }
        });
    });

    await verifyRelease(resolved, timeoutMs);
}
