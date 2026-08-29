import { resolveExecutable } from "@gtkx/utils";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import workspaceConfig from "../../../gtkx.config.base.js";

type CliProject = { root: string; nodeModules: string };
type CliRun = { status: number | null; output: string; stdout: string; stderr: string };

type CliProjectOptions = {
    prefix: string;
    config?: string | undefined;
    files?: Record<string, string> | undefined;
    hasStore?: boolean | undefined;
    omitPackages?: string[] | undefined;
};

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKSPACE_MODULES = join(WORKSPACE_ROOT, "node_modules");
const CLI_ENTRY = join(WORKSPACE_ROOT, "packages", "cli", "dist", "cli.js");
const CLI_ARGV = ["--enable-source-maps", CLI_ENTRY];
const COVERAGE_SLOWDOWN = 3;
const CLI_TIMEOUT = 300_000 * (process.env.GTKX_COVERAGE_DIR === undefined ? 1 : COVERAGE_SLOWDOWN);
const STORE_DIR = ".gtkx";
const SCOPE = "@gtkx";
const STORE_NAMES = ["gi", "jsx"];

const WORKSPACE_PACKAGES = [
    "cairo",
    "components",
    "config",
    "css",
    "i18n",
    "native",
    "react",
    "runtime",
    "testing",
    "utils",
];

const REGISTRY_PACKAGES = ["@types", "csstype", "react", "tsx"];
const STORE_LIBRARIES = workspaceConfig.libraries;
const MANIFEST = { name: "gtkx-cli-project", version: "1.0.0", type: "module" };
const GIT_IDENTITY = ["-c", "user.email=probe@gtkx.dev", "-c", "user.name=Probe", "-c", "commit.gpgsign=false"];

const writeProjectFiles = (root: string, files: Record<string, string>): void => {
    for (const [name, contents] of Object.entries(files)) {
        const target = join(root, name);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, contents);
    }
};

const linkInto = (nodeModules: string, name: string, target: string): void => {
    const link = join(nodeModules, name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link, "dir");
};

const installPeers = (nodeModules: string, omitPackages: string[]): void => {
    for (const name of WORKSPACE_PACKAGES) {
        if (omitPackages.includes(name)) {
            continue;
        }

        linkInto(nodeModules, join(SCOPE, name), join(WORKSPACE_ROOT, "packages", name));
    }

    for (const name of REGISTRY_PACKAGES) {
        linkInto(nodeModules, name, join(WORKSPACE_MODULES, name));
    }
};

const manifestDependencies = (omitPackages: string[]): Record<string, string> =>
    Object.fromEntries(
        WORKSPACE_PACKAGES.filter((name) => !omitPackages.includes(name)).map((name) => [`${SCOPE}/${name}`, "*"]),
    );

const projectManifest = (options: CliProjectOptions): Record<string, unknown> => ({
    ...MANIFEST,
    dependencies: manifestDependencies(options.omitPackages ?? []),
});

const installStore = (nodeModules: string): void => {
    cpSync(join(WORKSPACE_MODULES, STORE_DIR), join(nodeModules, STORE_DIR), {
        recursive: true,
        verbatimSymlinks: true,
    });

    for (const name of STORE_NAMES) {
        symlinkSync(join("..", STORE_DIR, name), join(nodeModules, SCOPE, name), "dir");
    }
};

const createCliProject = (options: CliProjectOptions): CliProject => {
    const root = mkdtempSync(join(tmpdir(), options.prefix));
    const nodeModules = join(root, "node_modules");
    mkdirSync(join(nodeModules, SCOPE), { recursive: true });
    installPeers(nodeModules, options.omitPackages ?? []);

    if (options.hasStore === true) {
        installStore(nodeModules);
    }

    writeFileSync(join(root, "package.json"), `${JSON.stringify(projectManifest(options), null, 4)}\n`);
    writeProjectFiles(root, options.files ?? {});

    if (options.config !== undefined) {
        writeFileSync(join(root, "gtkx.config.ts"), options.config);
    }

    return { root, nodeModules };
};

const listProjectFiles = (project: CliProject, directory: string): string[] =>
    readdirSync(join(project.root, directory), { recursive: true, encoding: "utf8" });

const removeCliProject = (project: CliProject): void => {
    rmSync(project.root, { recursive: true, force: true });
};

const runProjectGit = (project: CliProject, args: string[]): void => {
    const result = spawnSync(resolveExecutable("git"), args, { cwd: project.root, encoding: "utf8" });

    if (result.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed in ${project.root}: ${result.stderr}`);
    }
};

const initGitRepo = (project: CliProject, tag: string): void => {
    runProjectGit(project, ["init", "--quiet"]);
    runProjectGit(project, [...GIT_IDENTITY, "commit", "--allow-empty", "--quiet", "--message", "probe"]);
    runProjectGit(project, ["tag", tag]);
};

const cliEnvironment = (): NodeJS.ProcessEnv => {
    const environment = { ...process.env };
    delete environment.NODE_ENV;
    delete environment.NODE_PATH;
    delete environment.GTKX_DEPRECATIONS_SHOWN;
    const coverageDir = process.env.GTKX_COVERAGE_DIR;

    if (coverageDir !== undefined) {
        environment.NODE_V8_COVERAGE = coverageDir;
    }

    return environment;
};

const runCli = (project: CliProject, args: string[], overrides: NodeJS.ProcessEnv = {}): CliRun => {
    const result = spawnSync(process.execPath, [...CLI_ARGV, ...args, "--cwd", project.root], {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
        env: { ...cliEnvironment(), ...overrides },
        timeout: CLI_TIMEOUT,
    });

    if (result.status === null) {
        throw new Error(
            `gtkx ${args.join(" ")} did not exit on its own: killed by ${result.signal ?? "an unknown signal"} ` +
            `after ${String(CLI_TIMEOUT)}ms. ${result.stdout}${result.stderr}`,
        );
    }

    return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`,
        stdout: result.stdout,
        stderr: result.stderr,
    };
};

const runCliOrThrow = (project: CliProject, args: string[], overrides: NodeJS.ProcessEnv = {}): CliRun => {
    const result = runCli(project, args, overrides);

    if (result.status !== 0) {
        throw new Error(result.output);
    }

    return result;
};

const startCli = (project: CliProject, args: string[], overrides: NodeJS.ProcessEnv = {}): ChildProcess =>
    spawn(process.execPath, [...CLI_ARGV, ...args, "--cwd", project.root], {
        cwd: WORKSPACE_ROOT,
        env: { ...cliEnvironment(), ...overrides },
        stdio: ["ignore", "pipe", "pipe"],
    });

export {
    type CliProject,
    createCliProject,
    initGitRepo,
    listProjectFiles,
    removeCliProject,
    runCli,
    runCliOrThrow,
    startCli,
    STORE_LIBRARIES,
};
