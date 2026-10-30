import { runCommand } from "citty";
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { createCommand } from "../dist/command.js";
import { createProject } from "./project.js";

type LoggedCommand = { name: string; cwd: string; args: string[] };

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

const createTemporaryProject = (files: Record<string, string>, yarnVersion = "4.18.1") => {
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
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "--version") {
    console.log(${JSON.stringify(name === "yarn" ? yarnVersion : "11.0.0")});
    process.exit(0);
}
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ name: ${JSON.stringify(name)}, cwd: process.cwd(), args }) + "\\n");
if (args.includes("view") || args.includes("info")) console.log(${JSON.stringify(registryOutput(name, yarnVersion))});
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
            "package.json": JSON.stringify({ name: "studio", private: true }),
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
                yarnVersion,
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
});
