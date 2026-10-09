import { runCommand } from "citty";
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldCommand } from "../src/index.js";

const initialExitCode = process.exitCode;
afterEach(() => {
    process.exitCode = initialExitCode;
});

const create = async (target: string, args: string[] = []) => {
    process.exitCode = 0;
    await stderr.inspectAsync(async () => {
        await stdout.inspectAsync(async () => {
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
    return process.exitCode;
};
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

describe("scaffold command", () => {
    it.each([
        { args: ["--typescript", "--vitest"], source: "src/app.tsx", hasTypes: true, hasTests: true },
        { args: ["--no-typescript", "--no-vitest"], source: "src/app.jsx", hasTypes: false, hasTests: false },
    ])("creates a usable project for $source", async ({ args, source, hasTypes, hasTests }) => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-test-"));
        const target = join(directory.path, "example");
        expect(await create(target, args)).toBe(0);
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

    it("protects an occupied target and preserves unrelated files when overwriting", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-existing-"));
        const target = join(directory.path, "example");
        mkdirSync(target);
        writeFileSync(join(target, "package.json"), '{"name":"keep"}');
        writeFileSync(join(target, "notes.txt"), "personal notes");
        expect(await create(target)).toBe(1);
        expect(read(target, "package.json")).toBe('{"name":"keep"}');
        expect(await create(target, ["--overwrite"])).toBe(0);
        expect(read(target, "notes.txt")).toBe("personal notes");
        expect(JSON.parse(read(target, "package.json"))).toHaveProperty("name", "example");
    });

    it("refuses to scaffold through a symlink to another directory", async () => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-links-"));
        const target = join(directory.path, "example");
        const outside = join(directory.path, "outside");
        mkdirSync(target);
        mkdirSync(outside);
        symlinkSync(outside, join(target, "src"), "dir");
        expect(await create(target, ["--overwrite"])).toBe(1);
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
            `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nappendFileSync("install.log", JSON.stringify(process.argv.slice(2)) + "\\n");\nprocess.exit(${status});\n`,
            { mode: 0o755 },
        );
        const target = join(directory.path, "example");
        expect(await create(target, ["--no-skip-install", "--package-manager", "npm", "--typescript"])).toBe(status);
        const commands = read(target, "install.log").trim().split("\n");
        expect(commands).toHaveLength(calls);
        expect(commands[0]).toContain("@gtkx/react");
        expect(read(target, "src/app.tsx")).toContain("AdwApplication");
    });

    it.each([["--application-id", "invalid"], ["--package-manager", "missing"], ["--unknown"], ["extra-directory"]])(
        "rejects invalid arguments %j before writing files",
        async (...args) => {
            using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-create-invalid-"));
            const target = join(directory.path, "example");
            expect(await create(target, args)).toBe(1);
            expect(existsSync(join(target, "package.json"))).toBe(false);
        },
    );
});
