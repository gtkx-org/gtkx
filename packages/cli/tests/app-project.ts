import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../src/builder.js";

type AppBuildOptions = { project: AppProject; outDir: string };
type AppProbe = { emitted: string[]; project: AppProject; reported: string; run: AppRun };
type AppProbeOptions = AppProjectOptions & { outDir: string };
type AppProject = { root: string; entry: string };

type AppProjectOptions = {
    applicationId: string;
    entry: string;
    files?: Record<string, string> | undefined;
    packageType: string;
    prefix: string;
};

type AppRun = { status: number | null; stdout: string; stderr: string };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const RUN_TIMEOUT = 60_000;
const ENTRY_NAME = "index.mjs";
const PROJECT_NAME = "gtkx-app-probe";
const INSTALL_PREFIX = "gtkx-bundle-install-";

const appConfig = (applicationId: string): string =>
    [
        "export default {",
        `    applicationId: ${JSON.stringify(applicationId)},`,
        "    codegen: false,",
        "    libraries: [\"Gtk-4.0\"],",
        "};",
        "",
    ].join("\n");

const appManifest = (packageType: string): string =>
    `${JSON.stringify({ name: PROJECT_NAME, type: packageType }, null, 4)}\n`;

const writeFiles = (root: string, files: Record<string, string>): void => {
    for (const [name, source] of Object.entries(files)) {
        const target = join(root, name);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source);
    }
};

const createAppProject = (options: AppProjectOptions): AppProject => {
    const root = mkdtempSync(join(tmpdir(), options.prefix));
    const entry = join(root, "src", ENTRY_NAME);
    mkdirSync(join(root, "src"));
    symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(root, "node_modules"), "dir");
    writeFileSync(join(root, "package.json"), appManifest(options.packageType));
    writeFileSync(join(root, "gtkx.config.mjs"), appConfig(options.applicationId));
    writeFileSync(entry, options.entry);
    writeFiles(root, options.files ?? {});

    return { root, entry };
};

const buildAppProject = (options: AppBuildOptions): Promise<string> =>
    build({
        entry: options.project.entry,
        vite: {
            root: options.project.root,
            logLevel: "warn",
            build: { outDir: options.outDir, emptyOutDir: true },
        },
    });

const installBundle = (outDir: string, files: Record<string, string> = {}): string => {
    const installDir = mkdtempSync(join(tmpdir(), INSTALL_PREFIX));
    cpSync(outDir, installDir, { recursive: true });
    writeFiles(installDir, files);

    return installDir;
};

const removeAppProject = (project: AppProject): void => {
    rmSync(join(project.root, "node_modules"), { force: true });
    rmSync(project.root, { recursive: true, force: true });
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
    const reported = await buildAppProject({ project, outDir: options.outDir });

    return {
        emitted: readdirSync(join(project.root, options.outDir), { recursive: true, encoding: "utf8" }),
        project,
        reported,
        run: runNode(join(project.root, reported)),
    };
};

export {
    type AppProbe,
    type AppProject,
    type AppRun,
    buildAppProject,
    createAppProject,
    deployedEnvironment,
    installBundle,
    probeAppProject,
    removeAppProject,
    runNode,
};
