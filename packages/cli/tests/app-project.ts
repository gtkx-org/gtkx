import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
    type CliProject,
    createCliProject,
    removeCliProject as removeAppProject,
    runCliOrThrow,
} from "./cli-project.js";

type AppBuildOptions = {
    project: AppProject;
    outDir: string;
    environment?: NodeJS.ProcessEnv | undefined;
};
type AppProbe = { emitted: string[]; project: AppProject; reported: string; run: AppRun };
type AppProbeOptions = AppProjectOptions & { outDir: string };
type AppProject = CliProject & { entry: string };

type AppProjectOptions = {
    applicationId: string;
    entry: string;
    files?: Record<string, string | Buffer> | undefined;
    prefix: string;
};

type AppRun = { status: number | null; stdout: string; stderr: string };

const RUN_TIMEOUT = 60_000;
const ENTRY_NAME = "index.mjs";
const INSTALL_PREFIX = "gtkx-bundle-install-";

const appConfig = (applicationId: string): string =>
    [
        "export default {",
        `    applicationId: ${JSON.stringify(applicationId)},`,
        "    codegen: false,",
        "};",
        "",
    ].join("\n");

const writeFiles = (root: string, files: Record<string, string | Buffer>): void => {
    for (const [name, source] of Object.entries(files)) {
        const target = join(root, name);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source);
    }
};

const createAppProject = (options: AppProjectOptions): AppProject => {
    const project = createCliProject({
        prefix: options.prefix,
        hasStore: true,
        files: {
            "gtkx.config.mjs": appConfig(options.applicationId),
            [join("src", ENTRY_NAME)]: options.entry,
            ...options.files,
        },
    });

    return { ...project, entry: join(project.root, "src", ENTRY_NAME) };
};

const buildAppProject = (options: AppBuildOptions): Promise<string> =>
    Promise.try(() => {
        runCliOrThrow(
            options.project,
            ["build", options.project.entry, "--out", options.outDir],
            options.environment,
        );

        return join(options.outDir, "bundle.mjs");
    });

const installBundle = (outDir: string, files: Record<string, string> = {}): string => {
    const installDir = mkdtempSync(join(tmpdir(), INSTALL_PREFIX));
    cpSync(outDir, installDir, { recursive: true });
    writeFiles(installDir, files);

    return installDir;
};

const deployedEnvironment = (): NodeJS.ProcessEnv => {
    const environment = { ...process.env };
    delete environment.NODE_PATH;

    return environment;
};

const runNode = (file: string): AppRun => {
    const result = spawnSync(process.execPath, [file], {
        cwd: dirname(file),
        encoding: "utf8",
        env: deployedEnvironment(),
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

const probeAppProject = async (options: AppProbeOptions): Promise<AppProbe> => {
    const project = createAppProject(options);

    try {
        const reported = await buildAppProject({ project, outDir: options.outDir });

        return {
            emitted: readdirSync(join(project.root, options.outDir), { recursive: true, encoding: "utf8" }),
            project,
            reported,
            run: runNode(join(project.root, reported)),
        };
    } catch (error) {
        removeAppProject(project);

        throw error;
    }
};

export { removeCliProject as removeAppProject } from "./cli-project.js";

export {
    type AppProbe,
    type AppProject,
    type AppRun,
    buildAppProject,
    createAppProject,
    deployedEnvironment,
    installBundle,
    probeAppProject,
    runNode,
};
