import { runCommand } from "citty";
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { scaffoldCommand } from "../src/index.js";

const initialExitCode = process.exitCode;
afterEach(() => {
    process.exitCode = initialExitCode;
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
        expect(specifiers).toHaveProperty("react", "^1.0.0");
        expect(specifiers["@gtkx/react"]).toMatch(/^\^/);
        expect(Object.values(specifiers)).not.toContain("latest");
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
