import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../src/builder.js";

type AppBuildOptions = { project: AppProject; outDir: string };
type AppProject = { root: string; entry: string };
type AppProjectOptions = { applicationId: string; entry: string; packageType: string; prefix: string };
type AppRun = { status: number | null; stdout: string; stderr: string };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const RUN_TIMEOUT = 60_000;
const ENTRY_NAME = "index.mjs";
const PROJECT_NAME = "gtkx-app-probe";

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

const createAppProject = (options: AppProjectOptions): AppProject => {
    const root = mkdtempSync(join(tmpdir(), options.prefix));
    const entry = join(root, "src", ENTRY_NAME);
    mkdirSync(join(root, "src"));
    symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(root, "node_modules"), "dir");
    writeFileSync(join(root, "package.json"), appManifest(options.packageType));
    writeFileSync(join(root, "gtkx.config.mjs"), appConfig(options.applicationId));
    writeFileSync(entry, options.entry);

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

const removeAppProject = (project: AppProject): void => {
    rmSync(join(project.root, "node_modules"), { force: true });
    rmSync(project.root, { recursive: true, force: true });
};

const runNode = (file: string): AppRun => {
    const result = spawnSync(process.execPath, [file], {
        cwd: dirname(file),
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

export { type AppProject, type AppRun, buildAppProject, createAppProject, removeAppProject, runNode };
