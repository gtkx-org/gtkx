import { runCommand } from "citty";
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { minVersion, satisfies, subset, validRange } from "semver";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { scaffoldCommand } from "../src/index.js";

const initialExitCode = process.exitCode;
afterEach(() => {
    process.exitCode = initialExitCode;
    vi.unstubAllEnvs();
});

const create = async (
    target: string,
    args: string[] = [],
    defaults: string[] = ["--application-id", "org.gtkx.example"],
) => {
    process.exitCode = 0;
    let output: readonly string[] = [];
    await stderr.inspectAsync(async () => {
        output = await stdout.inspectAsync(async () => {
            await runCommand(scaffoldCommand, {
                rawArgs: [target, "--no-interactive", "--skip-install", ...defaults, ...args],
            });
        });
    });
    return { status: process.exitCode, output: stripVTControlCharacters(output.join("")) };
};
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
const npmReleaseAgeExcludes = (root: string) =>
    read(root, ".npmrc")
        .split("\n")
        .filter((line) => line.startsWith("min-release-age-exclude[]="))
        .map((line) => line.slice("min-release-age-exclude[]=".length));
const yarnUserAgent = (version: string) => `yarn/${version} npm/? node/v26.7.0 linux x64`;
const packageManifest = (name: string) =>
    JSON.parse(read(join(import.meta.dirname, "../.."), `${name}/package.json`)) as {
        peerDependencies?: Record<string, string>;
    };

describe("scaffold command", () => {
    it.each([
        { args: ["--typescript", "--vitest"], source: "src/app.tsx", hasTypes: true, hasTests: true },
        { args: ["--no-typescript", "--no-vitest"], source: "src/app.jsx", hasTypes: false, hasTests: false },
    ])("creates a usable project for $source", async ({ args, source, hasTypes, hasTests }) => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-test-"));
        const target = join(directory.path, "example");
        expect((await create(target, args)).status).toBe(0);
        expect(read(target, source)).toContain("AdwApplication");
        expect(JSON.parse(read(target, "package.json"))).toMatchObject({
            name: "example",
            scripts: { build: "gtkx build", dev: "gtkx dev", codegen: "gtkx codegen" },
        });
        expect(JSON.parse(read(target, "package.json"))).toHaveProperty(["dependencies", "@gtkx/react"]);
        expect(JSON.parse(read(target, "package.json"))).toHaveProperty(["devDependencies", "@types/react"]);
        expect(JSON.parse(read(target, "package.json"))).toHaveProperty(["devDependencies", "@gtkx/testing"]);
        expect(existsSync(join(target, "tsconfig.json"))).toBe(hasTypes);
        expect(existsSync(join(target, "vitest.config.ts"))).toBe(hasTests);
        expect(read(target, hasTypes ? "gtkx.config.ts" : "gtkx.config.js")).toContain("org.gtkx.example");
        expect(JSON.parse(read(target, ".mcp.json"))).toEqual({
            mcpServers: { gtkx: { command: "npx", args: ["--no", "gtkx", "mcp"] } },
        });
        const settings = JSON.parse(read(target, ".claude/settings.json")) as { permissions: { allow: string[] } };
        expect(settings.permissions.allow.includes("Bash(npx tsc --noEmit)")).toBe(hasTypes);
    });

    it("configures Yarn to install into node_modules without committing its install state", async () => {
        vi.stubEnv("npm_config_user_agent", yarnUserAgent("4.18.1"));
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-yarn-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--package-manager", "yarn"])).status).toBe(0);
        expect(parse(read(target, ".yarnrc.yml"))).toMatchObject({ nodeLinker: "node-modules" });
        expect(read(target, ".gitignore").split("\n")).toContain(".yarn/install-state.gz");
    });

    it.each([
        { packageManager: "pnpm", commands: ["pnpm dev", "pnpm test", "pnpm typecheck"] },
        { packageManager: "npm", commands: ["npm run dev", "npm test", "npm run typecheck"] },
        { packageManager: "yarn", commands: ["yarn dev", "yarn test", "yarn typecheck"] },
    ])("lets coding agents run the $packageManager scripts of the project", async ({ packageManager, commands }) => {
        vi.stubEnv("npm_config_user_agent", yarnUserAgent("4.18.1"));
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-agents-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--package-manager", packageManager])).status).toBe(0);
        const settings = JSON.parse(read(target, ".claude/settings.json")) as { permissions: { allow: string[] } };
        expect(settings.permissions.allow).toEqual(
            expect.arrayContaining(["Bash(npx gtkx dev:*)", ...commands.map((command) => `Bash(${command}:*)`)]),
        );
        expect(JSON.parse(read(target, ".mcp.json"))).toHaveProperty("mcpServers.gtkx.command", "npx");
    });

    it.each([
        { userAgent: "yarn/4.18.1 npm/? node/v26.7.0 linux x64", corepackYarn: "1.22.22", pin: "yarn@4.18.1" },
        { userAgent: "yarn/1.22.22 npm/? node/v26.7.0 linux x64", corepackYarn: "4.18.1", pin: undefined },
        { userAgent: "npm/11.20.0 node/v26.7.0 linux x64", corepackYarn: "4.18.1", pin: "yarn@4.18.1" },
        { userAgent: "npm/11.20.0 node/v26.7.0 linux x64", corepackYarn: "1.22.22", pin: undefined },
    ])(
        "pins the Yarn release that installs it as $userAgent with Corepack's Yarn $corepackYarn",
        async ({ userAgent, corepackYarn, pin }) => {
            vi.stubEnv("npm_config_user_agent", userAgent);
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-yarn-pin-"));
            const bin = join(directory.path, "bin");
            mkdirSync(bin);
            const corepack = `#!${process.execPath}\nconsole.log(${JSON.stringify(corepackYarn)});\n`;
            writeFileSync(join(bin, "corepack"), corepack, { mode: 0o755 });
            vi.stubEnv("PATH", `${bin}:${process.env.PATH ?? ""}`);
            const target = join(directory.path, "example");
            expect((await create(target, ["--package-manager", "yarn"])).status).toBe(0);
            expect((JSON.parse(read(target, "package.json")) as { packageManager?: string }).packageManager).toBe(pin);
        },
    );

    it.each([
        {
            packageManager: "yarn",
            excludes: (root: string) =>
                (parse(read(root, ".yarnrc.yml")) as { npmPreapprovedPackages?: string[] }).npmPreapprovedPackages,
        },
        {
            packageManager: "pnpm",
            excludes: (root: string) =>
                (parse(read(root, "pnpm-workspace.yaml")) as { minimumReleaseAgeExclude?: string[] })
                    .minimumReleaseAgeExclude,
        },
        { packageManager: "npm", excludes: npmReleaseAgeExcludes },
    ])(
        "exempts GTKX's own packages from the $packageManager release-age gate",
        async ({ packageManager, excludes }) => {
            vi.stubEnv("npm_config_user_agent", yarnUserAgent("4.18.1"));
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-release-age-"));
            const target = join(directory.path, "example");
            expect((await create(target, ["--package-manager", packageManager])).status).toBe(0);
            expect(excludes(target)).toEqual(["@gtkx/*", "create-gtkx"]);
        },
    );

    it.each(["4.9.4", "3.8.7"])("leaves out the preapproval Yarn %s rejects as an unknown setting", async (version) => {
        vi.stubEnv("npm_config_user_agent", yarnUserAgent(version));
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-old-yarn-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--package-manager", "yarn"])).status).toBe(0);
        expect(parse(read(target, ".yarnrc.yml"))).toEqual({ nodeLinker: "node-modules" });
    });

    it("protects an occupied target and preserves unrelated files when overwriting", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-existing-"));
        const target = join(directory.path, "example");
        mkdirSync(target);
        writeFileSync(join(target, "package.json"), '{"name":"keep"}');
        writeFileSync(join(target, "notes.txt"), "personal notes");
        expect((await create(target)).status).toBe(1);
        expect(read(target, "package.json")).toBe('{"name":"keep"}');
        expect((await create(target, ["--overwrite"])).status).toBe(0);
        expect(read(target, "notes.txt")).toBe("personal notes");
        expect(JSON.parse(read(target, "package.json"))).toHaveProperty("name", "example");
    });

    it.each([
        {
            packageManager: "yarn",
            file: ".yarnrc.yml",
            config: "# Company registry\nnpmRegistryServer: https://registry.example.com\nnodeLinker: pnp\nnpmPreapprovedPackages:\n  - lodash\n",
            settings: {
                npmRegistryServer: "https://registry.example.com",
                nodeLinker: "node-modules",
                npmPreapprovedPackages: ["lodash", "@gtkx/*", "create-gtkx"],
            },
        },
        {
            packageManager: "pnpm",
            file: "pnpm-workspace.yaml",
            config: "# Shared settings\npackages:\n  - tools/*\nallowBuilds:\n  sharp: true\nminimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - '@gtkx/*'\n",
            settings: {
                packages: ["tools/*"],
                allowBuilds: { sharp: true, "@swc/core": true, esbuild: true },
                minimumReleaseAge: 1440,
                minimumReleaseAgeExclude: ["@gtkx/*", "create-gtkx"],
            },
        },
    ])(
        "keeps the settings of an existing $file and the packageManager pin when overwriting",
        async ({ packageManager, file, config, settings }) => {
            vi.stubEnv("npm_config_user_agent", "yarn/4.20.0 npm/? node/v26.7.0 linux x64");
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-config-"));
            const target = join(directory.path, "example");
            mkdirSync(target);
            writeFileSync(join(target, file), config);
            writeFileSync(
                join(target, "package.json"),
                JSON.stringify({ name: "keep", packageManager: `${packageManager}@4.18.1` }),
            );
            const { status, output } = await create(target, ["--overwrite", "--package-manager", packageManager]);
            expect(status).toBe(0);
            expect(parse(read(target, file))).toEqual(settings);
            expect(read(target, file)).toContain(config.split("\n")[0]);
            expect(JSON.parse(read(target, "package.json"))).toMatchObject({
                name: "example",
                packageManager: `${packageManager}@4.18.1`,
            });
            expect(output).toContain("package.json");
            expect(output).not.toContain(file);
        },
    );

    it("keeps the settings of an existing .npmrc when overwriting", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-npmrc-"));
        const target = join(directory.path, "example");
        const config =
            "; Company registry\nregistry=https://registry.example.com/\nmin-release-age=3\nmin-release-age-exclude[]=create-gtkx";
        mkdirSync(target);
        writeFileSync(join(target, ".npmrc"), config);
        writeFileSync(join(target, "package.json"), '{"name":"keep"}');
        const { status, output } = await create(target, ["--overwrite", "--package-manager", "npm"]);
        expect(status).toBe(0);
        expect(read(target, ".npmrc").startsWith(`${config}\n`)).toBe(true);
        expect(npmReleaseAgeExcludes(target)).toEqual(["create-gtkx", "@gtkx/*"]);
        expect(output).not.toContain(".npmrc");
    });

    it.each([
        {
            allowBuilds: "allowBuilds:\n  esbuild: true\n",
            printed: ['  "@swc/core": true'],
            omitted: ["esbuild: true"],
        },
        { allowBuilds: "", printed: ['  "@swc/core": true', "  esbuild: true"], omitted: [] },
    ])(
        "adds an app to the pnpm workspace that includes it and prints the build scripts to allow there",
        async ({ allowBuilds, printed, omitted }) => {
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-workspace-"));
            const bin = join(directory.path, "node_modules/.bin");
            const workspaceFile = join(directory.path, "pnpm-workspace.yaml");
            mkdirSync(bin, { recursive: true });
            writeFileSync(
                join(bin, "corepack"),
                `#!${process.execPath}\nimport { appendFileSync, readFileSync, writeFileSync } from "node:fs";\nif (process.argv[2] === "--version") process.exit(0);\nappendFileSync(${JSON.stringify(join(directory.path, "install.log"))}, process.argv.slice(3).join(" ") + "\\n");\nconst catalog = ["react", "vitest"];\nconst manifest = JSON.parse(readFileSync("package.json", "utf8"));\nconst field = process.argv.includes("-D") ? "devDependencies" : "dependencies";\nmanifest[field] ??= {};\nfor (const spec of process.argv.slice(4).filter((arg) => !arg.startsWith("-"))) {\n    const at = spec.lastIndexOf("@");\n    const name = at > 0 ? spec.slice(0, at) : spec;\n    const range = spec.slice(at + 1);\n    manifest[field][name] = at < 1 ? (catalog.includes(spec) ? "catalog:" : "^1.0.0") : range === "latest" ? "^1.0.0" : range;\n}\nwriteFileSync("package.json", JSON.stringify(manifest));\nif (process.env.pnpm_config_strict_dep_builds !== "false") process.exit(1);\nconst settings = readFileSync(${JSON.stringify(workspaceFile)}, "utf8");\nconst placeholder = "  '@swc/core': set this to true or false\\n";\nif (!settings.includes(placeholder)) writeFileSync(${JSON.stringify(workspaceFile)}, settings.includes("allowBuilds:\\n") ? settings.replace("allowBuilds:\\n", "allowBuilds:\\n" + placeholder) : settings + "allowBuilds:\\n" + placeholder);\n`,
                { mode: 0o755 },
            );
            writeFileSync(
                workspaceFile,
                `packages:\n  - apps/*\ncatalog:\n  react: ^18.3.0\n  vitest: ^4.0.0\n${allowBuilds}`,
            );
            const target = join(directory.path, "apps/example");
            const { status, output } = await create(target, ["--no-skip-install", "--package-manager", "pnpm"]);
            expect(status).toBe(0);
            expect(read(directory.path, "install.log")).toContain("add");
            expect(existsSync(join(target, "pnpm-workspace.yaml"))).toBe(false);
            expect(parse(read(directory.path, "pnpm-workspace.yaml"))).toMatchObject({
                allowBuilds: { "@swc/core": "set this to true or false" },
            });
            expect(output).toContain(`${workspaceFile} (under allowBuilds):`);
            expect(output).not.toMatch(/allowBuilds:\s*$/m);
            expect(output).toContain(
                `${workspaceFile}:\n│  minimumReleaseAgeExclude:\n│    - "@gtkx/*"\n│    - create-gtkx`,
            );
            for (const entry of printed) {
                expect(output).toContain(entry);
            }
            for (const entry of omitted) {
                expect(output).not.toContain(entry);
            }
            expect(read(target, "package.json")).not.toContain("catalog:");
            expect(JSON.parse(read(directory.path, ".mcp.json"))).toEqual({
                mcpServers: { gtkx: { command: "pnpm", args: ["--dir", "apps/example", "exec", "gtkx", "mcp"] } },
            });
        },
    );

    it("leaves the build scripts of an app in an npm workspace to the workspace root", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-npm-workspace-"));
        const root = JSON.stringify({
            name: "kitchen",
            private: true,
            workspaces: ["apps/*"],
            allowScripts: { esbuild: true },
        });
        writeFileSync(join(directory.path, "package.json"), root);
        const target = join(directory.path, "apps/example");
        const { status, output } = await create(target, ["--package-manager", "npm"]);
        expect(status).toBe(0);
        expect(JSON.parse(read(target, "package.json"))).not.toHaveProperty("allowScripts");
        expect(read(directory.path, "package.json")).toBe(root);
        expect(output).toContain(join(directory.path, "package.json"));
        expect(output).toContain('"@swc/core": true');
        expect(output).not.toContain('"esbuild": true');
        expect(existsSync(join(target, ".npmrc"))).toBe(false);
        expect(output).toContain(
            `${join(directory.path, ".npmrc")}:\n│  min-release-age-exclude[]=@gtkx/*\n│  min-release-age-exclude[]=create-gtkx`,
        );
        expect(JSON.parse(read(directory.path, ".mcp.json"))).toEqual({
            mcpServers: {
                gtkx: { command: "npm", args: ["exec", "--no", "--workspace", "apps/example", "--", "gtkx", "mcp"] },
            },
        });
    });

    it("typechecks the configuration files of a TypeScript project", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-tsconfig-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--typescript", "--vitest"])).status).toBe(0);
        expect(JSON.parse(read(target, "tsconfig.json"))).toHaveProperty(
            "include",
            expect.arrayContaining(["gtkx.config.ts", "vitest.config.ts"]),
        );
    });

    it("declares the generated project types without a triple-slash path reference", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-env-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--typescript"])).status).toBe(0);
        expect(JSON.parse(read(target, "tsconfig.json"))).toHaveProperty("files", ["node_modules/.gtkx/env.d.ts"]);
        expect(read(target, "src/gtkx-env.d.ts")).not.toContain("reference path");
    });

    it.each([
        {
            userAgent: "yarn/4.18.1 npm/? node/v26.7.0 linux x64",
            pin: {},
            server: { command: "yarn", args: ["workspace", "example", "exec", "gtkx", "mcp"] },
            hasPreapproval: true,
        },
        {
            userAgent: "npm/11.20.0 node/v26.7.0 linux x64",
            pin: { packageManager: "yarn@4.18.1" },
            server: { command: "yarn", args: ["workspace", "example", "exec", "gtkx", "mcp"] },
            hasPreapproval: true,
        },
        {
            userAgent: "yarn/1.22.22 npm/? node/v26.7.0 linux x64",
            pin: {},
            server: { command: "yarn", args: ["--silent", "--cwd", "apps/example", "gtkx", "mcp"] },
            hasPreapproval: false,
        },
    ])(
        "leaves the linker and build scripts of an app in a Yarn workspace to the workspace root ($userAgent)",
        async ({ userAgent, pin, server, hasPreapproval }) => {
            vi.stubEnv("npm_config_user_agent", userAgent);
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-yarn-workspace-"));
            const root = JSON.stringify({
                name: "kitchen",
                private: true,
                workspaces: ["apps/*"],
                dependenciesMeta: { esbuild: { built: true } },
                ...pin,
            });
            const settings = "npmRegistryServer: https://registry.example.com\n";
            writeFileSync(join(directory.path, "package.json"), root);
            writeFileSync(join(directory.path, ".yarnrc.yml"), settings);
            const target = join(directory.path, "apps/example");
            const { status, output } = await create(target, ["--package-manager", "yarn"]);
            expect(status).toBe(0);
            expect(existsSync(join(target, ".yarnrc.yml"))).toBe(false);
            expect(JSON.parse(read(target, "package.json"))).not.toHaveProperty("dependenciesMeta");
            expect(JSON.parse(read(target, "package.json"))).not.toHaveProperty("packageManager");
            expect(read(directory.path, "package.json")).toBe(root);
            expect(read(directory.path, ".yarnrc.yml")).toBe(settings);
            expect(output).toContain(join(directory.path, ".yarnrc.yml"));
            expect(output).toContain("nodeLinker: node-modules");
            expect(output).toContain(join(directory.path, "package.json"));
            expect(output).toContain('"@swc/core"');
            expect(output).not.toContain('"esbuild"');
            expect(output.includes('npmPreapprovedPackages:\n│    - "@gtkx/*"\n│    - create-gtkx')).toBe(
                hasPreapproval,
            );
            expect(JSON.parse(read(directory.path, ".mcp.json"))).toEqual({ mcpServers: { gtkx: server } });
        },
    );

    it("names the workspace root settings when the install of a workspace app fails", async () => {
        vi.stubEnv("npm_config_user_agent", yarnUserAgent("4.18.1"));
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-yarn-gate-"));
        const bin = join(directory.path, "node_modules/.bin");
        mkdirSync(bin, { recursive: true });
        writeFileSync(
            join(bin, "corepack"),
            `#!${process.execPath}\nprocess.exit(process.argv[2] === "--version" ? 0 : 1);\n`,
            { mode: 0o755 },
        );
        writeFileSync(
            join(directory.path, "package.json"),
            JSON.stringify({ name: "kitchen", workspaces: ["apps/*"] }),
        );
        writeFileSync(join(directory.path, ".yarnrc.yml"), "nodeLinker: node-modules\n");
        const { status, output } = await create(join(directory.path, "apps/example"), [
            "--no-skip-install",
            "--package-manager",
            "yarn",
        ]);
        expect(status).toBe(1);
        expect(output).toContain(
            `${join(directory.path, ".yarnrc.yml")}:\n│  npmPreapprovedPackages:\n│    - "@gtkx/*"\n│    - create-gtkx`,
        );
    });

    it("adds one MCP server for every workspace app to the root .mcp.json next to the servers already there", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-mcp-workspace-"));
        writeFileSync(join(directory.path, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
        writeFileSync(
            join(directory.path, ".mcp.json"),
            `${JSON.stringify({ mcpServers: { docs: { command: "docs-server" } } }, null, 2)}\n`,
        );
        const notes = { command: "pnpm", args: ["--dir", "apps/notes", "exec", "gtkx", "mcp"] };

        expect((await create(join(directory.path, "apps/notes"), ["--package-manager", "pnpm"])).status).toBe(0);
        expect(read(directory.path, ".mcp.json")).toBe(
            `${JSON.stringify({ mcpServers: { docs: { command: "docs-server" }, gtkx: notes } }, null, 2)}\n`,
        );
        const { status, output } = await create(join(directory.path, "apps/clock"), ["--package-manager", "pnpm"]);
        expect(status).toBe(0);
        expect(output).toContain(`"gtkx" in ${join(directory.path, ".mcp.json")} drives every running GTKX app`);
        expect(output).toContain(`projectRoot "${join(directory.path, "apps/clock")}"`);
        expect(
            (await create(join(directory.path, "apps/notes"), ["--package-manager", "pnpm", "--overwrite"])).status,
        ).toBe(0);
        expect(JSON.parse(read(directory.path, ".mcp.json"))).toEqual({
            mcpServers: { docs: { command: "docs-server" }, gtkx: notes },
        });

        writeFileSync(join(directory.path, ".mcp.json"), "{ mcpServers: ");
        const unreadable = await create(join(directory.path, "apps/timer"), ["--package-manager", "pnpm"]);
        expect(unreadable.status).toBe(0);
        expect(read(directory.path, ".mcp.json")).toBe("{ mcpServers: ");
        expect(unreadable.output).toContain('"--dir",\n');
        expect(unreadable.output).toContain('"apps/timer"');
    });

    it("gives an app that the enclosing pnpm workspace excludes its own workspace", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-excluded-"));
        writeFileSync(join(directory.path, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - '!apps/example'\n");
        const target = join(directory.path, "apps/example");
        expect((await create(target, ["--package-manager", "pnpm"])).status).toBe(0);
        expect(parse(read(target, "pnpm-workspace.yaml"))).toMatchObject({ packages: ["."] });
    });

    it("creates a target written from the home directory there", async () => {
        using home = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-home-"));
        using work = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-cwd-"));
        vi.stubEnv("HOME", home.path);
        const cwd = process.cwd();
        process.chdir(work.path);
        try {
            expect((await create("~/Projects/example")).status).toBe(0);
        } finally {
            process.chdir(cwd);
        }
        expect(JSON.parse(read(home.path, "Projects/example/package.json"))).toHaveProperty("name", "example");
        expect(existsSync(join(work.path, "~"))).toBe(false);
    });

    it.each([
        {
            directory: "Unit Converter",
            name: "unit-converter",
            displayName: "Unit Converter",
            id: "com.UnitConverter.app",
        },
        { directory: "café", name: "cafe", displayName: "Café", id: "com.cafe.app" },
        {
            directory: "unit_converter",
            name: "unit_converter",
            displayName: "Unit Converter",
            id: "com.unit_converter.app",
        },
    ])("names the project after the directory $directory", async ({ directory, name, displayName, id }) => {
        using parent = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-dirname-"));
        const target = join(parent.path, directory);
        expect((await create(target, [], [])).status).toBe(0);
        expect(JSON.parse(read(target, "package.json"))).toHaveProperty("name", name);
        expect(read(target, "gtkx.config.ts")).toContain(`applicationId: "${id}"`);
        expect(read(target, "gtkx.config.ts")).toContain(`name: "${displayName}"`);
        expect(read(target, "src/app.tsx")).toContain(`title={"${displayName}"}`);
    });

    it("refuses a directory name it cannot derive a package name from", async () => {
        using parent = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-dirname-"));
        const target = join(parent.path, "日本語");
        const result = await create(target);
        expect(result.status).toBe(1);
        expect(result.output).toContain(`Directory name "日本語" has no Latin letters or numbers`);
        expect(existsSync(target)).toBe(false);
    });

    it("refuses to scaffold through a symlink to another directory", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-links-"));
        const target = join(directory.path, "example");
        const outside = join(directory.path, "outside");
        mkdirSync(target);
        mkdirSync(outside);
        symlinkSync(outside, join(target, "src"), "dir");
        expect((await create(target, ["--overwrite"])).status).toBe(1);
        expect(existsSync(join(outside, "app.tsx"))).toBe(false);
    });

    it.each([
        { status: 0, calls: 2 },
        { status: 1, calls: 1 },
    ])("handles package installation exiting with $status", async ({ status, calls }) => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-install-"));
        const bin = join(directory.path, "node_modules/.bin");
        mkdirSync(bin, { recursive: true });
        writeFileSync(
            join(bin, "npm"),
            `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nimport { setTimeout } from "node:timers/promises";\nappendFileSync("install.log", JSON.stringify(process.argv.slice(2)) + "\\n");\nawait setTimeout(500);\nprocess.exit(${status});\n`,
            { mode: 0o755 },
        );
        const target = join(directory.path, "example");
        const { status: exitCode, output } = await create(target, [
            "--no-skip-install",
            "--package-manager",
            "npm",
            "--typescript",
        ]);
        expect(exitCode).toBe(status);
        expect(output.match(/Installing dependencies/g)).toHaveLength(1);
        const commands = read(target, "install.log").trim().split("\n");
        expect(commands).toHaveLength(calls);
        expect(commands[0]).toContain("@gtkx/react");
        expect(read(target, "src/app.tsx")).toContain("AdwApplication");
    });

    it("leaves dependency ranges to a package manager that keeps existing specifiers", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-ranges-"));
        const bin = join(directory.path, "node_modules/.bin");
        mkdirSync(bin, { recursive: true });
        writeFileSync(
            join(bin, "corepack"),
            `#!${process.execPath}\nimport { readFileSync, writeFileSync } from "node:fs";\nif (process.argv[2] === "--version") process.exit(0);\nconst args = process.argv.slice(4);\nconst manifest = JSON.parse(readFileSync("package.json", "utf8"));\nconst field = args.includes("--save-dev") ? "devDependencies" : "dependencies";\nmanifest[field] ??= {};\nfor (const spec of args.filter((arg) => !arg.startsWith("-"))) {\n    const at = spec.lastIndexOf("@");\n    const [name, range] = at > 0 ? [spec.slice(0, at), spec.slice(at + 1).replace("^", "").replace("latest", "^1.0.0")] : [spec, "^1.0.0"];\n    manifest[field][name] ??= range;\n}\nwriteFileSync("package.json", JSON.stringify(manifest));\n`,
            { mode: 0o755 },
        );
        const target = join(directory.path, "example");
        const { status } = await create(target, ["--no-skip-install", "--package-manager", "pnpm"]);
        expect(status).toBe(0);
        const manifest = JSON.parse(read(target, "package.json")) as Record<
            "dependencies" | "devDependencies",
            Record<string, string>
        >;
        const specifiers = { ...manifest.dependencies, ...manifest.devDependencies };
        expect(specifiers["@gtkx/react"]).toMatch(/^\^/);
        expect(Object.values(specifiers)).not.toContain("latest");
    });

    it("installs the React, Vitest and tool majors the GTKX release supports", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-supported-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--typescript", "--vitest"])).status).toBe(0);
        const manifest = JSON.parse(read(target, "package.json")) as Record<
            "dependencies" | "devDependencies",
            Record<string, string>
        >;
        const specifiers = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).filter(
            ([name]) => !name.startsWith("@gtkx/"),
        );
        const peers: Record<string, string | undefined> = {
            ...packageManifest("react").peerDependencies,
            ...packageManifest("testing").peerDependencies,
        };
        const unsupported = specifiers.filter(([name, specifier]) => {
            const lowest = validRange(specifier) === null ? null : minVersion(specifier);
            const peer = peers[name];

            return (
                lowest === null ||
                satisfies(`${String(lowest.major + 1)}.0.0`, specifier) ||
                (peer !== undefined && !subset(specifier, peer))
            );
        });
        expect(specifiers.map(([name]) => name)).toEqual(expect.arrayContaining(["react", "@types/react", "vitest"]));
        expect(unsupported).toEqual([]);
    });

    it.each([["--application-id", "invalid"], ["--package-manager", "missing"], ["--unknown"], ["extra-directory"]])(
        "rejects invalid arguments %j before writing files",
        async (...args) => {
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-invalid-"));
            const target = join(directory.path, "example");
            expect((await create(target, args)).status).toBe(1);
            expect(existsSync(join(target, "package.json"))).toBe(false);
        },
    );
});
