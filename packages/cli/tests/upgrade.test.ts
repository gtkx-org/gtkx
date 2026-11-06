import { runCommand } from "citty";
import {
    existsSync,
    mkdirSync,
    mkdtempDisposableSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { createCommand } from "../dist/command.js";
import { createProject } from "./project.js";

type LoggedCommand = { name: string; cwd: string; args: string[]; settings: Record<string, string> };

type ProjectOptions = { yarnVersion?: string; isInstallFailing?: boolean };

const SETTINGS_FILES = [".npmrc", ".yarnrc.yml", "pnpm-workspace.yaml"];

const LOCKFILES: Record<string, string> = { npm: "package-lock.json", pnpm: "pnpm-lock.yaml", yarn: "yarn.lock" };

const REGISTRY_DOCUMENT = {
    name: "@gtkx/cli",
    "dist-tags": { latest: "1.6.0", beta: "2.0.0-beta.13" },
    versions: ["1.6.0", "2.0.0-beta.11", "2.0.0-beta.12", "2.0.0-beta.13"],
};

const invoke = async (args: string[]) => {
    let output = "";
    let errors = "";
    await stderr.inspectAsync(async (chunks) => {
        await stdout.inspectAsync(async (messages) => {
            await runCommand(createCommand(), { rawArgs: args });
            output = messages.join("");
        });
        errors = chunks.join("");
    });
    return output + errors;
};

const registryOutput = (name: string, yarnVersion: string): string => {
    if (name === "npm") return JSON.stringify([REGISTRY_DOCUMENT], null, 2);
    if (name === "pnpm") return JSON.stringify(REGISTRY_DOCUMENT, null, 2);
    if (yarnVersion.startsWith("1.")) {
        return [
            JSON.stringify({ type: "warning", data: "package.json: No license field" }),
            JSON.stringify({ type: "inspect", data: REGISTRY_DOCUMENT }),
        ].join("\n");
    }
    return JSON.stringify(REGISTRY_DOCUMENT);
};

const createTemporaryProject = (
    files: Record<string, string>,
    { yarnVersion = "4.18.1", isInstallFailing = false }: ProjectOptions = {},
) => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-cli-upgrade-"));
    const root = join(directory.path, "project");
    const bin = join(directory.path, "node_modules/.bin");
    const log = join(directory.path, "commands.log");
    const write = (path: string, content: string) => {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    };
    for (const [path, content] of Object.entries(files)) write(path, content);
    mkdirSync(bin, { recursive: true });
    for (const name of ["npm", "pnpm", "yarn"]) {
        writeFileSync(
            join(bin, name),
            `#!${process.execPath}
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "--version") {
    console.log(${JSON.stringify(name === "yarn" ? yarnVersion : "11.0.0")});
    process.exit(0);
}
const settings = Object.fromEntries(
    ${JSON.stringify(SETTINGS_FILES)}.filter((file) => existsSync(file)).map((file) => [file, readFileSync(file, "utf8")]),
);
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ name: ${JSON.stringify(name)}, cwd: process.cwd(), args, settings }) + "\\n");
if (args.includes("view") || args.includes("info")) console.log(${JSON.stringify(registryOutput(name, yarnVersion))});
if (${JSON.stringify(isInstallFailing)} && args[0] === "install") {
    writeFileSync(${JSON.stringify(LOCKFILES[name])}, "partial");
    process.exit(1);
}
`,
            { mode: 0o755 },
        );
    }
    vi.stubEnv("PATH", `${bin}:${process.env.PATH ?? ""}`);
    return {
        root,
        write,
        read: (path: string) => readFileSync(join(root, path), "utf8"),
        commands: (): LoggedCommand[] =>
            existsSync(log)
                ? readFileSync(log, "utf8")
                      .trim()
                      .split("\n")
                      .map((line) => JSON.parse(line) as LoggedCommand)
                : [],
        [Symbol.dispose]: () => directory[Symbol.dispose](),
    };
};

const installs = (commands: LoggedCommand[]) =>
    commands
        .filter(({ args }) => !args.includes("view") && !args.includes("info"))
        .map(({ name, cwd, args }) => ({ name, cwd, args }));

const manifest = (dependencies: Record<string, string>, devDependencies: Record<string, string> = {}) =>
    `${JSON.stringify({ name: "app", version: "1.0.0", dependencies, devDependencies }, null, 2)}\n`;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("gtkx upgrade", () => {
    it("moves every GTKX spec of an npm project to the requested version, keeping range styles and other locks", async () => {
        using project = createTemporaryProject({
            "package.json": manifest(
                { "@gtkx/react": "^2.0.0-beta.11", react: "^19.3.0" },
                { "@gtkx/cli": "~2.0.0-beta.11", "create-gtkx": "2.0.0-beta.11" },
            ),
            "package-lock.json": JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "": { name: "app" },
                    "node_modules/@gtkx/react": { version: "2.0.0-beta.11" },
                    "node_modules/@gtkx/cli/node_modules/@gtkx/codegen": { version: "2.0.0-beta.11" },
                    "node_modules/create-gtkx": { version: "2.0.0-beta.11" },
                    "node_modules/react": { version: "19.3.0" },
                },
            }),
        });

        await invoke(["upgrade", "2.0.0-beta.13", "--cwd", project.root]);

        expect(project.read("package.json")).toBe(
            manifest(
                { "@gtkx/react": "^2.0.0-beta.13", react: "^19.3.0" },
                { "@gtkx/cli": "~2.0.0-beta.13", "create-gtkx": "2.0.0-beta.13" },
            ),
        );
        const lockfile = JSON.parse(project.read("package-lock.json")) as { packages: Record<string, unknown> };
        expect(Object.keys(lockfile.packages)).toEqual(["", "node_modules/react"]);
        expect(installs(project.commands())).toEqual([
            { name: "npm", cwd: project.root, args: ["install"] },
            { name: "npm", cwd: project.root, args: ["dedupe"] },
        ]);
    });

    it("upgrades pnpm catalogs and workspace members to the newest release on the project's dist-tag", async () => {
        using project = createTemporaryProject({
            "pnpm-workspace.yaml": [
                "packages:",
                "  - apps/*",
                "# GTKX packages move together",
                "catalog:",
                '  "@gtkx/react": ^2.0.0-beta.11',
                "  react: ^19.3.0",
                "catalogs:",
                "  gtkx:",
                '    "@gtkx/cli": ~2.0.0-beta.11',
                "",
            ].join("\n"),
            "apps/one/package.json": manifest({ "@gtkx/react": "catalog:" }, { "@gtkx/cli": "catalog:gtkx" }),
            "apps/two/package.json": manifest({ "@gtkx/css": "^2.0.0-beta.11" }),
        });

        await invoke(["upgrade", "--cwd", join(project.root, "apps/two")]);

        const workspace = project.read("pnpm-workspace.yaml");
        expect(parse(workspace)).toEqual({
            packages: ["apps/*"],
            catalog: { "@gtkx/react": "^2.0.0-beta.13", react: "^19.3.0" },
            catalogs: { gtkx: { "@gtkx/cli": "~2.0.0-beta.13" } },
            minimumReleaseAgeExclude: ["@gtkx/*", "create-gtkx"],
        });
        expect(workspace).toContain("# GTKX packages move together");
        expect(project.read("apps/one/package.json")).toBe(
            manifest({ "@gtkx/react": "catalog:" }, { "@gtkx/cli": "catalog:gtkx" }),
        );
        expect(project.read("apps/two/package.json")).toBe(manifest({ "@gtkx/css": "^2.0.0-beta.13" }));
        expect(installs(project.commands())).toEqual([
            { name: "pnpm", cwd: project.root, args: ["install"] },
            { name: "pnpm", cwd: project.root, args: ["dedupe"] },
        ]);
    });

    it.each([
        { yarnVersion: "1.22.22", packageManager: undefined, commands: [["install"]] },
        { yarnVersion: "4.18.1", packageManager: "yarn@4.18.1", commands: [["install"], ["dedupe"]] },
    ])(
        "upgrades a Yarn $yarnVersion workspace from one of its members",
        async ({ yarnVersion, packageManager, commands }) => {
            using project = createTemporaryProject(
                {
                    "package.json": JSON.stringify({
                        name: "studio",
                        private: true,
                        workspaces: ["packages/*"],
                        packageManager,
                    }),
                    "yarn.lock": "",
                    "packages/app/package.json": manifest({ "@gtkx/react": "^2.0.0-beta.11" }),
                },
                { yarnVersion },
            );

            await invoke(["upgrade", "2.0.0-beta.13", "--cwd", join(project.root, "packages/app")]);

            expect(project.read("packages/app/package.json")).toBe(manifest({ "@gtkx/react": "^2.0.0-beta.13" }));
            expect(installs(project.commands())).toEqual(
                commands.map((args) => ({ name: "yarn", cwd: project.root, args })),
            );
        },
    );

    it("moves a shared package's GTKX peer ranges only when they exclude the new version", async () => {
        using project = createTemporaryProject({
            "package.json": JSON.stringify({ name: "studio", private: true }),
            "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
            "packages/ui/package.json": JSON.stringify({
                name: "ui",
                peerDependencies: {
                    "@gtkx/react": "^1.6.0",
                    "@gtkx/css": "^1.6.0 || ^2.0.0-beta.11",
                    "@gtkx/runtime": ">=1.6.0",
                },
            }),
        });

        const output = await invoke(["upgrade", "2.0.0-beta.13", "--cwd", project.root]);

        expect(JSON.parse(project.read("packages/ui/package.json"))).toHaveProperty("peerDependencies", {
            "@gtkx/react": "^2.0.0-beta.13",
            "@gtkx/css": "^1.6.0 || ^2.0.0-beta.11",
            "@gtkx/runtime": ">=1.6.0",
        });
        expect(output).toContain("GTKX packages are on 2.0.0-beta.13");
    });

    it("fails when a GTKX peer range it cannot move still excludes the new version", async () => {
        using project = createTemporaryProject({
            "package.json": JSON.stringify({ name: "ui", peerDependencies: { "@gtkx/react": "1.5.x || 1.6.x" } }),
            "pnpm-lock.yaml": "",
        });

        await expect(invoke(["upgrade", "2.0.0-beta.13", "--cwd", project.root])).rejects.toThrow(
            "@gtkx/react 1.5.x || 1.6.x",
        );
    });

    it("fails when the install leaves GTKX packages on another version", async () => {
        using project = createTemporaryProject({
            "package.json": JSON.stringify({
                name: "app",
                version: "1.0.0",
                packageManager: "yarn@4.18.1",
                dependencies: { "@gtkx/react": "catalog:", "@gtkx/css": "^2.0.0-beta.11" },
            }),
            ".yarnrc.yml": 'catalog:\n  "@gtkx/react": 2.0.0-beta.11\n',
            "yarn.lock": "",
            "node_modules/@gtkx/react/package.json": JSON.stringify({ name: "@gtkx/react", version: "2.0.0-beta.11" }),
            "node_modules/@gtkx/css/package.json": JSON.stringify({ name: "@gtkx/css", version: "2.0.0-beta.13" }),
        });

        await expect(invoke(["upgrade", "2.0.0-beta.13", "--cwd", project.root])).rejects.toThrow();
    });

    it.each([
        {
            packageManager: "npm",
            files: {
                "package.json": JSON.stringify({ name: "studio", private: true, workspaces: ["packages/*"] }),
                "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "studio" } } }),
                ".npmrc": "registry=https://registry.example/\nmin-release-age-exclude[]=lodash",
            },
            settingsFile: ".npmrc",
            exempted: [
                "registry=https://registry.example/",
                "min-release-age-exclude[]=lodash",
                "min-release-age-exclude[]=@gtkx/*",
                "min-release-age-exclude[]=create-gtkx",
                "",
            ].join("\n"),
        },
        {
            packageManager: "pnpm",
            files: {
                "package.json": JSON.stringify({ name: "studio", private: true }),
                "pnpm-workspace.yaml": [
                    "packages:",
                    "  - packages/*",
                    "# Hold back fresh releases",
                    "minimumReleaseAge: 1440",
                    "minimumReleaseAgeExclude:",
                    "  - lodash",
                    "",
                ].join("\n"),
            },
            settingsFile: "pnpm-workspace.yaml",
            exempted: [
                "packages:",
                "  - packages/*",
                "# Hold back fresh releases",
                "minimumReleaseAge: 1440",
                "minimumReleaseAgeExclude:",
                "  - lodash",
                '  - "@gtkx/*"',
                "  - create-gtkx",
                "",
            ].join("\n"),
        },
        {
            packageManager: "yarn",
            files: {
                "package.json": JSON.stringify({
                    name: "studio",
                    private: true,
                    workspaces: ["packages/*"],
                    packageManager: "yarn@4.18.1",
                }),
                "yarn.lock": "",
                ".yarnrc.yml": "nodeLinker: node-modules\nnpmRegistryServer: https://registry.example/\n",
            },
            settingsFile: ".yarnrc.yml",
            exempted: [
                "nodeLinker: node-modules",
                "npmRegistryServer: https://registry.example/",
                "npmPreapprovedPackages:",
                '  - "@gtkx/*"',
                "  - create-gtkx",
                "",
            ].join("\n"),
        },
    ])(
        "exempts GTKX's packages from the $packageManager release-age gate at the workspace root before installing",
        async ({ files, settingsFile, exempted }) => {
            using project = createTemporaryProject({
                ...files,
                "packages/app/package.json": manifest({ "@gtkx/react": "^2.0.0-beta.11" }),
            });

            const output = await invoke(["upgrade", "2.0.0-beta.13", "--cwd", join(project.root, "packages/app")]);

            expect(project.read(settingsFile)).toBe(exempted);
            expect(existsSync(join(project.root, "packages/app", settingsFile))).toBe(false);
            const [install] = project.commands().filter(({ args }) => args[0] === "install");
            expect(install?.settings[settingsFile]).toBe(exempted);
            expect(output).toContain(
                `upgrade: ${settingsFile} exempts @gtkx/* and create-gtkx from the release-age gate`,
            );
            expect(output).toContain("GTKX packages are on 2.0.0-beta.13");
        },
    );

    it("leaves .yarnrc.yml alone when the project's Yarn predates npmPreapprovedPackages", async () => {
        const settings = "nodeLinker: node-modules\n";
        using project = createTemporaryProject(
            {
                "package.json": JSON.stringify({
                    ...JSON.parse(manifest({ "@gtkx/react": "^2.0.0-beta.11" })),
                    packageManager: "yarn@4.9.4",
                }),
                "yarn.lock": "",
                ".yarnrc.yml": settings,
            },
            { yarnVersion: "4.9.4" },
        );

        await invoke(["upgrade", "2.0.0-beta.13", "--cwd", project.root]);

        expect(project.read(".yarnrc.yml")).toBe(settings);
    });

    it.each([
        {
            packageManager: "npm",
            files: {
                "package.json": manifest({ "@gtkx/react": "^2.0.0-beta.11" }),
                "package-lock.json": `${JSON.stringify(
                    {
                        lockfileVersion: 3,
                        packages: {
                            "": { name: "app" },
                            "node_modules/@gtkx/react": { version: "2.0.0-beta.11" },
                        },
                    },
                    null,
                    2,
                )}\n`,
            },
            restored: "package.json, .npmrc, package-lock.json",
        },
        {
            packageManager: "pnpm",
            files: {
                "package.json": manifest({ "@gtkx/react": "catalog:" }),
                "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
                "pnpm-workspace.yaml": 'catalog:\n  "@gtkx/react": ^2.0.0-beta.11\nminimumReleaseAge: 1440\n',
            },
            restored: "pnpm-workspace.yaml, pnpm-lock.yaml",
        },
        {
            packageManager: "yarn",
            files: {
                "package.json": `${JSON.stringify({ ...JSON.parse(manifest({ "@gtkx/react": "^2.0.0-beta.11" })), packageManager: "yarn@4.18.1" }, null, 2)}\n`,
                "yarn.lock": "# yarn lockfile\n",
                ".yarnrc.yml": "nodeLinker: node-modules\n",
            },
            restored: "package.json, .yarnrc.yml, yarn.lock",
        },
    ])(
        "puts back the $packageManager project's files as they were when the install fails",
        async ({ files, restored }) => {
            using project = createTemporaryProject(files, { isInstallFailing: true });

            await expect(invoke(["upgrade", "2.0.0-beta.13", "--cwd", project.root])).rejects.toThrow(
                `gtkx upgrade restored ${restored} as they were`,
            );

            for (const [path, content] of Object.entries(files)) {
                expect(project.read(path)).toBe(content);
            }
            for (const path of SETTINGS_FILES.filter((file) => !Object.hasOwn(files, file))) {
                expect(existsSync(join(project.root, path))).toBe(false);
            }
        },
    );

    it("leaves the project untouched when the registry has no such release", async () => {
        const original = manifest({ "@gtkx/react": "^2.0.0-beta.11" });
        using project = createTemporaryProject({ "package.json": original, "package-lock.json": "{}" });

        await expect(invoke(["upgrade", "2.0.0-beta.99", "--cwd", project.root])).rejects.toThrow();

        expect(project.read("package.json")).toBe(original);
        expect(installs(project.commands())).toEqual([]);
    });
});

describe("GTKX version skew", () => {
    it("warns when the project's GTKX packages are installed at different versions", async () => {
        using project = createProject();
        project.write(
            "package.json",
            JSON.stringify({
                name: "cli-example",
                version: "1.0.0",
                type: "module",
                dependencies: { "@gtkx/cli": "^2.0.0", "@gtkx/i18n": "^2.0.0", "@gtkx/react": "^2.0.0" },
            }),
        );

        expect(await invoke(["build", "--cwd", project.root])).not.toContain("gtkx upgrade");

        rmSync(join(project.root, "node_modules/@gtkx/i18n"));
        project.write(
            "node_modules/@gtkx/i18n/package.json",
            JSON.stringify({ name: "@gtkx/i18n", version: "2.0.0-beta.11" }),
        );
        const output = await invoke(["build", "--cwd", project.root]);

        expect(output).toContain("@gtkx/i18n");
        expect(output).toContain("gtkx upgrade");
    });

    it("warns when a workspace package the project depends on resolves other GTKX versions", async () => {
        using project = createProject();
        project.write(
            "package.json",
            JSON.stringify({
                name: "cli-example",
                version: "1.0.0",
                type: "module",
                dependencies: { "@example/charts": "*", "@gtkx/cli": "^2.0.0", "@gtkx/react": "^2.0.0" },
            }),
        );
        project.write(
            "packages/charts/package.json",
            JSON.stringify({
                name: "@example/charts",
                version: "0.0.1",
                peerDependencies: { "@gtkx/cairo": "^2.0.0" },
            }),
        );
        mkdirSync(join(project.root, "node_modules/@example"));
        symlinkSync("../../packages/charts", join(project.root, "node_modules/@example/charts"), "dir");

        expect(await invoke(["build", "--cwd", project.root])).not.toContain("gtkx upgrade");

        project.write(
            "packages/charts/node_modules/@gtkx/cairo/package.json",
            JSON.stringify({ name: "@gtkx/cairo", version: "2.0.0-beta.11" }),
        );
        const output = await invoke(["build", "--cwd", project.root]);

        expect(output).toContain("@gtkx/cairo 2.0.0-beta.11");
        expect(output).toContain("gtkx upgrade");
    });
});
