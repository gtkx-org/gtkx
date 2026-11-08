import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { releasePackages, VISIBILITY_TIMEOUT_MS, verifyRelease } from "./verify-release.ts";

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
    const { checkReleaseChannel } = await import("./publish-package.ts");
    const resolved = await checkReleaseChannel(packages);

    execFileSync(
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

    await verifyRelease(resolved, VISIBILITY_TIMEOUT_MS);
}
