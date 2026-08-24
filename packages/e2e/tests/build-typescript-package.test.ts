import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const BUILD_SCRIPT = join(WORKSPACE_ROOT, "scripts", "build-typescript-package.ts");
const projects: string[] = [];
const VALID_SOURCE = "export const value: number = 42;\n";

const createProject = (source = VALID_SOURCE, parent = WORKSPACE_ROOT): string => {
    const root = mkdtempSync(join(parent, ".build-typescript-package-"));
    const sourceDir = join(root, "src");
    projects.push(root);
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, "index.ts"), source);

    writeFileSync(join(root, "tsconfig.lib.json"), `${JSON.stringify({
        compilerOptions: {
            composite: true,
            declaration: true,
            declarationMap: true,
            module: "NodeNext",
            moduleResolution: "NodeNext",
            rootDir: "src",
            sourceMap: true,
            target: "ES2022",
        },
        include: ["src/**/*.ts"],
    }, null, 4)}\n`);

    return root;
};

const buildProject = (root: string, ...assets: string[]): void => {
    execFileSync(process.execPath, ["--import", "tsx", BUILD_SCRIPT, root, ...assets], {
        cwd: WORKSPACE_ROOT,
        stdio: "pipe",
    });
};

afterEach(() => {
    const currentProjects = [...projects];
    projects.length = 0;

    for (const root of currentProjects) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe("atomic TypeScript package builds", () => {
    it("installs a complete compiled package", () => {
        const root = createProject();
        buildProject(root);
        expect(readFileSync(join(root, "dist", "index.js"), "utf8")).toContain("export const value = 42");
        expect(existsSync(join(root, "dist", "index.d.ts"))).toBe(true);
        const buildInfo = readFileSync(join(root, "tsconfig.lib.tsbuildinfo"), "utf8");
        expect(buildInfo).toContain('"outDir":"./dist"');
        expect(buildInfo).toContain('"tsBuildInfoFile":"./tsconfig.lib.tsbuildinfo"');
    });

    it("replaces stale output and carries declared source assets", () => {
        const root = createProject();
        const assetDir = join(root, "src", "templates");
        mkdirSync(join(root, "dist"));
        mkdirSync(assetDir);
        writeFileSync(join(root, "dist", "stale.js"), "stale\n");
        writeFileSync(join(assetDir, "template.txt"), "template\n");
        buildProject(root, "src/templates");
        expect(existsSync(join(root, "dist", "stale.js"))).toBe(false);
        expect(readFileSync(join(root, "dist", "templates", "template.txt"), "utf8")).toBe("template\n");
    });

    it("throws for invalid sources and paths", () => {
        const root = createProject("export const value: string = 42;\n");

        expect(() => {
            buildProject(root);
        }).toThrow();

        const linked = createProject();
        const assetDir = join(linked, "src", "templates");
        mkdirSync(assetDir);
        writeFileSync(join(linked, "outside.txt"), "outside\n");
        symlinkSync(join(linked, "outside.txt"), join(assetDir, "linked.txt"));

        expect(() => {
            buildProject(linked, "src/templates");
        }).toThrow();

        const external = createProject(VALID_SOURCE, tmpdir());
        const linkRoot = mkdtempSync(join(WORKSPACE_ROOT, ".build-typescript-package-link-"));
        const projectLink = join(linkRoot, "project");
        symlinkSync(external, projectLink, "dir");
        projects.unshift(linkRoot);

        expect(() => {
            buildProject(projectLink);
        }).toThrow();
    });
});
