import { resolveExecutable } from "@gtkx/utils";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

const ALREADY_PUBLISHED = /cannot publish over|EPUBLISHCONFLICT|previously published version/i;

const runPnpmPublish = (packageDir: string, tag: string): SpawnSyncReturns<string> => {
    const provenance = process.env.NPM_CONFIG_PROVENANCE === "true" ? ["--provenance"] : [];
    const args = ["publish", "--access", "public", "--no-git-checks", ...provenance, "--tag", tag];

    return spawnSync(resolveExecutable("pnpm"), args, {
        cwd: packageDir,
        stdio: ["inherit", "pipe", "pipe"],
        encoding: "utf8",
    });
};

const assertPublishOutcome = (packageDir: string, result: SpawnSyncReturns<string>, output: string): void => {
    if (result.status === 0) {
        return;
    }

    if (ALREADY_PUBLISHED.test(output)) {
        console.log(`${packageDir} is already published, skipping`);

        return;
    }

    throw new Error(`pnpm publish failed with exit code ${String(result.status ?? "unknown")}`);
};

const publishPackage = (packageDir: string, tag: string): void => {
    const result = runPnpmPublish(packageDir, tag);
    const { stdout, stderr } = result;
    process.stdout.write(stdout);
    process.stderr.write(stderr);

    if (result.error) {
        throw result.error;
    }

    assertPublishOutcome(packageDir, result, `${stdout}${stderr}`);
};

export { publishPackage };
