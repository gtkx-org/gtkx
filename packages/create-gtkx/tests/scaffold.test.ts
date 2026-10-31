import { runCommand } from "citty";
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const create = async (target: string, args: string[] = []) => {
    process.exitCode = 0;
    let output: readonly string[] = [];
    await stderr.inspectAsync(async () => {
        output = await stdout.inspectAsync(async () => {
            await runCommand(scaffoldCommand, {
                rawArgs: [
                    target,
                    "--no-interactive",
                    "--skip-install",
                    "--application-id",
                    "org.gtkx.example",
                    ...args,
                ],
            });
        });
    });
    return { status: process.exitCode, output: output.join("") };
};
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
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
        expect(existsSync(join(target, "tsconfig.json"))).toBe(hasTypes);
        expect(existsSync(join(target, "vitest.config.ts"))).toBe(hasTests);
        expect(read(target, hasTypes ? "gtkx.config.ts" : "gtkx.config.js")).toContain("org.gtkx.example");
        expect(JSON.parse(read(target, ".mcp.json"))).toHaveProperty("mcpServers.gtkx");
    });

    it("configures Yarn to install into node_modules without committing its install state", async () => {
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
        { userAgent: "yarn/4.18.1 npm/? node/v26.7.0 linux x64", pin: "yarn@4.18.1" },
        { userAgent: "yarn/1.22.22 npm/? node/v26.7.0 linux x64", pin: undefined },
    ])("pins the Yarn release that runs it as $userAgent", async ({ userAgent, pin }) => {
        vi.stubEnv("npm_config_user_agent", userAgent);
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-yarn-pin-"));
        const target = join(directory.path, "example");
        expect((await create(target, ["--package-manager", "yarn"])).status).toBe(0);
        expect((JSON.parse(read(target, "package.json")) as { packageManager?: string }).packageManager).toBe(pin);
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
            config: "# Company registry\nnpmRegistryServer: https://registry.example.com\nnodeLinker: pnp\n",
            settings: { npmRegistryServer: "https://registry.example.com", nodeLinker: "node-modules" },
        },
        {
            packageManager: "pnpm",
            file: "pnpm-workspace.yaml",
            config: "# Shared settings\npackages:\n  - tools/*\nallowBuilds:\n  sharp: true\nminimumReleaseAge: 1440\n",
            settings: {
                packages: ["tools/*"],
                allowBuilds: { sharp: true, "@swc/core": true, esbuild: true },
                minimumReleaseAge: 1440,
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

    it("adds an app to the pnpm workspace that includes it and prints the build scripts to allow there", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-workspace-"));
        const bin = join(directory.path, "node_modules/.bin");
        mkdirSync(bin, { recursive: true });
        writeFileSync(
            join(bin, "corepack"),
            `#!${process.execPath}\nimport { appendFileSync, readFileSync, writeFileSync } from "node:fs";\nif (process.argv[2] === "--version") process.exit(0);\nappendFileSync(${JSON.stringify(join(directory.path, "install.log"))}, process.argv.slice(3).join(" ") + "\\n");\nconst catalog = ["react", "vitest"];\nconst manifest = JSON.parse(readFileSync("package.json", "utf8"));\nconst field = process.argv.includes("-D") ? "devDependencies" : "dependencies";\nmanifest[field] ??= {};\nfor (const spec of process.argv.slice(4).filter((arg) => !arg.startsWith("-"))) {\n    const at = spec.lastIndexOf("@");\n    const name = at > 0 ? spec.slice(0, at) : spec;\n    const range = spec.slice(at + 1);\n    manifest[field][name] = at < 1 ? (catalog.includes(spec) ? "catalog:" : "^1.0.0") : range === "latest" ? "^1.0.0" : range;\n}\nwriteFileSync("package.json", JSON.stringify(manifest));\nprocess.exit(process.env.pnpm_config_strict_dep_builds === "false" ? 0 : 1);\n`,
            { mode: 0o755 },
        );
        const workspace =
            "packages:\n  - apps/*\ncatalog:\n  react: ^18.3.0\n  vitest: ^4.0.0\nallowBuilds:\n  esbuild: true\n";
        writeFileSync(join(directory.path, "pnpm-workspace.yaml"), workspace);
        const target = join(directory.path, "apps/example");
        const { status, output } = await create(target, ["--no-skip-install", "--package-manager", "pnpm"]);
        expect(status).toBe(0);
        expect(read(directory.path, "install.log")).toContain("add");
        expect(existsSync(join(target, "pnpm-workspace.yaml"))).toBe(false);
        expect(read(directory.path, "pnpm-workspace.yaml")).toBe(workspace);
        expect(output).toContain(join(directory.path, "pnpm-workspace.yaml"));
        expect(output).toContain('"@swc/core": true');
        expect(output).not.toContain("esbuild: true");
        expect(read(target, "package.json")).not.toContain("catalog:");
    });

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

    it("leaves the linker and build scripts of an app in a Yarn workspace to the workspace root", async () => {
        vi.stubEnv("npm_config_user_agent", "yarn/4.18.1 npm/? node/v26.7.0 linux x64");
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-yarn-workspace-"));
        const root = JSON.stringify({
            name: "kitchen",
            private: true,
            workspaces: ["apps/*"],
            dependenciesMeta: { esbuild: { built: true } },
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
    });

    it("gives an app that the enclosing pnpm workspace excludes its own workspace", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-excluded-"));
        writeFileSync(join(directory.path, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - '!apps/example'\n");
        const target = join(directory.path, "apps/example");
        expect((await create(target, ["--package-manager", "pnpm"])).status).toBe(0);
        expect(parse(read(target, "pnpm-workspace.yaml"))).toMatchObject({ packages: ["."] });
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
