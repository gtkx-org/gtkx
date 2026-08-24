import { execFileSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type ReleaseProject = {
    logPath: string;
    manifest: string;
    packageDir: string;
    root: string;
};

type PublishedFiles = {
    license: string;
    manifest: { exports: Record<string, unknown> };
    readme: string;
};

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const RELEASE_SCRIPT = join(WORKSPACE_ROOT, "scripts", "release-package.ts");
const projects: string[] = [];

const createPublisher = (root: string): string => {
    const binDir = join(root, "bin");
    const executable = join(binDir, "pnpm");
    mkdirSync(binDir);

    writeFileSync(
        executable,
        [
            "#!/usr/bin/env node",
            'import { readFileSync, writeFileSync } from "node:fs";',
            'import { join } from "node:path";',
            "const result = {",
            '    readme: readFileSync(join(process.cwd(), "README.md"), "utf8"),',
            '    license: readFileSync(join(process.cwd(), "LICENSE"), "utf8"),',
            '    manifest: JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")),',
            "};",
            "writeFileSync(process.env.PUBLISH_LOG, JSON.stringify(result));",
        ].join("\n"),
    );

    chmodSync(executable, 0o755);

    return binDir;
};

const createReleaseProject = (hasPackageFiles: boolean): ReleaseProject => {
    const root = mkdtempSync(join(WORKSPACE_ROOT, ".release-package-"));
    const packageDir = join(root, "packages", "probe");

    const manifest = `${JSON.stringify(
        {
            name: "@gtkx/release-probe",
            version: "1.4.0",
            type: "module",
            files: ["index.js"],
            exports: { ".": { source: "./src/index.ts", default: "./index.js" } },
        },
        null,
        4,
    )}\n`;

    projects.push(root);
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    writeFileSync(join(root, "README.md"), "root readme\n");
    writeFileSync(join(root, "LICENSE"), "root license\n");
    writeFileSync(join(packageDir, "package.json"), manifest);

    if (hasPackageFiles) {
        writeFileSync(join(packageDir, "README.md"), "package readme\n");
        writeFileSync(join(packageDir, "LICENSE"), "package license\n");
    }

    createPublisher(root);

    return { logPath: join(root, "published.json"), manifest, packageDir, root };
};

const release = (project: ReleaseProject): void => {
    const path = [join(project.root, "bin"), process.env.PATH ?? ""]
        .filter((entry) => entry.length > 0)
        .join(delimiter);

    execFileSync(process.execPath, ["--import", "tsx", RELEASE_SCRIPT], {
        cwd: project.packageDir,
        env: { ...process.env, PATH: path, PUBLISH_LOG: project.logPath },
        stdio: "pipe",
    });
};

const publishedFiles = (project: ReleaseProject): PublishedFiles =>
    JSON.parse(readFileSync(project.logPath, "utf8")) as PublishedFiles;

afterEach(() => {
    const currentProjects = [...projects];
    projects.length = 0;

    for (const root of currentProjects) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe("package release staging", () => {
    it("publishes root documentation and a production manifest, then restores package files", () => {
        const project = createReleaseProject(true);
        release(project);
        const published = publishedFiles(project);
        expect(published.readme).toBe("root readme\n");
        expect(published.license).toBe("root license\n");
        expect(published.manifest.exports["."]).toEqual({ default: "./index.js" });
        expect(readFileSync(join(project.packageDir, "package.json"), "utf8")).toBe(project.manifest);
        expect(readFileSync(join(project.packageDir, "README.md"), "utf8")).toBe("package readme\n");
        expect(readFileSync(join(project.packageDir, "LICENSE"), "utf8")).toBe("package license\n");
    });

    it("removes documentation staged into a package that did not have local copies", () => {
        const project = createReleaseProject(false);
        release(project);
        expect(existsSync(join(project.packageDir, "README.md"))).toBe(false);
        expect(existsSync(join(project.packageDir, "LICENSE"))).toBe(false);
        expect(readFileSync(join(project.packageDir, "package.json"), "utf8")).toBe(project.manifest);
    });

    it("throws instead of staging through package documentation symlinks", () => {
        for (const name of ["README.md", "LICENSE"]) {
            const project = createReleaseProject(false);
            symlinkSync(join(project.root, name), join(project.packageDir, name));

            expect(() => {
                release(project);
            }).toThrow();
        }
    });
});
