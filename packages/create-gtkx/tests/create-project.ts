import { tryResolveExecutable } from "@gtkx/utils";
import { spawnSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type CreateRun = { status: number | null; output: string; target: string; installs: string[] };

type CreateOptions = {
    args: string[];
    files?: Record<string, string> | undefined;
    links?: Record<string, string> | undefined;
    hasParentGit?: boolean | undefined;
    isInstallFailing?: boolean | undefined;
    name?: string | undefined;
};

type Workspace = { root: string; binDir: string; logPath: string };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CLI_ENTRY = join(WORKSPACE_ROOT, "packages", "create-gtkx", "dist", "cli.js");
const CLI_ARGV = ["--enable-source-maps", CLI_ENTRY];
const PACKAGE_MANAGERS = ["corepack", "pnpm", "npm", "yarn"];
const PROJECT_NAME = "my-app";
const APPLICATION_ID = "com.example.myapp";
const COVERAGE_SLOWDOWN = 3;
const CREATE_TIMEOUT_MS = 120_000 * (process.env.GTKX_COVERAGE_DIR === undefined ? 1 : COVERAGE_SLOWDOWN);
const LOG_NAME = "package-manager.log";

const shimSource = (exitCode: number): string =>
    ["#!/bin/sh", "echo \"$0 $@\" >> \"$GTKX_PACKAGE_MANAGER_LOG\"", `exit ${String(exitCode)}`, ""].join("\n");

const createWorkspace = (isInstallFailing: boolean): Workspace => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-create-"));
    const binDir = join(root, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    symlinkSync(join(WORKSPACE_ROOT, "node_modules", "tsx"), join(root, "node_modules", "tsx"), "dir");

    for (const name of PACKAGE_MANAGERS) {
        const shim = join(binDir, name);
        writeFileSync(shim, shimSource(isInstallFailing ? 1 : 0));
        chmodSync(shim, 0o755);
    }

    return { root, binDir, logPath: join(root, LOG_NAME) };
};

const createEnvironment = (workspace: Workspace): NodeJS.ProcessEnv => ({
    ...process.env,
    PATH: `${workspace.binDir}:${process.env.PATH ?? ""}`,
    GTKX_PACKAGE_MANAGER_LOG: workspace.logPath,
    ...(process.env.GTKX_COVERAGE_DIR !== undefined && { NODE_V8_COVERAGE: process.env.GTKX_COVERAGE_DIR }),
});

const readInstalls = (logPath: string): string[] =>
    existsSync(logPath) ? readFileSync(logPath, "utf8").split("\n").filter(Boolean) : [];

const initializeParentGit = (root: string, hasParentGit: boolean): void => {
    if (!hasParentGit) {
        return;
    }

    const git = tryResolveExecutable("git");

    if (git === undefined) {
        throw new Error("Git is required for this test");
    }

    const initialized = spawnSync(git, ["init", "--quiet", root], { encoding: "utf8" });

    if (initialized.status !== 0) {
        throw new Error(initialized.stderr);
    }
};

const seedFiles = (target: string, files: [string, string][]): void => {
    for (const [name, contents] of files) {
        const path = join(target, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, contents);
    }
};

const seedLinks = (target: string, links: [string, string][]): void => {
    for (const [name, targetPath] of links) {
        const path = join(target, name);
        mkdirSync(dirname(path), { recursive: true });
        symlinkSync(targetPath, path, "dir");
    }
};

const runCreate = (options: CreateOptions): CreateRun => {
    const workspace = createWorkspace(options.isInstallFailing ?? false);
    const target = join(workspace.root, options.name ?? PROJECT_NAME);
    const seeded = Object.entries(options.files ?? {});
    const links = Object.entries(options.links ?? {});
    initializeParentGit(workspace.root, options.hasParentGit === true);
    seedFiles(target, seeded);
    seedLinks(target, links);

    const result = spawnSync(process.execPath, [...CLI_ARGV, target, ...options.args], {
        cwd: workspace.root,
        encoding: "utf8",
        env: createEnvironment(workspace),
        timeout: CREATE_TIMEOUT_MS,
    });

    return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`,
        target,
        installs: readInstalls(workspace.logPath),
    };
};

const removeRun = (run: CreateRun): void => {
    rmSync(join(run.target, ".."), { recursive: true, force: true });
};

const listProject = (run: CreateRun): string[] =>
    readdirSync(run.target, { recursive: true, encoding: "utf8" }).map((entry) => entry.replaceAll("\\", "/"));

const readProject = (run: CreateRun, name: string): string => readFileSync(join(run.target, name), "utf8");
const hasProjectPath = (run: CreateRun, name: string): boolean => existsSync(join(run.target, name));

const readManifest = (run: CreateRun): Record<string, unknown> =>
    JSON.parse(readProject(run, "package.json")) as Record<string, unknown>;

export {
    APPLICATION_ID,
    type CreateRun,
    hasProjectPath,
    listProject,
    PROJECT_NAME,
    readManifest,
    readProject,
    removeRun,
    runCreate,
};
