import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import type { CliProject } from "./cli-project.js";

const compileNativeFixture = (project: CliProject, source: string, library: string, pkg: string): void => {
    const flags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", pkg], {
        encoding: "utf8",
    }).trim().split(/\s+/);
    execFileSync(resolveExecutable("cc"), [
        "-shared", "-fPIC", "-Wall", "-Wextra", "-Werror", source,
        "-o", join(project.root, library), ...flags,
    ]);
};

const runNativeConsumer = (
    project: CliProject,
    file = "probe.ts",
    nodeOptions: readonly string[] = [],
): void => {
    const libraryPath = [project.root, process.env.LD_LIBRARY_PATH]
        .filter((entry) => entry !== undefined && entry !== "")
        .join(":");
    execFileSync(process.execPath, [...nodeOptions, "--conditions=source", "--import=tsx", file], {
        cwd: project.root,
        env: { ...process.env, LD_LIBRARY_PATH: libraryPath },
        stdio: "pipe",
        timeout: 30_000,
    });
};

export { compileNativeFixture, runNativeConsumer };
