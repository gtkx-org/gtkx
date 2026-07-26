import { type SpawnSyncReturns, spawnSync } from "node:child_process";

const ALREADY_PUBLISHED = /cannot publish over|EPUBLISHCONFLICT|previously published version/i;

const runPnpmPublish = (packageDir: string, tag: string): SpawnSyncReturns<string> => {
    const provenance = process.env.NPM_CONFIG_PROVENANCE === "true" ? ["--provenance"] : [];
    return spawnSync("pnpm", ["publish", "--access", "public", "--no-git-checks", ...provenance, "--tag", tag], {
        cwd: packageDir,
        stdio: ["inherit", "pipe", "pipe"],
        encoding: "utf8",
    });
};

const assertPublishOutcome = (packageDir: string, result: SpawnSyncReturns<string>, output: string): void => {
    if (result.status === 0) return;
    if (ALREADY_PUBLISHED.test(output)) {
        console.log(`${packageDir} is already published, skipping`);
        return;
    }
    throw new Error(`pnpm publish failed with exit code ${result.status ?? "unknown"}`);
};

export const publishPackage = (packageDir: string, tag: string): void => {
    const result = runPnpmPublish(packageDir, tag);
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    if (result.error) throw result.error;
    assertPublishOutcome(packageDir, result, `${stdout}${stderr}`);
};
